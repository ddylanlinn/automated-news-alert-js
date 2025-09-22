/**
 * Clean Architecture Daemon Server for News Monitoring
 */
import * as express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { DIContainer } from '../infrastructure/dependency_injection'
import { HealthCheckDTO } from '../application/dto'

export class NewsMonitorDaemon {
	private readonly configPath: string
	private schedulerInterval?: NodeJS.Timeout
	private healthServer?: any
	private startTime?: number
	private container: DIContainer
	private appConfig: any
	private pidFile: string

	constructor(configPath: string = 'config/config.json') {
		this.configPath = configPath

		// Initialize dependency injection container
		this.container = new DIContainer(configPath)
		this.appConfig = this.container.getAppConfig()

		// Set up PID file
		this.pidFile = path.resolve(this.appConfig.server.pidFile)

		// Set up signal handlers
		process.on('SIGTERM', () => this.signalHandler('SIGTERM'))
		process.on('SIGINT', () => this.signalHandler('SIGINT'))
	}

	private printInfo(message: string): void {
		const now = new Date()
		const timezone = this.appConfig.timezone
		const formattedTime = now.toLocaleString('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			timeZoneName: 'short',
		})
		console.log(`[${formattedTime}] ${message}`)
	}

	private signalHandler(signal: string): void {
		this.printInfo(`Received signal ${signal}, shutting down service...`)
		this.stop()
	}

	private writePidFile(): void {
		const pidDir = path.dirname(this.pidFile)
		if (!fs.existsSync(pidDir)) {
			fs.mkdirSync(pidDir, { recursive: true })
		}
		fs.writeFileSync(this.pidFile, process.pid.toString())
		this.printInfo(`PID file written: ${this.pidFile}`)
	}

	private removePidFile(): void {
		if (fs.existsSync(this.pidFile)) {
			fs.unlinkSync(this.pidFile)
			this.printInfo('PID file removed')
		}
	}

	public isRunning(): boolean {
		if (!fs.existsSync(this.pidFile)) {
			return false
		}

		try {
			const pid = parseInt(fs.readFileSync(this.pidFile, 'utf-8').trim(), 10)

			// Check if process exists (simplified check)
			try {
				process.kill(pid, 0)
				return true
			} catch (error) {
				// Process doesn't exist
				this.removePidFile()
				return false
			}
		} catch (error) {
			// PID file is invalid
			this.removePidFile()
			return false
		}
	}

	private startHealthServer(): void {
		try {
			const app = express.default()
			const host = this.appConfig.server.healthCheckHost
			const port = this.appConfig.server.healthCheckPort

			app.get('/health', (_req: any, res: any) => {
				const healthData: HealthCheckDTO = {
					status: 'healthy',
					timestamp: new Date(),
					service: 'News Monitor',
					version: '2.0.0',
					uptime: this.startTime
						? Math.floor((Date.now() - this.startTime) / 1000)
						: 0,
				}

				res.json(healthData)
			})

			this.healthServer = app.listen(port, host, () => {
				this.printInfo(`Health check server started (port: ${port})`)
			})
		} catch (error) {
			this.printInfo(`Health check server startup failed: ${error}`)
		}
	}

	private stopHealthServer(): void {
		if (this.healthServer) {
			this.healthServer.close()
			this.printInfo('Health check server stopped')
		}
	}

	private async runCrawlerCheck(): Promise<boolean> {
		try {
			this.printInfo('Starting crawler check...')

			// Get use case
			const useCase = this.container.getMonitorNewsUseCase()

			// Execute monitoring
			const result = await useCase.execute()

			if (!result.success) {
				this.printInfo(`❌ Crawling failed: ${result.errors.join(', ')}`)
				return false
			}

			// Check for new items
			if (result.newItems.length > 0) {
				this.printInfo(`🆕 Found ${result.newItems.length} new messages!`)

				// Display new items
				for (let i = 0; i < result.newItems.length; i++) {
					const item = result.newItems[i]
					if (item) {
						this.printInfo(`  ${i + 1}. ${item.title}`)
					}
				}
			} else {
				this.printInfo('ℹ️  No new messages found')
			}

			return true
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			this.printInfo(`❌ Crawler execution failed: ${errorMessage}`)
			return false
		}
	}

	private startScheduler(): void {
		if (!this.appConfig.schedule.enabled) {
			this.printInfo('❌ Scheduler not enabled')
			return
		}

		this.printInfo('Scheduler started')

		// Load schedule rules from config
		const scheduleRules = this.loadScheduleRules()
		if (scheduleRules.length === 0) {
			this.printInfo('❌ No valid schedule rules found')
			return
		}

		// Show schedule info
		this.printInfo(`Loaded ${scheduleRules.length} schedule rules`)
		for (const rule of scheduleRules) {
			this.printInfo(
				`  - ${rule.name}: ${rule.timeRange} every ${rule.intervalMinutes} minutes`
			)
		}

		const startImmediately = this.appConfig.schedule.startImmediately

		if (startImmediately) {
			// Execute immediately if configured
			this.printInfo('Configuration requires immediate execution check...')
			this.runCrawlerCheck()
		}

		// Start interval-based scheduler (simplified version)
		const intervalHours = this.appConfig.schedule.intervalHours
		const intervalMs = intervalHours * 60 * 60 * 1000

		this.schedulerInterval = setInterval(async () => {
			await this.runCrawlerCheck()
		}, intervalMs) as NodeJS.Timeout

		this.printInfo(`Scheduler interval set to ${intervalHours} hours`)
	}

	private loadScheduleRules(): any[] {
		try {
			const configContent = fs.readFileSync(this.configPath, 'utf-8')
			const config = JSON.parse(configContent)

			const schedulerConfig = config.scheduler || {}
			const rules = schedulerConfig.rules || []

			// Validate and filter rules
			const validRules: any[] = []
			for (const rule of rules) {
				if (this.validateScheduleRule(rule)) {
					validRules.push(rule)
				} else {
					this.printInfo(
						`⚠️  Invalid schedule rule skipped: ${rule.name || 'Unknown'}`
					)
				}
			}

			return validRules
		} catch (error) {
			this.printInfo(`❌ Failed to load schedule rules: ${error}`)
			return []
		}
	}

	private validateScheduleRule(rule: any): boolean {
		const requiredFields = ['name', 'timeRange', 'intervalMinutes', 'days']
		for (const field of requiredFields) {
			if (!(field in rule)) {
				return false
			}
		}

		// Validate timeRange format (HH:MM-HH:MM)
		try {
			const timeRange = rule.timeRange
			if (!timeRange.includes('-')) {
				return false
			}
			const [startTime, endTime] = timeRange.split('-')
			// Basic validation - should be HH:MM format
			if (startTime.length !== 5 || endTime.length !== 5) {
				return false
			}
			if (!startTime.includes(':') || !endTime.includes(':')) {
				return false
			}
		} catch {
			return false
		}

		// Validate intervalMinutes
		try {
			const interval = parseInt(rule.intervalMinutes, 10)
			if (interval <= 0) {
				return false
			}
		} catch {
			return false
		}

		// Validate days
		const validDays = [
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday',
		]
		if (!Array.isArray(rule.days)) {
			return false
		}
		for (const day of rule.days) {
			if (!validDays.includes(day.toLowerCase())) {
				return false
			}
		}

		return true
	}

	public async start(): Promise<boolean> {
		if (this.isRunning()) {
			this.printInfo('Service is already running')
			return false
		}

		this.printInfo('=== Starting News Crawler Daemon Server ===')
		this.printInfo(`Configuration file: ${this.configPath}`)

		// Write PID file
		this.writePidFile()

		// Start health check server
		this.startHealthServer()

		// Set running state
		this.startTime = Date.now()

		// Execute initial crawler check
		this.printInfo('🚀 Executing initial crawler check on startup...')
		const initialSuccess = await this.runCrawlerCheck()
		if (initialSuccess) {
			this.printInfo('✅ Initial crawler check completed')
		} else {
			this.printInfo(
				'⚠️  Initial crawler check failed, but service will continue running'
			)
		}

		// Start scheduler
		this.startScheduler()

		this.printInfo('✅ Daemon Server started')
		this.printInfo('Press Ctrl+C to stop service')

		return true
	}

	public stop(): void {
		this.printInfo('Stopping Daemon Server...')

		// Stop scheduler
		if (this.schedulerInterval) {
			clearInterval(this.schedulerInterval)
			this.schedulerInterval = undefined as any
		}

		// Stop health check server
		this.stopHealthServer()

		// Remove PID file
		this.removePidFile()

		this.printInfo('✅ Daemon Server stopped')
	}

	public status(): boolean {
		if (this.isRunning()) {
			try {
				const pid = parseInt(fs.readFileSync(this.pidFile, 'utf-8').trim(), 10)
				this.printInfo(`✅ Service is running (PID: ${pid})`)
				return true
			} catch (error) {
				// PID file is invalid
			}
		}

		this.printInfo('❌ Service is not running')
		return false
	}
}

export function parseDaemonArgs(): { action: string; config: string } {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		throw new Error(
			'Action is required. Available actions: start, stop, restart, status'
		)
	}

	const action = args[0]
	const validActions = ['start', 'stop', 'restart', 'status']

	if (!action || !validActions.includes(action)) {
		throw new Error(
			`Invalid action: ${action}. Available actions: ${validActions.join(', ')}`
		)
	}

	let config = 'config/config.json'

	// Parse additional arguments
	for (let i = 1; i < args.length; i++) {
		const arg = args[i]
		if (arg === '--config' && i + 1 < args.length) {
			const nextArg = args[i + 1]
			if (nextArg) {
				config = nextArg
			}
			i++ // Skip next argument
		}
	}

	return { action: action!, config }
}

export async function main(): Promise<void> {
	try {
		const { action, config } = parseDaemonArgs()
		const daemon = new NewsMonitorDaemon(config)

		switch (action) {
			case 'start':
				if (daemon.isRunning()) {
					console.log('❌ Service is already running')
					process.exit(1)
				}
				await daemon.start()
				break
			case 'stop':
				if (!daemon.isRunning()) {
					console.log('❌ Service is not running')
					process.exit(1)
				}
				daemon.stop()
				break
			case 'restart':
				if (daemon.isRunning()) {
					daemon.stop()
					// Wait a bit before starting
					await new Promise((resolve) => setTimeout(resolve, 2000))
				}
				await daemon.start()
				break
			case 'status':
				if (!daemon.status()) {
					process.exit(1)
				}
				break
			default:
				throw new Error(`Unknown action: ${action}`)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`❌ Error: ${errorMessage}`)
		process.exit(1)
	}
}
