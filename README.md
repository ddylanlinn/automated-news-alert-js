# News Monitor

## Overview

This is a generic news monitoring system based on Clean Architecture design that automatically checks any website and sends email notifications when new messages are discovered.

## Key Features

- 🏗️ **Clean Architecture**: Adopts clean architecture design to ensure code maintainability and testability
- 🔄 **Continuous Operation**: Supports daemon mode for background continuous operation
- ⏰ **Configurable Scheduling**: Simple interval scheduling configuration
- 📧 **Smart Notifications**: Only sends notifications when new messages are discovered
- 🚀 **Lightweight**: No log files, suitable for network-mounted environments
- 🛡️ **Stable Operation**: Automatic restart and error recovery
- 🌐 **DNS Optimization**: Built-in DNS caching and multiple DNS server retry mechanisms
- 🎛️ **Easy Management**: Simple command-line interface

## Architecture Design

### Clean Architecture Layers

```
src/
├── domain/                 # Domain Layer - Core business logic
│   ├── entities.py        # Domain entities (NewsItem, CrawlResult)
│   ├── repositories.py    # Repository interfaces
│   └── services.py        # Domain service interfaces
├── application/           # Application Layer - Use case orchestration
│   ├── use_cases.py      # Use case implementations
│   └── dto.py            # Data transfer objects
├── infrastructure/        # Infrastructure Layer - External dependency implementations
│   ├── repositories.py   # Repository implementations
│   ├── services.py       # Service implementations
│   ├── config.py         # Configuration management
│   └── dependency_injection.py  # Dependency injection container
└── presentation/         # Presentation Layer - User interface
    ├── cli.py            # Command-line interface
    └── daemon.py         # Daemon server
```

### Dependency Direction

```
Presentation Layer
        ↓
Application Layer
        ↓
Domain Layer
        ↑
Infrastructure Layer
```

## Quick Start

### 1. Configuration Setup

Copy the example configuration and environment files:

```bash
cp config/config.example.json config/config.json
cp .env.example .env
```

Edit `config/config.json` and `.env` with your settings:

```json
{
	"timezone": "Asia/Taipei",
	"server": {
		"health_check_port": 8080,
		"health_check_host": "0.0.0.0",
		"pid_file": "data/daemon.pid"
	},
	"crawler": {
		"target_url": "https://example.com/news",
		"timeout_seconds": 60,
		"max_retries": 3,
		"user_agents": [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		]
	},
	"storage": {
		"cache_dir": "data/cache",
		"cleanup_interval_days": 30
	},
	"scheduler": {
		"enabled": true,
		"interval_hours": 1,
		"start_immediately": false
	},
	"notifications": {
		"email": {
			"enabled": true,
			"smtp_server": "smtp.gmail.com",
			"smtp_port": 587,
			"username": "your-email@gmail.com",
			"password": "your-app-password",
			"from_email": "your-email@gmail.com",
			"to_emails": ["recipient@example.com"]
		}
	}
}
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Using Command Line Interface

```bash
# Run crawler once
bun run crawl

# Test connections
bun run test

# View cache statistics
bun run stats

# Clean up cache
bun run cleanup -- --days 30
```

### 4. Start Daemon Service

```bash
# Start service
bun run daemon:start

# Stop service
bun run daemon:stop

# Restart service
bun run daemon:restart

# Check status
bun run daemon:status
```

## Environment Variable Support

Supports configuration override through environment variables. Create a `.env` file or set these variables:

```bash
# Email configuration
export EMAIL_USERNAME="your-email@gmail.com"
export EMAIL_PASSWORD="your-app-password"
export EMAIL_FROM_EMAIL="your-email@gmail.com"
export EMAIL_TO_EMAILS="recipient1@example.com,recipient2@example.com"

# Schedule configuration
export SCHEDULER_ENABLED="true"
export SCHEDULER_START_IMMEDIATELY="false"
```

**Important**: You must set the target URL in `config/config.json` under the `crawler.target_url` field.

## Architecture Benefits

### 1. Maintainability

- Clear layered architecture
- Single responsibility principle
- Dependency inversion principle

### 2. Testability

- Dependency injection container
- Interface abstraction
- Easy mock testing

### 3. Extensibility

- Open/closed principle
- Interface segregation principle
- Easy to add new features

### 4. Preserved Good Implementations

- DNS resolution optimization mechanisms
- Atomic cache writing
- Deployment status tracking
- Health check endpoints
- Error handling and retry mechanisms

## Simplified Design

### Removed Over-Engineering Parts

- Complex scheduling system → Simple interval scheduling
- Dual architecture → Unified Clean Architecture
- Excessive abstraction layers → Necessary layering
- Duplicate configuration management → Single configuration system

### Preserved Core Features

- DNS caching and multiple DNS server retry
- Atomic cache writing to prevent data corruption
- Logic for establishing baseline after first deployment
- HTTP health check server
- Environment variable override configuration mechanism
- Complete error handling and retry mechanisms

## Health Check

The service provides HTTP health check endpoint:

```bash
curl http://localhost:8080/health
```

Response:

```json
{
	"status": "healthy",
	"timestamp": "2024-01-01T12:00:00",
	"service": "News Monitor",
	"version": "2.0.0",
	"uptime": 3600
}
```

## Troubleshooting

### 1. Service Cannot Start

```bash
# Check Node.js environment
node --version

# Check configuration file
bun run test
```

### 2. No Notifications Received

```bash
# Test email settings
bun run test

# Check spam folder
```

### 3. Cleanup and Restart

```bash
# Force stop and cleanup
bun run daemon:stop
rm -f data/daemon.pid
bun run daemon:start
```

## System Requirements

- Bun 1.0+ (or Node.js 18+)
- Network connection
- Sufficient disk space (for caching)
- Gmail app password (for email notifications)

## Development Guide

### Adding Notification Channels

1. Define new notification service interface in `domain/services.py`
2. Implement specific notification service in `infrastructure/services.py`
3. Register new service in `dependency_injection.py`

### Adding Data Storage

1. Define new repository interface in `domain/repositories.py`
2. Implement specific repository in `infrastructure/repositories.py`
3. Register new repository in `dependency_injection.py`

### Testing

```bash
# Run tests
bun run test:unit

# Code style check
bun run lint

# Type checking
bun run type-check

# Build
bun run build
```

This refactored version maintains the integrity of the original functionality while providing better architecture design that is easier to maintain and extend.
