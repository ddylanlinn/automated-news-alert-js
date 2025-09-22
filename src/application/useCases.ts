/**
 * Application use cases - Orchestrate domain services
 */
import { CrawlResult } from '../domain/entities'
import { NewsRepository, RepositoryStats } from '../domain/repositories'
import {
	CrawlerService,
	NotificationService,
	NewsMonitoringService,
} from '../domain/services'

export interface MonitorNewsUseCase {
	execute(): Promise<CrawlResult>
}

export interface TestConnectionUseCase {
	execute(): Promise<ConnectionTestResult>
}

export interface GetCacheStatsUseCase {
	execute(): Promise<RepositoryStats>
}

export interface CleanupCacheUseCase {
	execute(maxAgeDays?: number): Promise<number>
}

export interface ConnectionTestResult {
	crawler: boolean
	notification: boolean
	crawlerError?: string
	notificationError?: string
}

export class MonitorNewsUseCaseImpl implements MonitorNewsUseCase {
	private readonly monitoringService: NewsMonitoringService

	constructor(monitoringService: NewsMonitoringService) {
		this.monitoringService = monitoringService
	}

	public async execute(): Promise<CrawlResult> {
		return await this.monitoringService.monitorNews()
	}
}

export class TestConnectionUseCaseImpl implements TestConnectionUseCase {
	private readonly crawlerService: CrawlerService
	private readonly notificationService: NotificationService

	constructor(
		crawlerService: CrawlerService,
		notificationService: NotificationService
	) {
		this.crawlerService = crawlerService
		this.notificationService = notificationService
	}

	public async execute(): Promise<ConnectionTestResult> {
		const results: ConnectionTestResult = {
			crawler: false,
			notification: false,
		}

		// Test crawler connection
		try {
			results.crawler = await this.crawlerService.testConnection()
		} catch (error) {
			results.crawler = false
			results.crawlerError =
				error instanceof Error ? error.message : String(error)
		}

		// Test notification connection
		try {
			results.notification = await this.notificationService.testConnection()
		} catch (error) {
			results.notification = false
			results.notificationError =
				error instanceof Error ? error.message : String(error)
		}

		return results
	}
}

export class GetCacheStatsUseCaseImpl implements GetCacheStatsUseCase {
	private readonly newsRepository: NewsRepository

	constructor(newsRepository: NewsRepository) {
		this.newsRepository = newsRepository
	}

	public async execute(): Promise<RepositoryStats> {
		return await this.newsRepository.getStats()
	}
}

export class CleanupCacheUseCaseImpl implements CleanupCacheUseCase {
	private readonly newsRepository: NewsRepository

	constructor(newsRepository: NewsRepository) {
		this.newsRepository = newsRepository
	}

	public async execute(maxAgeDays: number = 30): Promise<number> {
		return await this.newsRepository.cleanupOldEntries(maxAgeDays)
	}
}
