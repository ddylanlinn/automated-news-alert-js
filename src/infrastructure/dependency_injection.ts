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
} from '../application/use_cases'

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
		if (!this.instances.has('news_repository')) {
			this.instances.set(
				'news_repository',
				new JsonNewsRepository(this.appConfig.crawler.cacheDir)
			)
		}
		return this.instances.get('news_repository') as NewsRepository
	}

	public getConfigRepository(): ConfigRepository {
		if (!this.instances.has('config_repository')) {
			this.instances.set(
				'config_repository',
				new JsonConfigRepository(this.configManager)
			)
		}
		return this.instances.get('config_repository') as ConfigRepository
	}

	public getCrawlerService(): CrawlerService {
		if (!this.instances.has('crawler_service')) {
			this.instances.set(
				'crawler_service',
				new WebCrawlerService(this.appConfig.crawler)
			)
		}
		return this.instances.get('crawler_service') as CrawlerService
	}

	public getNotificationService(): NotificationService {
		if (!this.instances.has('notification_service')) {
			this.instances.set(
				'notification_service',
				new EmailNotificationService(this.appConfig.notification)
			)
		}
		return this.instances.get('notification_service') as NotificationService
	}

	public getMonitoringService(): NewsMonitoringService {
		if (!this.instances.has('monitoring_service')) {
			this.instances.set(
				'monitoring_service',
				new NewsMonitoringService(
					this.getCrawlerService(),
					this.getNewsRepository(),
					this.getNotificationService()
				)
			)
		}
		return this.instances.get('monitoring_service') as NewsMonitoringService
	}

	public getMonitorNewsUseCase(): MonitorNewsUseCaseImpl {
		if (!this.instances.has('monitor_news_use_case')) {
			this.instances.set(
				'monitor_news_use_case',
				new MonitorNewsUseCaseImpl(this.getMonitoringService())
			)
		}
		return this.instances.get('monitor_news_use_case') as MonitorNewsUseCaseImpl
	}

	public getTestConnectionUseCase(): TestConnectionUseCaseImpl {
		if (!this.instances.has('test_connection_use_case')) {
			this.instances.set(
				'test_connection_use_case',
				new TestConnectionUseCaseImpl(
					this.getCrawlerService(),
					this.getNotificationService()
				)
			)
		}
		return this.instances.get(
			'test_connection_use_case'
		) as TestConnectionUseCaseImpl
	}

	public getCacheStatsUseCase(): GetCacheStatsUseCaseImpl {
		if (!this.instances.has('cache_stats_use_case')) {
			this.instances.set(
				'cache_stats_use_case',
				new GetCacheStatsUseCaseImpl(this.getNewsRepository())
			)
		}
		return this.instances.get(
			'cache_stats_use_case'
		) as GetCacheStatsUseCaseImpl
	}

	public getCleanupCacheUseCase(): CleanupCacheUseCaseImpl {
		if (!this.instances.has('cleanup_cache_use_case')) {
			this.instances.set(
				'cleanup_cache_use_case',
				new CleanupCacheUseCaseImpl(this.getNewsRepository())
			)
		}
		return this.instances.get(
			'cleanup_cache_use_case'
		) as CleanupCacheUseCaseImpl
	}
}
