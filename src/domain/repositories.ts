/**
 * Repository interfaces - Define contracts for data access
 */
import { NewsItem } from './entities'

export interface NewsRepository {
	/**
	 * Save news items
	 */
	save(items: NewsItem[]): Promise<boolean>

	/**
	 * Find all cached news items
	 */
	findAll(): Promise<Map<string, NewsItem>>

	/**
	 * Find newly discovered items
	 */
	findNewItems(currentItems: NewsItem[]): Promise<NewsItem[]>

	/**
	 * Remove old entries and return count of removed items
	 */
	cleanupOldEntries(maxAgeDays?: number): Promise<number>

	/**
	 * Get repository statistics
	 */
	getStats(): Promise<RepositoryStats>

	/**
	 * Check if this is first run after deployment
	 */
	isFirstRunAfterDeployment(): Promise<boolean>
}

export interface ConfigRepository {
	/**
	 * Get crawler configuration
	 */
	getCrawlerConfig(): Promise<CrawlerConfig>

	/**
	 * Get notification configuration
	 */
	getNotificationConfig(): Promise<NotificationConfig>

	/**
	 * Get schedule configuration
	 */
	getScheduleConfig(): Promise<ScheduleConfig>

	/**
	 * Get server configuration
	 */
	getServerConfig(): Promise<ServerConfig>
}

export interface RepositoryStats {
	totalItems: number
	oldestItem?: Date | undefined
	newestItem?: Date | undefined
	cacheSize: number
	lastCleanup?: Date | undefined
}

export interface CrawlerConfig {
	targetUrl: string
	timeoutSeconds: number
	maxRetries: number
	userAgents: string[]
}

export interface NotificationConfig {
	email: EmailConfig
}

export interface EmailConfig {
	enabled: boolean
	smtpServer: string
	smtpPort: number
	username: string
	password: string
	fromEmail: string
	toEmails: string[]
	deploymentNotification?: DeploymentNotificationConfig | undefined
}

export interface DeploymentNotificationConfig {
	enabled: boolean
	devEmail: string
}

export interface ScheduleConfig {
	enabled: boolean
	intervalHours: number
	startImmediately: boolean
	rules?: ScheduleRule[]
}

export interface ScheduleRule {
	name: string
	timeRange: string
	intervalMinutes: number
	days: string[]
}

export interface ServerConfig {
	healthCheckPort: number
	healthCheckHost: string
	pidFile: string
}
