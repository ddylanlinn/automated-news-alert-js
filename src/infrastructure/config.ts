/**
 * Configuration management with environment variable support
 */
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
import {
	AppConfigDTO,
	DeploymentNotificationConfigDTO,
} from '../application/dto'

interface RawConfig {
	timezone: string
	crawler?: {
		target_url?: string
		timeout_seconds?: number
		max_retries?: number
		user_agents?: string[]
	}
	storage?: {
		cache_dir?: string
	}
	notifications?: {
		email?: {
			enabled?: boolean
			smtp_server?: string
			smtp_port?: number
			username?: string
			password?: string
			from_email?: string
			to_emails?: string[]
			deployment_notification?: {
				enabled?: boolean
				dev_email?: string
			}
		}
	}
	scheduler?: {
		enabled?: boolean
		interval_hours?: number
		start_immediately?: boolean
	}
	server?: {
		health_check_port?: number
		health_check_host?: string
		pid_file?: string
	}
	[key: string]: unknown
}
export class ConfigManager {
	private readonly configPath: string
	private config: RawConfig

	constructor(configPath: string = 'config/config.json') {
		this.configPath = path.resolve(configPath)
		this.loadEnvFile()
		this.config = this.loadConfig()
		this.applyEnvOverrides()
	}

	private loadEnvFile(): void {
		try {
			config()
		} catch (error) {
			// dotenv not available, skip loading .env file
			console.warn('Warning: Could not load .env file')
		}
	}

	private loadConfig(): RawConfig {
		try {
			const configContent = fs.readFileSync(this.configPath, 'utf-8')
			return JSON.parse(configContent)
		} catch (error) {
			if (
				error instanceof Error &&
				'code' in error &&
				error.code === 'ENOENT'
			) {
				throw new Error(`Configuration file not found: ${this.configPath}`)
			}
			throw new Error(`Invalid JSON in configuration file: ${error}`)
		}
	}

	private applyEnvOverrides(): void {
		// Email configuration overrides
		if (process.env['EMAIL_USERNAME']) {
			this.setNestedValue(
				'notifications.email.username',
				process.env['EMAIL_USERNAME']
			)
		}
		if (process.env['EMAIL_PASSWORD']) {
			this.setNestedValue(
				'notifications.email.password',
				process.env['EMAIL_PASSWORD']
			)
		}
		if (process.env['EMAIL_FROM_EMAIL']) {
			this.setNestedValue(
				'notifications.email.from_email',
				process.env['EMAIL_FROM_EMAIL']
			)
		}
		if (process.env['EMAIL_TO_EMAILS']) {
			const emails = process.env['EMAIL_TO_EMAILS']
				.split(',')
				.map((email) => email.trim())
			this.setNestedValue('notifications.email.to_emails', emails)
		}
		if (process.env['EMAIL_SMTP_SERVER']) {
			this.setNestedValue(
				'notifications.email.smtp_server',
				process.env['EMAIL_SMTP_SERVER']
			)
		}
		if (process.env['EMAIL_SMTP_PORT']) {
			this.setNestedValue(
				'notifications.email.smtp_port',
				parseInt(process.env['EMAIL_SMTP_PORT'], 10)
			)
		}
		if (process.env['EMAIL_ENABLED']) {
			this.setNestedValue(
				'notifications.email.enabled',
				process.env['EMAIL_ENABLED'].toLowerCase() === 'true'
			)
		}

		// Deployment notification overrides
		if (process.env['DEPLOYMENT_NOTIFICATION_ENABLED']) {
			this.setNestedValue(
				'notifications.email.deployment_notification.enabled',
				process.env['DEPLOYMENT_NOTIFICATION_ENABLED'].toLowerCase() === 'true'
			)
		}
		if (process.env['DEPLOYMENT_NOTIFICATION_DEV_EMAIL']) {
			this.setNestedValue(
				'notifications.email.deployment_notification.dev_email',
				process.env['DEPLOYMENT_NOTIFICATION_DEV_EMAIL']
			)
		}

		// Schedule configuration overrides
		if (process.env['SCHEDULER_ENABLED']) {
			this.setNestedValue(
				'scheduler.enabled',
				process.env['SCHEDULER_ENABLED'].toLowerCase() === 'true'
			)
		}
		if (process.env['SCHEDULER_START_IMMEDIATELY']) {
			this.setNestedValue(
				'scheduler.start_immediately',
				process.env['SCHEDULER_START_IMMEDIATELY'].toLowerCase() === 'true'
			)
		}

		// Server configuration overrides
		if (process.env['PORT']) {
			this.setNestedValue(
				'server.health_check_port',
				parseInt(process.env['PORT'], 10)
			)
		}
		if (process.env['HOST']) {
			this.setNestedValue('server.health_check_host', process.env['HOST'])
		}
	}

	private setNestedValue(keyPath: string, value: unknown): void {
		const keys = keyPath.split('.')
		let current: any = this.config

		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i]
			if (key === undefined) continue
			if (!(key in current)) {
				current[key] = {}
			}
			current = current[key]
		}

		const lastKey = keys[keys.length - 1]
		if (lastKey !== undefined) {
			current[lastKey] = value
		}
	}

	public getAppConfig(): AppConfigDTO {
		const crawlerConfig = this.config.crawler || {}
		const notificationConfig = this.config.notifications?.email || {}
		const scheduleConfig = this.config.scheduler || {}
		const serverConfig = this.config.server || {}

		return {
			timezone: this.getRequiredConfig(
				this.config,
				'timezone',
				'timezone'
			) as string,
			crawler: {
				targetUrl: this.getRequiredConfig(
					crawlerConfig,
					'target_url',
					'crawler.target_url'
				) as string,
				timeoutSeconds: this.getRequiredConfig(
					crawlerConfig,
					'timeout_seconds',
					'crawler.timeout_seconds'
				) as number,
				maxRetries: this.getRequiredConfig(
					crawlerConfig,
					'max_retries',
					'crawler.max_retries'
				) as number,
				userAgents: this.getRequiredConfig(
					crawlerConfig,
					'user_agents',
					'crawler.user_agents'
				) as string[],
				cacheDir: this.getRequiredConfig(
					this.config.storage || {},
					'cache_dir',
					'storage.cache_dir'
				) as string,
			},
			notification: {
				enabled: this.getRequiredConfig(
					notificationConfig,
					'enabled',
					'notifications.email.enabled'
				) as boolean,
				smtpServer: this.getRequiredConfig(
					notificationConfig,
					'smtp_server',
					'notifications.email.smtp_server'
				) as string,
				smtpPort: this.getRequiredConfig(
					notificationConfig,
					'smtp_port',
					'notifications.email.smtp_port'
				) as number,
				username: this.getRequiredConfig(
					notificationConfig,
					'username',
					'notifications.email.username'
				) as string,
				password: this.getRequiredConfig(
					notificationConfig,
					'password',
					'notifications.email.password'
				) as string,
				fromEmail: this.getRequiredConfig(
					notificationConfig,
					'from_email',
					'notifications.email.from_email'
				) as string,
				toEmails: this.getRequiredConfig(
					notificationConfig,
					'to_emails',
					'notifications.email.to_emails'
				) as string[],
				deploymentNotification:
					this.getDeploymentNotificationConfig(notificationConfig),
			},
			schedule: {
				enabled: this.getRequiredConfig(
					scheduleConfig,
					'enabled',
					'scheduler.enabled'
				) as boolean,
				intervalHours: this.getRequiredConfig(
					scheduleConfig,
					'interval_hours',
					'scheduler.interval_hours'
				) as number,
				startImmediately: this.getRequiredConfig(
					scheduleConfig,
					'start_immediately',
					'scheduler.start_immediately'
				) as boolean,
			},
			server: {
				healthCheckPort: this.getRequiredConfig(
					serverConfig,
					'health_check_port',
					'server.health_check_port'
				) as number,
				healthCheckHost: this.getRequiredConfig(
					serverConfig,
					'health_check_host',
					'server.health_check_host'
				) as string,
				pidFile: this.getRequiredConfig(
					serverConfig,
					'pid_file',
					'server.pid_file'
				) as string,
			},
		}
	}

	public getCrawlerConfig(): RawConfig['crawler'] {
		return this.config.crawler || {}
	}

	public getNotificationConfig(): RawConfig['notifications'] {
		return this.config.notifications || {}
	}

	public getScheduleConfig(): RawConfig['scheduler'] {
		return this.config.scheduler || {}
	}

	public getServerConfig(): RawConfig['server'] {
		return this.config.server || {}
	}

	public get(key: keyof RawConfig, defaultValue?: unknown): unknown {
		return this.config[key] ?? defaultValue
	}

	private getRequiredConfig(
		config: Record<string, unknown>,
		key: string,
		configPath: string
	): unknown {
		if (!(key in config)) {
			throw new Error(
				`Required configuration '${configPath}' is missing. Please set this value in config.json or as environment variable`
			)
		}

		const value = config[key]

		// Check for empty values (empty string, empty array, null, undefined)
		if (
			value == null ||
			value === '' ||
			(Array.isArray(value) && value.length === 0)
		) {
			throw new Error(
				`Required configuration '${configPath}' cannot be empty. Please set a valid value in config.json or as environment variable`
			)
		}

		return value
	}

	private getDeploymentNotificationConfig(
		notificationConfig: NonNullable<RawConfig['notifications']>['email']
	): DeploymentNotificationConfigDTO {
		const deploymentConfig = notificationConfig?.deployment_notification || {}
		return {
			enabled: this.getRequiredConfig(
				deploymentConfig,
				'enabled',
				'notifications.email.deployment_notification.enabled'
			) as boolean,
			devEmail: this.getRequiredConfig(
				deploymentConfig,
				'dev_email',
				'notifications.email.deployment_notification.dev_email'
			) as string,
		}
	}
}
