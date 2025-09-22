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

type ServiceInstance =
	| NewsRepository
	| ConfigRepository
	| CrawlerService
	| NotificationService
	| NewsMonitoringService
	| MonitorNewsUseCaseImpl
	| TestConnectionUseCaseImpl
	| GetCacheStatsUseCaseImpl
	| CleanupCacheUseCaseImpl

export class DIContainer {
	private readonly configManager: ConfigManager
	private readonly appConfig: AppConfigDTO
	private readonly instances: Map<string, ServiceInstance> = new Map()

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

	public getNewsRepository(): NewsRepository {
		if (!this.instances.has('newsRepository')) {
			this.instances.set(
				'newsRepository',
				new JsonNewsRepository(this.appConfig.crawler.cacheDir)
			)
		}
		return this.instances.get('newsRepository') as NewsRepository
	}

	public getConfigRepository(): ConfigRepository {
		if (!this.instances.has('configRepository')) {
			this.instances.set(
				'configRepository',
				new JsonConfigRepository(this.configManager)
			)
		}
		return this.instances.get('configRepository') as ConfigRepository
	}

	public getCrawlerService(): CrawlerService {
		if (!this.instances.has('crawlerService')) {
			this.instances.set(
				'crawlerService',
				new WebCrawlerService(this.appConfig.crawler)
			)
		}
		return this.instances.get('crawlerService') as CrawlerService
	}

	public getNotificationService(): NotificationService {
		if (!this.instances.has('notificationService')) {
			this.instances.set(
				'notificationService',
				new EmailNotificationService(this.appConfig.notification)
			)
		}
		return this.instances.get('notificationService') as NotificationService
	}

	public getMonitoringService(): NewsMonitoringService {
		if (!this.instances.has('monitoringService')) {
			this.instances.set(
				'monitoringService',
				new NewsMonitoringService(
					this.getCrawlerService(),
					this.getNewsRepository(),
					this.getNotificationService()
				)
			)
		}
		return this.instances.get('monitoringService') as NewsMonitoringService
	}

	public getMonitorNewsUseCase(): MonitorNewsUseCaseImpl {
		if (!this.instances.has('monitorNewsUseCase')) {
			this.instances.set(
				'monitorNewsUseCase',
				new MonitorNewsUseCaseImpl(this.getMonitoringService())
			)
		}
		return this.instances.get('monitorNewsUseCase') as MonitorNewsUseCaseImpl
	}

	public getTestConnectionUseCase(): TestConnectionUseCaseImpl {
		if (!this.instances.has('testConnectionUseCase')) {
			this.instances.set(
				'testConnectionUseCase',
				new TestConnectionUseCaseImpl(
					this.getCrawlerService(),
					this.getNotificationService()
				)
			)
		}
		return this.instances.get(
			'testConnectionUseCase'
		) as TestConnectionUseCaseImpl
	}

	public getCacheStatsUseCase(): GetCacheStatsUseCaseImpl {
		if (!this.instances.has('cacheStatsUseCase')) {
			this.instances.set(
				'cacheStatsUseCase',
				new GetCacheStatsUseCaseImpl(this.getNewsRepository())
			)
		}
		return this.instances.get('cacheStatsUseCase') as GetCacheStatsUseCaseImpl
	}

	public getCleanupCacheUseCase(): CleanupCacheUseCaseImpl {
		if (!this.instances.has('cleanupCacheUseCase')) {
			this.instances.set(
				'cleanupCacheUseCase',
				new CleanupCacheUseCaseImpl(this.getNewsRepository())
			)
		}
		return this.instances.get('cleanupCacheUseCase') as CleanupCacheUseCaseImpl
	}
}
