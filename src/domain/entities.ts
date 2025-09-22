/**
 * Domain entities - Core business objects
 */
import { createHash } from 'crypto'

export interface NewsItemData {
	id: string
	title: string
	link: string
	date?: string | undefined
	contentPreview: string
	crawledAt: Date
}

export class NewsItem {
	public readonly id: string
	public readonly title: string
	public readonly link: string
	public readonly date?: string | undefined
	public readonly contentPreview: string
	public readonly crawledAt: Date

	constructor(
		id: string,
		title: string,
		link: string,
		date?: string | undefined,
		contentPreview: string = '',
		crawledAt: Date = new Date()
	) {
		if (!id || id.trim().length === 0) {
			throw new Error('NewsItem ID cannot be empty')
		}
		if (!title || title.trim().length === 0) {
			throw new Error('NewsItem title cannot be empty')
		}
		if (!link || link.trim().length === 0) {
			throw new Error('NewsItem link cannot be empty')
		}

		this.id = id
		this.title = title
		this.link = link
		this.date = date
		this.contentPreview = contentPreview.substring(0, 200)
		this.crawledAt = crawledAt
	}

	/**
	 * Factory method to create NewsItem with auto-generated ID
	 */
	public static create(
		title: string,
		link: string,
		date?: string | undefined,
		contentPreview: string = ''
	): NewsItem {
		const content = `${title}${link}`
		const itemId = createHash('md5').update(content, 'utf8').digest('hex')

		return new NewsItem(itemId, title, link, date, contentPreview, new Date())
	}

	/**
	 * Convert to dictionary for serialization
	 */
	public toDict(): NewsItemData {
		return {
			id: this.id,
			title: this.title,
			link: this.link,
			date: this.date,
			contentPreview: this.contentPreview,
			crawledAt: this.crawledAt,
		}
	}

	/**
	 * Create from dictionary
	 */
	public static fromDict(data: NewsItemData): NewsItem {
		return new NewsItem(
			data.id,
			data.title,
			data.link,
			data.date,
			data.contentPreview,
			data.crawledAt
		)
	}
}

export interface CrawlResultData {
	success: boolean
	items: NewsItemData[]
	newItems: NewsItemData[]
	errors: string[]
	executionTime: number
	timestamp: Date
	isFirstRun: boolean
}

export class CrawlResult {
	public readonly success: boolean
	public readonly items: NewsItem[]
	public newItems: NewsItem[]
	public readonly errors: string[]
	public readonly executionTime: number
	public readonly timestamp: Date
	public readonly isFirstRun: boolean

	constructor(
		success: boolean,
		items: NewsItem[],
		newItems: NewsItem[],
		errors: string[],
		executionTime: number,
		timestamp: Date = new Date(),
		isFirstRun: boolean = false
	) {
		this.success = success
		this.items = items
		this.newItems = newItems
		this.errors = errors
		this.executionTime = executionTime
		this.timestamp = timestamp
		this.isFirstRun = isFirstRun
	}

	/**
	 * Convert to dictionary for serialization
	 */
	public toDict(): CrawlResultData {
		return {
			success: this.success,
			items: this.items.map((item) => item.toDict()),
			newItems: this.newItems.map((item) => item.toDict()),
			errors: this.errors,
			executionTime: this.executionTime,
			timestamp: this.timestamp,
			isFirstRun: this.isFirstRun,
		}
	}
}

export interface NotificationResultData {
	success: boolean
	channel: string
	message: string
	timestamp: Date
	error?: string | undefined
}

export class NotificationResult {
	public readonly success: boolean
	public readonly channel: string
	public readonly message: string
	public readonly timestamp: Date
	public readonly error?: string | undefined

	constructor(
		success: boolean,
		channel: string,
		message: string,
		timestamp: Date = new Date(),
		error?: string | undefined
	) {
		this.success = success
		this.channel = channel
		this.message = message
		this.timestamp = timestamp
		this.error = error
	}

	public toDict(): NotificationResultData {
		return {
			success: this.success,
			channel: this.channel,
			message: this.message,
			timestamp: this.timestamp,
			error: this.error,
		}
	}
}

export interface ScheduleConfigData {
	enabled: boolean
	intervalHours: number
	startImmediately: boolean
}

export class ScheduleConfig {
	public readonly enabled: boolean
	public readonly intervalHours: number
	public readonly startImmediately: boolean

	constructor(
		enabled: boolean,
		intervalHours: number,
		startImmediately: boolean
	) {
		this.enabled = enabled
		this.intervalHours = intervalHours
		this.startImmediately = startImmediately
	}

	public toDict(): ScheduleConfigData {
		return {
			enabled: this.enabled,
			intervalHours: this.intervalHours,
			startImmediately: this.startImmediately,
		}
	}
}
