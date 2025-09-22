/**
 * Domain services - Business logic that doesn't belong to entities
 */
import { NewsItem, CrawlResult, NotificationResult } from './entities'
import { NewsRepository } from './repositories'

export interface CrawlerService {
	/**
	 * Perform web crawling
	 */
	crawl(): Promise<CrawlResult>

	/**
	 * Test connection to target website
	 */
	testConnection(): Promise<boolean>
}

export interface NotificationService {
	/**
	 * Send notification
	 */
	sendNotification(
		title: string,
		message: string,
		items?: NewsItem[],
		isDevNotification?: boolean
	): Promise<NotificationResult>

	/**
	 * Test notification connection
	 */
	testConnection(): Promise<boolean>
}

export class NewsMonitoringService {
	private readonly crawlerService: CrawlerService
	private readonly newsRepository: NewsRepository
	private readonly notificationService: NotificationService

	constructor(
		crawlerService: CrawlerService,
		newsRepository: NewsRepository,
		notificationService: NotificationService
	) {
		this.crawlerService = crawlerService
		this.newsRepository = newsRepository
		this.notificationService = notificationService
	}

	/**
	 * Main business logic for news monitoring
	 */
	public async monitorNews(): Promise<CrawlResult> {
		// Check if this is first run after deployment
		const isFirstRun = await this.newsRepository.isFirstRunAfterDeployment()

		// Perform crawling
		const result = await this.crawlerService.crawl()
		// Note: isFirstRun is set in the constructor, we can't modify it here
		// We'll handle this in the use case layer

		if (!result.success) {
			return result
		}

		// Find new items
		const newItems = await this.newsRepository.findNewItems(result.items)

		// Update result with new items
		result.newItems = newItems

		// Save all items to repository
		if (result.items.length > 0) {
			await this.newsRepository.save(result.items)
		}

		// Send notification if there are new items
		if (newItems.length > 0 && this.notificationService) {
			let title: string
			let message: string
			let isDevNotification: boolean

			if (isFirstRun) {
				// First run after deployment - send to dev only
				title = `[First run after deployment] News update - Found ${newItems.length} new messages`
				message = `First execution after system redeployment, found ${newItems.length} new messages. This is post-deployment initialization, sent only to developers.`
				isDevNotification = true
			} else {
				// Normal run - send to all recipients
				title = `News update - Found ${newItems.length} new messages`
				message = `Monitoring system found ${newItems.length} new messages.`
				isDevNotification = false
			}

			const notificationResult =
				await this.notificationService.sendNotification(
					title,
					message,
					newItems,
					isDevNotification
				)

			if (!notificationResult.success) {
				result.errors.push(
					`Notification sending failed: ${notificationResult.error}`
				)
			}
		}

		return result
	}
}
