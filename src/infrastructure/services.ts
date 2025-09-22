/**
 * Service implementations
 */
import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import * as nodemailer from 'nodemailer'
import * as dns from 'dns'
import * as net from 'net'
import * as https from 'https'
import { promisify } from 'util'
import { NewsItem, CrawlResult, NotificationResult } from '../domain/entities'
import { CrawlerService, NotificationService } from '../domain/services'
import { CrawlerConfigDTO, NotificationConfigDTO } from '../application/dto'

const dnsLookup = promisify(dns.lookup)

export class WebCrawlerService implements CrawlerService {
	private readonly config: CrawlerConfigDTO
	private readonly httpClient: AxiosInstance
	private readonly dnsCache: Map<string, { ip: string; timestamp: number }>
	private readonly dnsCacheTtl: number = 300000 // 5 minutes in milliseconds

	constructor(config: CrawlerConfigDTO) {
		this.config = config
		this.dnsCache = new Map()

		this.httpClient = axios.create({
			timeout: config.timeoutSeconds * 1000,
			maxRedirects: 5,
			validateStatus: () => true, // Accept all status codes
			httpsAgent: new https.Agent({
				rejectUnauthorized: false, // Ignore SSL certificate errors
				keepAlive: true,
				timeout: config.timeoutSeconds * 1000,
			}),
			maxContentLength: 50 * 1024 * 1024, // 50MB
			maxBodyLength: 50 * 1024 * 1024, // 50MB
			headers: {
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
				'Accept-Encoding': 'gzip, deflate, br',
				Connection: 'keep-alive',
				'Upgrade-Insecure-Requests': '1',
			},
		})
	}

	public async crawl(): Promise<CrawlResult> {
		const startTime = Date.now()
		const errors: string[] = []
		let items: NewsItem[] = []
		const newItems: NewsItem[] = []

		try {
			// Fetch page content
			const htmlContent = await this.fetchPageContent()
			if (!htmlContent) {
				errors.push('Failed to fetch page content')
				return new CrawlResult(
					false,
					[],
					[],
					errors,
					Date.now() - startTime,
					new Date()
				)
			}

			// Parse HTML and extract news items
			items = this.extractNewsItems(htmlContent)

			console.log(`Crawled ${items.length} items`)

			return new CrawlResult(
				true,
				items,
				newItems, // Will be filled by repository
				errors,
				Date.now() - startTime,
				new Date()
			)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			errors.push(`Crawling error: ${errorMessage}`)
			console.error('Crawling failed:', error)

			return new CrawlResult(
				false,
				items,
				newItems,
				errors,
				Date.now() - startTime,
				new Date()
			)
		}
	}

	private async fetchPageContent(): Promise<string> {
		// Test DNS resolution first
		const dnsSuccess = await this.testDnsResolution()
		if (!dnsSuccess) {
			console.warn('DNS resolution failed, proceeding with original URL')
		}

		const headers = {
			'User-Agent': this.getRandomUserAgent(),
			Accept:
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
			'Accept-Encoding': 'gzip, deflate, br',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
		}

		// Try with original URL first, then with IP if DNS fails
		const urlsToTry = [this.config.targetUrl]
		if (!dnsSuccess && process.env['DNS_FALLBACK_ENABLED'] === 'true') {
			// Add IP-based URL as fallback
			const targetIp = process.env['TARGET_IP'] || '210.241.78.32'
			const ipUrl = this.config.targetUrl.replace('www.hpa.gov.tw', targetIp)
			urlsToTry.push(ipUrl)
			console.log(`DNS fallback enabled, will try IP: ${targetIp}`)
		}

		for (const url of urlsToTry) {
			// Prepare headers for this URL
			const urlHeaders: any = { ...headers }
			if (
				url.includes('210.241.78.32') ||
				url.includes(process.env['TARGET_IP'] || '')
			) {
				// Add Host header when using IP address
				urlHeaders['Host'] = 'www.hpa.gov.tw'
			}

			for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
				try {
					console.log(
						`Fetching page (attempt ${attempt + 1}/${
							this.config.maxRetries
						}) from: ${url}`
					)

					const response = await this.httpClient.get(url, {
						headers: urlHeaders,
						maxRedirects: 5,
					})

					// Check if we got valid content
					if (response.data && response.data.length > 1000) {
						console.log(
							`Successfully fetched ${response.data.length} characters`
						)
						return response.data
					} else {
						console.log(
							`Page content too short: ${response.data?.length || 0} characters`
						)
					}
				} catch (error) {
					console.error(`Request error on attempt ${attempt + 1}:`, error)

					// Additional diagnostic when request fails
					if (attempt === 0) {
						console.log('🔍 Running additional diagnostics...')
						const hostname = new URL(url).hostname
						await this.testHttpsConnection(hostname)
					}

					if (attempt < this.config.maxRetries - 1) {
						const backoffTime = Math.pow(2, attempt) * 1000
						console.log(`⏳ Waiting ${backoffTime}ms before retry...`)
						await this.sleep(backoffTime) // Exponential backoff
					}
				}
			}

			// If Axios fails for this URL, try with native HTTPS as fallback
			console.log(`🔄 Axios failed, trying native HTTPS for: ${url}`)
			const nativeResult = await this.fetchWithNativeHttps(url, urlHeaders)
			if (nativeResult && nativeResult.length > 1000) {
				console.log(
					`✅ Native HTTPS succeeded, fetched ${nativeResult.length} characters`
				)
				return nativeResult
			}
		}

		return ''
	}

	private extractNewsItems(html: string): NewsItem[] {
		const $ = cheerio.load(html)
		const newsItems: NewsItem[] = []

		// Try multiple selector strategies
		const selectors = [
			'a[href*="Pages/Detail.aspx"]',
			'a[href*="topic"]',
			'.news-item a',
			'.topic-item a',
			'li a[href*="Detail.aspx"]',
			'div a[href*="Detail.aspx"]',
		]

		for (const selector of selectors) {
			const elements = $(selector)
			if (elements.length > 0) {
				console.log(
					`Found ${elements.length} elements with selector: ${selector}`
				)
				elements.each((_, element) => {
					const item = this.extractItemFromElement($, element)
					if (item) {
						newsItems.push(item)
					}
				})
				break // Use first successful selector
			}
		}

		// Remove duplicates based on ID
		const uniqueItems = new Map<string, NewsItem>()
		for (const item of newsItems) {
			if (!uniqueItems.has(item.id)) {
				uniqueItems.set(item.id, item)
			}
		}

		return Array.from(uniqueItems.values())
	}

	private extractItemFromElement(
		$: cheerio.CheerioAPI,
		element: any
	): NewsItem | null {
		try {
			const $element = $(element)

			// Extract link
			let href = $element.attr('href')
			if (!href) return null

			if (href.startsWith('/')) {
				href = new URL(href, this.config.targetUrl).href
			} else if (!href.startsWith('http')) {
				href = new URL(href, this.config.targetUrl).href
			}

			// Extract title
			const title = $element.text().trim()
			if (!title || title.length < 5) {
				return null
			}

			// Try to find date in parent elements
			let date: string | undefined
			let $parent = $element.parent()
			for (let i = 0; i < 3; i++) {
				// Check up to 3 parent levels
				if ($parent.length > 0) {
					const $dateElem = $parent.find('span, div').filter((_, el) => {
						const className = $(el).attr('class') || ''
						return className.toLowerCase().includes('date')
					})
					if ($dateElem.length > 0) {
						date = $dateElem.first().text().trim()
						break
					}
					$parent = $parent.parent()
				}
			}

			return NewsItem.create(title, href, date, '')
		} catch (error) {
			console.error('Error extracting item from element:', error)
			return null
		}
	}

	public async testConnection(): Promise<boolean> {
		// Test DNS resolution first
		const dnsSuccess = await this.testDnsResolution()
		if (!dnsSuccess) {
			console.warn('DNS resolution failed')
		}

		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const headers = {
					'User-Agent': this.getRandomUserAgent(),
					Accept:
						'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
					'Accept-Encoding': 'gzip, deflate',
					Connection: 'keep-alive',
					'Cache-Control': 'no-cache',
				}

				const response = await this.httpClient.get(this.config.targetUrl, {
					headers,
					timeout: 30000,
					maxRedirects: 5,
				})

				if (response.status === 200) {
					console.log(`Connection test successful (attempt ${attempt + 1})`)
					return true
				} else {
					console.log(
						`Connection test failed with status code: ${response.status}`
					)
				}
			} catch (error) {
				console.error(`Connection test failed (attempt ${attempt + 1}):`, error)
				if (attempt < 2) {
					// Not the last attempt
					await this.sleep(5000) // Wait 5 seconds before retry
				}
			}
		}

		return false
	}

	private async testDnsResolution(): Promise<boolean> {
		try {
			const url = new URL(this.config.targetUrl)
			const hostname = url.hostname

			if (!hostname) {
				console.error('Cannot extract hostname from URL')
				return false
			}

			// Check DNS cache
			const cachedResult = this.getCachedDnsResult(hostname)
			if (cachedResult) {
				console.log(`Using DNS cache: ${hostname} -> ${cachedResult}`)
				return true
			}

			console.log(`Testing DNS resolution: ${hostname}`)

			// Try DNS resolution with timeout
			const result = (await Promise.race([
				dnsLookup(hostname),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('DNS timeout')), 10000)
				),
			])) as any

			if (result && result.address) {
				console.log(
					`✅ DNS resolution successful: ${hostname} -> ${result.address}`
				)
				this.cacheDnsResult(hostname, result.address)

				// Test TCP connection to the resolved IP
				const tcpTest = await this.testTcpConnection(result.address, 443)
				if (!tcpTest) {
					console.warn(`⚠️ TCP connection to ${result.address}:443 failed`)
				}

				return true
			}

			return false
		} catch (error) {
			console.error('DNS test error:', error)
			console.log('DNS resolution failed, proceeding with original URL')
			return false
		}
	}

	private getCachedDnsResult(hostname: string): string | null {
		const cached = this.dnsCache.get(hostname)
		if (cached && Date.now() - cached.timestamp < this.dnsCacheTtl) {
			return cached.ip
		} else if (cached) {
			// Cache expired, remove
			this.dnsCache.delete(hostname)
		}
		return null
	}

	private cacheDnsResult(hostname: string, ip: string): void {
		this.dnsCache.set(hostname, { ip, timestamp: Date.now() })
		console.log(
			`DNS result cached: ${hostname} -> ${ip} (TTL: ${this.dnsCacheTtl}ms)`
		)
	}

	private getRandomUserAgent(): string {
		const userAgents = this.config.userAgents
		const randomIndex = Math.floor(Math.random() * userAgents.length)
		const userAgent = userAgents[randomIndex]
		if (!userAgent) {
			throw new Error('No user agents configured')
		}
		return userAgent
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	private async testTcpConnection(ip: string, port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const socket = new net.Socket()
			socket.setTimeout(5000)

			socket.on('connect', () => {
				console.log(`✅ TCP connection to ${ip}:${port} successful`)
				socket.destroy()
				resolve(true)
			})

			socket.on('error', (error) => {
				console.log(`❌ TCP connection to ${ip}:${port} failed:`, error.message)
				resolve(false)
			})

			socket.on('timeout', () => {
				console.log(`⏰ TCP connection to ${ip}:${port} timed out`)
				socket.destroy()
				resolve(false)
			})

			socket.connect(port, ip)
		})
	}

	private async testHttpsConnection(hostname: string): Promise<boolean> {
		return new Promise((resolve) => {
			const options = {
				hostname,
				port: 443,
				path: '/',
				method: 'HEAD',
				timeout: 10000,
				rejectUnauthorized: false, // Ignore SSL certificate errors
			}

			const req = https.request(options, (res) => {
				console.log(
					`✅ HTTPS connection to ${hostname} successful, status: ${res.statusCode}`
				)
				resolve(true)
			})

			req.on('error', (error) => {
				console.log(`❌ HTTPS connection to ${hostname} failed:`, error.message)
				resolve(false)
			})

			req.on('timeout', () => {
				console.log(`⏰ HTTPS connection to ${hostname} timed out`)
				req.destroy()
				resolve(false)
			})

			req.end()
		})
	}

	private async fetchWithNativeHttps(
		url: string,
		headers: any
	): Promise<string> {
		return new Promise((resolve) => {
			const urlObj = new URL(url)
			const options = {
				hostname: urlObj.hostname,
				port: 443,
				path: urlObj.pathname + urlObj.search,
				method: 'GET',
				headers,
				timeout: this.config.timeoutSeconds * 1000,
				rejectUnauthorized: false, // Ignore SSL certificate errors
			}

			let data = ''

			const req = https.request(options, (res) => {
				console.log(`Native HTTPS response status: ${res.statusCode}`)

				res.on('data', (chunk) => {
					data += chunk
				})

				res.on('end', () => {
					resolve(data)
				})
			})

			req.on('error', (error) => {
				console.log(`Native HTTPS error:`, error.message)
				resolve('') // Return empty string instead of rejecting
			})

			req.on('timeout', () => {
				console.log('Native HTTPS request timed out')
				req.destroy()
				resolve('')
			})

			req.end()
		})
	}
}

export class EmailNotificationService implements NotificationService {
	private readonly config: NotificationConfigDTO
	private transporter: nodemailer.Transporter

	constructor(config: NotificationConfigDTO) {
		this.config = config
		this.transporter = nodemailer.createTransport({
			host: config.smtpServer,
			port: config.smtpPort,
			secure: false, // true for 465, false for other ports
			auth: {
				user: config.username,
				pass: config.password,
			},
		})
	}

	public async sendNotification(
		title: string,
		message: string,
		items: NewsItem[] = [],
		isDevNotification: boolean = false
	): Promise<NotificationResult> {
		if (!this.config.enabled) {
			return new NotificationResult(
				false,
				'email',
				'Email notification is disabled',
				new Date(),
				'Email notification is disabled'
			)
		}

		try {
			// Create HTML and text content
			const htmlContent = this.createHtmlContent(title, message, items)
			const textContent = this.createTextContent(title, message, items)

			// Determine recipients based on notification type
			let recipients: string[]
			if (isDevNotification && this.config.deploymentNotification?.enabled) {
				// Send to dev email only
				recipients = [this.config.deploymentNotification.devEmail]
				console.log(`🔧 Sending deployment notification to dev: ${recipients}`)
			} else {
				// Send to all recipients
				recipients = this.config.toEmails
				console.log(`📧 Sending notification to all recipients: ${recipients}`)
			}

			// Send email to each recipient individually
			let successfulSends = 0
			const failedSends: string[] = []

			for (const toEmail of recipients) {
				try {
					const mailOptions = {
						from: this.config.fromEmail,
						to: toEmail,
						subject: title,
						text: textContent,
						html: htmlContent,
					}

					await this.transporter.sendMail(mailOptions)
					successfulSends++
					console.log(`✅ Email sent successfully to: ${toEmail}`)
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error)
					failedSends.push(`${toEmail}: ${errorMessage}`)
					console.error(`❌ Failed to send email to ${toEmail}:`, errorMessage)
				}
			}

			// Return result based on success/failure
			if (successfulSends === recipients.length) {
				return new NotificationResult(
					true,
					'email',
					`Email sent to all ${successfulSends} recipients`,
					new Date()
				)
			} else if (successfulSends > 0) {
				return new NotificationResult(
					true,
					'email',
					`Email sent to ${successfulSends}/${
						recipients.length
					} recipients. Failed: ${failedSends.join(', ')}`,
					new Date()
				)
			} else {
				return new NotificationResult(
					false,
					'email',
					`Failed to send to all recipients: ${failedSends.join(', ')}`,
					new Date(),
					`Failed to send to all recipients: ${failedSends.join(', ')}`
				)
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			return new NotificationResult(
				false,
				'email',
				'',
				new Date(),
				errorMessage
			)
		}
	}

	public async testConnection(): Promise<boolean> {
		if (!this.config.enabled) {
			return false
		}

		try {
			await this.transporter.verify()
			return true
		} catch (error) {
			console.error('SMTP connection test failed:', error)
			return false
		}
	}

	private createHtmlContent(
		title: string,
		message: string,
		items: NewsItem[]
	): string {
		let html = `
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
            .news-item { margin: 15px 0; padding: 15px; border-left: 4px solid #007bff; background-color: #f8f9fa; }
            .news-title { font-weight: bold; color: #007bff; }
            .news-link { color: #6c757d; font-size: 0.9em; }
            .news-date { color: #6c757d; font-size: 0.8em; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>${title}</h2>
            <p>${message}</p>
        </div>
    `

		if (items.length > 0) {
			html += '<h3>New Message Items:</h3>'
			for (const item of items) {
				if (item) {
					html += `
          <div class="news-item">
              <div class="news-title">${item.title}</div>
              <div class="news-link"><a href="${item.link}">${
						item.link
					}</a></div>
              ${item.date ? `<div class="news-date">${item.date}</div>` : ''}
          </div>
          `
				}
			}
		}

		html += `
    </body>
    </html>
    `
		return html
	}

	private createTextContent(
		title: string,
		message: string,
		items: NewsItem[]
	): string {
		let text = `${title}\n\n${message}\n\n`

		if (items.length > 0) {
			text += 'New Message Items:\n'
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				if (item) {
					text += `${i + 1}. ${item.title}\n`
					text += `   Link: ${item.link}\n`
					if (item.date) {
						text += `   Date: ${item.date}\n`
					}
					text += '\n'
				}
			}
		}

		return text
	}
}
