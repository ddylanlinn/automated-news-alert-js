/**
 * Dependency injection container
 */
import { NewsRepository, ConfigRepository } from '../domain/repositories'
import {
	CrawlerService,
	NotificationService,
	NewsMonitoringService,
} from '../domain/services'
import { JsonNewsRepository, JsonConfigRepository } from './repositories'
import { WebCrawlerService, EmailNotificationService } from './services'
import { ConfigManager } from './config'
import { AppConfigDTO } from '../application/dto'
import {
	MonitorNewsUseCaseImpl,
	TestConnectionUseCaseImpl,
	GetCacheStatsUseCaseImpl,
	CleanupCacheUseCaseImpl,
} from '../application/useCases'
export class DIContainer {
	private readonly configManager: ConfigManager
	private readonly appConfig: AppConfigDTO
	private readonly instances = new Map<string, unknown>()

	constructor(configPath: string = 'config/config.json') {
		this.configManager = new ConfigManager(configPath)
		this.appConfig = this.configManager.getAppConfig()
	}

	public getConfigManager(): ConfigManager {
		return this.configManager
	}

	public getAppConfig(): AppConfigDTO {
		return this.appConfig
	}

	/**
	 * Generic factory method for creating singleton instances
	 */
	private getInstance<T>(key: string, factory: () => T): T {
		if (!this.instances.has(key)) {
			this.instances.set(key, factory())
		}
		return this.instances.get(key) as T
	}

	public getNewsRepository(): NewsRepository {
		return this.getInstance(
			'newsRepository',
			() => new JsonNewsRepository(this.appConfig.crawler.cacheDir)
		)
	}

	public getConfigRepository(): ConfigRepository {
		return this.getInstance(
			'configRepository',
			() => new JsonConfigRepository(this.configManager)
		)
	}

	public getCrawlerService(): CrawlerService {
		return this.getInstance(
			'crawlerService',
			() => new WebCrawlerService(this.appConfig.crawler)
		)
	}

	public getNotificationService(): NotificationService {
		return this.getInstance(
			'notificationService',
			() => new EmailNotificationService(this.appConfig.notification)
		)
	}

	public getMonitoringService(): NewsMonitoringService {
		return this.getInstance(
			'monitoringService',
			() =>
				new NewsMonitoringService(
					this.getCrawlerService(),
					this.getNewsRepository(),
					this.getNotificationService()
				)
		)
	}

	public getMonitorNewsUseCase(): MonitorNewsUseCaseImpl {
		return this.getInstance(
			'monitorNewsUseCase',
			() => new MonitorNewsUseCaseImpl(this.getMonitoringService())
		)
	}

	public getTestConnectionUseCase(): TestConnectionUseCaseImpl {
		return this.getInstance(
			'testConnectionUseCase',
			() =>
				new TestConnectionUseCaseImpl(
					this.getCrawlerService(),
					this.getNotificationService()
				)
		)
	}

	public getCacheStatsUseCase(): GetCacheStatsUseCaseImpl {
		return this.getInstance(
			'cacheStatsUseCase',
			() => new GetCacheStatsUseCaseImpl(this.getNewsRepository())
		)
	}

	public getCleanupCacheUseCase(): CleanupCacheUseCaseImpl {
		return this.getInstance(
			'cleanupCacheUseCase',
			() => new CleanupCacheUseCaseImpl(this.getNewsRepository())
		)
	}
}
