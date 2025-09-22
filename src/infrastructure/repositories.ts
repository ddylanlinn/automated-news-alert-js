/**
 * Repository implementations
 */
import * as fs from 'fs'
import * as path from 'path'
import { NewsItem } from '../domain/entities'
import {
	NewsRepository,
	ConfigRepository,
	RepositoryStats,
	CrawlerConfig,
	NotificationConfig,
	ScheduleConfig,
	ServerConfig,
} from '../domain/repositories'
import { ConfigManager } from './config'

export class JsonNewsRepository implements NewsRepository {
	private readonly cacheDir: string
	private readonly cacheFile: string
	private readonly tempCacheFile: string

	constructor(cacheDir: string) {
		this.cacheDir = path.resolve(cacheDir)
		this.ensureCacheDir()
		this.cacheFile = path.join(this.cacheDir, 'news_cache.json')
		this.tempCacheFile = path.join(this.cacheDir, 'news_cache.tmp')
	}

	private ensureCacheDir(): void {
		if (!fs.existsSync(this.cacheDir)) {
			fs.mkdirSync(this.cacheDir, { recursive: true })
		}
	}

	public async save(items: NewsItem[]): Promise<boolean> {
		try {
			// Convert NewsItem objects to dict for JSON serialization
			const data: Record<string, any> = {}
			for (const item of items) {
				data[item.id] = item.toDict()
			}

			// TODO: 原子性？
			// Write to temporary file first
			fs.writeFileSync(
				this.tempCacheFile,
				JSON.stringify(data, null, 2),
				'utf-8'
			)

			// Atomic move
			fs.renameSync(this.tempCacheFile, this.cacheFile)
			return true
		} catch (error) {
			console.error('Error saving cache:', error)
			// Clean up temp file if it exists
			if (fs.existsSync(this.tempCacheFile)) {
				fs.unlinkSync(this.tempCacheFile)
			}
			return false
		}
	}

	public async findAll(): Promise<Map<string, NewsItem>> {
		try {
			if (!fs.existsSync(this.cacheFile)) {
				return new Map()
			}

			const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'))

			// Convert dict back to NewsItem objects
			const items = new Map<string, NewsItem>()
			for (const [itemId, itemData] of Object.entries(data)) {
				items.set(itemId, NewsItem.fromDict(itemData as any))
			}

			return items
		} catch (error) {
			console.error('Error loading cache:', error)
			return new Map()
		}
	}

	public async findNewItems(currentItems: NewsItem[]): Promise<NewsItem[]> {
		const cachedItems = await this.findAll()
		const newItems: NewsItem[] = []

		for (const item of currentItems) {
			if (!cachedItems.has(item.id)) {
				newItems.push(item)
			}
		}

		return newItems
	}

	public async cleanupOldEntries(maxAgeDays: number = 30): Promise<number> {
		const cache = await this.findAll()
		const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)

		// Filter out old entries
		const filteredCache = new Map<string, NewsItem>()
		for (const [itemId, item] of cache) {
			if (item.crawledAt > cutoffDate) {
				filteredCache.set(itemId, item)
			}
		}

		// Save filtered cache
		const removedCount = cache.size - filteredCache.size
		if (removedCount > 0) {
			await this.save(Array.from(filteredCache.values()))
			console.log(`Cleaned up ${removedCount} old entries`)
		}

		return removedCount
	}

	public async getStats(): Promise<RepositoryStats> {
		const cache = await this.findAll()
		if (cache.size === 0) {
			return {
				totalItems: 0,
				cacheSize: 0,
			}
		}

		const items = Array.from(cache.values())
		const oldestItem = items.reduce((oldest, current) =>
			current.crawledAt < oldest.crawledAt ? current : oldest
		)
		const newestItem = items.reduce((newest, current) =>
			current.crawledAt > newest.crawledAt ? current : newest
		)

		// Calculate cache file size
		let cacheSize = 0
		if (fs.existsSync(this.cacheFile)) {
			const stats = fs.statSync(this.cacheFile)
			cacheSize = stats.size
		}

		return {
			totalItems: cache.size,
			oldestItem: oldestItem.crawledAt,
			newestItem: newestItem.crawledAt,
			cacheSize,
		}
	}

	public async isFirstRunAfterDeployment(): Promise<boolean> {
		// Check environment variable FIRST_RUN_AFTER_DEPLOYMENT
		// If set to 'true' or '1', then it's first run
		const firstRun =
			process.env['FIRST_RUN_AFTER_DEPLOYMENT']?.toLowerCase() || 'false'
		return ['true', '1', 'yes'].includes(firstRun)
	}
}

export class JsonConfigRepository implements ConfigRepository {
	private readonly configManager: ConfigManager

	constructor(configManager: ConfigManager) {
		this.configManager = configManager
	}

	public async getCrawlerConfig(): Promise<CrawlerConfig> {
		const rawConfig = this.configManager.getCrawlerConfig()
		return {
			targetUrl: rawConfig?.target_url || '',
			timeoutSeconds: rawConfig?.timeout_seconds || 60,
			maxRetries: rawConfig?.max_retries || 3,
			userAgents: rawConfig?.user_agents || [],
		}
	}

	public async getNotificationConfig(): Promise<NotificationConfig> {
		const rawConfig = this.configManager.getNotificationConfig()
		const emailConfig = rawConfig?.email

		const deploymentNotification = emailConfig?.deployment_notification
			? {
					enabled: emailConfig.deployment_notification.enabled || false,
					devEmail: emailConfig.deployment_notification.dev_email || '',
			  }
			: undefined

		return {
			email: {
				enabled: emailConfig?.enabled || false,
				smtpServer: emailConfig?.smtp_server || '',
				smtpPort: emailConfig?.smtp_port || 587,
				username: emailConfig?.username || '',
				password: emailConfig?.password || '',
				fromEmail: emailConfig?.from_email || '',
				toEmails: emailConfig?.to_emails || [],
				deploymentNotification,
			},
		}
	}

	public async getScheduleConfig(): Promise<ScheduleConfig> {
		const rawConfig = this.configManager.getScheduleConfig()
		return {
			enabled: rawConfig?.enabled || false,
			intervalHours: rawConfig?.interval_hours || 24,
			startImmediately: rawConfig?.start_immediately || false,
		}
	}

	public async getServerConfig(): Promise<ServerConfig> {
		const rawConfig = this.configManager.getServerConfig()
		return {
			healthCheckPort: rawConfig?.health_check_port || 8080,
			healthCheckHost: rawConfig?.health_check_host || '0.0.0.0',
			pidFile: rawConfig?.pid_file || 'data/daemon.pid',
		}
	}
}
