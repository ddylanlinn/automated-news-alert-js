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
		targetUrl?: string
		timeoutSeconds?: number
		maxRetries?: number
		userAgents?: string[]
	}
	storage?: {
		cacheDir?: string
		cleanupIntervalDays?: number
	}
	notifications?: {
		email?: {
			enabled?: boolean
			smtpServer?: string
			smtpPort?: number
			username?: string
			password?: string
			fromEmail?: string
			toEmails?: string[]
			deploymentNotification?: {
				enabled?: boolean
				devEmail?: string
			}
		}
	}
	scheduler?: {
		enabled?: boolean
		intervalHours?: number
		startImmediately?: boolean
		rules?: Array<{
			name: string
			timeRange: string
			intervalMinutes: number
			days: string[]
		}>
	}
	server?: {
		healthCheckPort?: number
		healthCheckHost?: string
		pidFile?: string
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
				'notifications.email.fromEmail',
				process.env['EMAIL_FROM_EMAIL']
			)
		}
		if (process.env['EMAIL_TO_EMAILS']) {
			const emails = process.env['EMAIL_TO_EMAILS']
				.split(',')
				.map((email) => email.trim())
			this.setNestedValue('notifications.email.toEmails', emails)
		}
		if (process.env['EMAIL_SMTP_SERVER']) {
			this.setNestedValue(
				'notifications.email.smtpServer',
				process.env['EMAIL_SMTP_SERVER']
			)
		}
		if (process.env['EMAIL_SMTP_PORT']) {
			this.setNestedValue(
				'notifications.email.smtpPort',
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
				'notifications.email.deploymentNotification.enabled',
				process.env['DEPLOYMENT_NOTIFICATION_ENABLED'].toLowerCase() === 'true'
			)
		}
		if (process.env['DEPLOYMENT_NOTIFICATION_DEV_EMAIL']) {
			this.setNestedValue(
				'notifications.email.deploymentNotification.devEmail',
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
				'scheduler.startImmediately',
				process.env['SCHEDULER_START_IMMEDIATELY'].toLowerCase() === 'true'
			)
		}

		// Server configuration overrides
		if (process.env['PORT']) {
			this.setNestedValue(
				'server.healthCheckPort',
				parseInt(process.env['PORT'], 10)
			)
		}
		if (process.env['HOST']) {
			this.setNestedValue('server.healthCheckHost', process.env['HOST'])
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
					'targetUrl',
					'crawler.targetUrl'
				) as string,
				timeoutSeconds: this.getRequiredConfig(
					crawlerConfig,
					'timeoutSeconds',
					'crawler.timeoutSeconds'
				) as number,
				maxRetries: this.getRequiredConfig(
					crawlerConfig,
					'maxRetries',
					'crawler.maxRetries'
				) as number,
				userAgents: this.getRequiredConfig(
					crawlerConfig,
					'userAgents',
					'crawler.userAgents'
				) as string[],
				cacheDir: this.getRequiredConfig(
					this.config.storage || {},
					'cacheDir',
					'storage.cacheDir'
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
					'smtpServer',
					'notifications.email.smtpServer'
				) as string,
				smtpPort: this.getRequiredConfig(
					notificationConfig,
					'smtpPort',
					'notifications.email.smtpPort'
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
					'fromEmail',
					'notifications.email.fromEmail'
				) as string,
				toEmails: this.getRequiredConfig(
					notificationConfig,
					'toEmails',
					'notifications.email.toEmails'
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
					'intervalHours',
					'scheduler.intervalHours'
				) as number,
				startImmediately: this.getRequiredConfig(
					scheduleConfig,
					'startImmediately',
					'scheduler.startImmediately'
				) as boolean,
			},
			server: {
				healthCheckPort: this.getRequiredConfig(
					serverConfig,
					'healthCheckPort',
					'server.healthCheckPort'
				) as number,
				healthCheckHost: this.getRequiredConfig(
					serverConfig,
					'healthCheckHost',
					'server.healthCheckHost'
				) as string,
				pidFile: this.getRequiredConfig(
					serverConfig,
					'pidFile',
					'server.pidFile'
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
		const deploymentConfig = notificationConfig?.deploymentNotification || {}
		return {
			enabled: this.getRequiredConfig(
				deploymentConfig,
				'enabled',
				'notifications.email.deploymentNotification.enabled'
			) as boolean,
			devEmail: this.getRequiredConfig(
				deploymentConfig,
				'devEmail',
				'notifications.email.deploymentNotification.devEmail'
			) as string,
		}
	}
}
