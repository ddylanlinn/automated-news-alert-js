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

	public async resetFirstRunState(): Promise<boolean> {
		// Reset first run state by deleting the marker file
		const markerFile = path.join(this.cacheDir, 'first_run_complete')
		try {
			await fs.promises.unlink(markerFile)
			console.log(
				'✅ First run state reset - next run will be treated as first deployment'
			)
			return true
		} catch (error) {
			console.warn('⚠️  Failed to reset first run state:', error)
			return false
		}
	}

	public async isFirstRunAfterDeployment(): Promise<boolean> {
		// Simple file-based check: if marker file exists, it's not first run
		const markerFile = path.join(this.cacheDir, 'first_run_complete')

		try {
			await fs.promises.access(markerFile, fs.constants.F_OK)
			// Marker file exists = not first run
			return false
		} catch {
			// Marker file doesn't exist = first run
			// Create marker file to mark completion
			try {
				await fs.promises.writeFile(markerFile, '', 'utf-8')
				console.log(
					'✅ First deployment completed - future notifications will go to all recipients'
				)
			} catch (error) {
				console.warn('⚠️  Failed to create first run marker:', error)
			}
			return true
		}
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
			targetUrl: rawConfig?.targetUrl || '',
			timeoutSeconds: rawConfig?.timeoutSeconds || 60,
			maxRetries: rawConfig?.maxRetries || 3,
			userAgents: rawConfig?.userAgents || [],
		}
	}

	public async getNotificationConfig(): Promise<NotificationConfig> {
		const rawConfig = this.configManager.getNotificationConfig()
		const emailConfig = rawConfig?.email

		const deploymentNotification = emailConfig?.deploymentNotification
			? {
					enabled: emailConfig.deploymentNotification.enabled || false,
					devEmail: emailConfig.deploymentNotification.devEmail || '',
			  }
			: undefined

		return {
			email: {
				enabled: emailConfig?.enabled || false,
				smtpServer: emailConfig?.smtpServer || '',
				smtpPort: emailConfig?.smtpPort || 587,
				username: emailConfig?.username || '',
				password: emailConfig?.password || '',
				fromEmail: emailConfig?.fromEmail || '',
				toEmails: emailConfig?.toEmails || [],
				deploymentNotification,
			},
		}
	}

	public async getScheduleConfig(): Promise<ScheduleConfig> {
		const rawConfig = this.configManager.getScheduleConfig()
		return {
			enabled: rawConfig?.enabled || false,
			intervalHours: rawConfig?.intervalHours || 24,
			startImmediately: rawConfig?.startImmediately || false,
		}
	}

	public async getServerConfig(): Promise<ServerConfig> {
		const rawConfig = this.configManager.getServerConfig()
		return {
			healthCheckPort: rawConfig?.healthCheckPort || 8080,
			healthCheckHost: rawConfig?.healthCheckHost || '0.0.0.0',
			pidFile: rawConfig?.pidFile || 'data/daemon.pid',
		}
	}
}
