/**
 * Command Line Interface for the news monitoring application
 */
import { DIContainer } from '../infrastructure/dependency_injection'

export class NewsMonitorCLI {
	private readonly container: DIContainer

	constructor(configPath: string = 'config/config.json') {
		this.container = new DIContainer(configPath)
	}

	public async runCrawler(): Promise<number> {
		try {
			console.log('=== News Crawler ===')

			// Get use case
			const useCase = this.container.getMonitorNewsUseCase()

			// Execute monitoring
			const result = await useCase.execute()

			if (result.success) {
				console.log('✅ Crawling successful!')
				console.log(`📊 Total crawled ${result.items.length} messages`)
				console.log(`🆕 Found ${result.newItems.length} new messages`)
				console.log(
					`⏱️ Execution time: ${(result.executionTime / 1000).toFixed(
						2
					)} seconds`
				)

				if (result.newItems.length > 0) {
					console.log('\n📰 New messages list:')
					for (let i = 0; i < result.newItems.length; i++) {
						const item = result.newItems[i]
						if (item) {
							console.log(`  ${i + 1}. ${item.title}`)
							console.log(`     Link: ${item.link}`)
							if (item.date) {
								console.log(`     Date: ${item.date}`)
							}
							console.log()
						}
					}
				} else {
					console.log('ℹ️  No new messages found')
				}

				if (result.errors.length > 0) {
					console.log('⚠️  Warnings:')
					for (const error of result.errors) {
						console.log(`  - ${error}`)
					}
				}

				return 0
			} else {
				console.log('❌ Crawling failed!')
				console.log('Error messages:')
				for (const error of result.errors) {
					console.log(`  - ${error}`)
				}
				return 1
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(`❌ Execution failed: ${errorMessage}`)
			return 1
		}
	}

	public async testConnections(): Promise<number> {
		try {
			console.log('=== Connection Test ===')

			// Get use case
			const useCase = this.container.getTestConnectionUseCase()

			// Execute tests
			const results = await useCase.execute()

			// Display results
			const crawlerSuccess = results.crawler
			const notificationSuccess = results.notification

			console.log(
				`🌐 Crawler connection: ${crawlerSuccess ? '✅ Success' : '❌ Failed'}`
			)
			if (!crawlerSuccess && results.crawlerError) {
				console.log(`   Error: ${results.crawlerError}`)
			}

			console.log(
				`📧 Notification connection: ${
					notificationSuccess ? '✅ Success' : '❌ Failed'
				}`
			)
			if (!notificationSuccess && results.notificationError) {
				console.log(`   Error: ${results.notificationError}`)
			}

			if (crawlerSuccess && notificationSuccess) {
				console.log('\n✅ All connection tests passed!')
				return 0
			} else {
				console.log('\n❌ Some connection tests failed!')
				return 1
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(`❌ Connection test failed: ${errorMessage}`)
			return 1
		}
	}

	public async showCacheStats(): Promise<number> {
		try {
			console.log('=== Cache Statistics ===')

			// Get use case
			const useCase = this.container.getCacheStatsUseCase()

			// Execute
			const stats = await useCase.execute()

			console.log(`📊 Total messages: ${stats.totalItems}`)
			console.log(
				`💾 Cache size: ${(stats.cacheSize / (1024 * 1024)).toFixed(2)} MB`
			)

			if (stats.totalItems > 0) {
				console.log(`📅 Oldest message: ${stats.oldestItem?.toISOString()}`)
				console.log(`📅 Newest message: ${stats.newestItem?.toISOString()}`)
			} else {
				console.log('ℹ️  Cache is empty')
			}

			return 0
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(`❌ Failed to get cache statistics: ${errorMessage}`)
			return 1
		}
	}

	public async cleanupCache(maxAgeDays: number = 30): Promise<number> {
		try {
			console.log(`=== Cache Cleanup (keep ${maxAgeDays} days) ===`)

			// Get use case
			const useCase = this.container.getCleanupCacheUseCase()

			// Execute
			const removedCount = await useCase.execute(maxAgeDays)

			if (removedCount > 0) {
				console.log(`✅ Cleaned up ${removedCount} old messages`)
			} else {
				console.log('ℹ️  No old messages to clean up')
			}

			return 0
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error)
			console.error(`❌ Cache cleanup failed: ${errorMessage}`)
			return 1
		}
	}
}

export function parseCliArgs(): {
	command: string
	config: string
	days: number
} {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		throw new Error(
			'Command is required. Available commands: crawl, test, stats, cleanup'
		)
	}

	const command = args[0]
	const validCommands = ['crawl', 'test', 'stats', 'cleanup']

	if (!command || !validCommands.includes(command)) {
		throw new Error(
			`Invalid command: ${command}. Available commands: ${validCommands.join(
				', '
			)}`
		)
	}

	let config = 'config/config.json'
	let days = 30

	// Parse additional arguments
	for (let i = 1; i < args.length; i++) {
		const arg = args[i]
		if (arg === '--config' && i + 1 < args.length) {
			const nextArg = args[i + 1]
			if (nextArg) {
				config = nextArg
			}
			i++ // Skip next argument
		} else if (arg === '--days' && i + 1 < args.length) {
			const nextArg = args[i + 1]
			if (nextArg) {
				days = parseInt(nextArg, 10)
				if (isNaN(days)) {
					throw new Error('--days must be a valid number')
				}
			}
			i++ // Skip next argument
		}
	}

	return { command: command!, config, days }
}

export async function main(): Promise<number> {
	try {
		const { command, config, days } = parseCliArgs()
		// TODO: config should handle here?
		const cli = new NewsMonitorCLI(config)

		switch (command) {
			case 'crawl':
				return await cli.runCrawler()
			case 'test':
				return await cli.testConnections()
			case 'stats':
				return await cli.showCacheStats()
			case 'cleanup':
				return await cli.cleanupCache(days)
			default:
				throw new Error(`Unknown command: ${command}`)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`❌ Error: ${errorMessage}`)
		return 1
	}
}
