# News Monitor

## Architecture Overview

This project adopts Clean Architecture design patterns to ensure code maintainability, testability, and extensibility.

## Architecture Layers

```
src/
├── domain/                 # Domain Layer
│   ├── entities.py        # Domain entities
│   ├── repositories.py    # Repository interfaces
│   └── services.py        # Domain service interfaces
├── application/           # Application Layer
│   ├── use_cases.py      # Use Cases
│   └── dto.py            # Data transfer objects
├── infrastructure/        # Infrastructure Layer
│   ├── repositories.py   # Repository implementations
│   ├── services.py       # Domain service implementations
│   ├── config.py         # Configuration management
│   └── dependency_injection.py  # Dependency injection container
└── presentation/         # Presentation Layer
    ├── cli.py            # Command-line interface
    └── daemon_server.py  # Daemon server
```

## Architecture Principles

### 1. Dependency Inversion Principle

- High-level modules do not depend on low-level modules, both depend on abstractions
- Abstractions do not depend on details, details depend on abstractions

### 2. Single Responsibility Principle

- Each class has only one reason to change
- Each module has a clear responsibility

### 3. Open/Closed Principle

- Open for extension, closed for modification
- Achieved through interfaces and abstract classes

### 4. Interface Segregation Principle

- Clients should not depend on interfaces they don't use
- Interfaces should be small and focused

## Layer Descriptions

### Domain Layer

- **entities.py**: Core business objects (NewsItem, CrawlResult, ScheduleRule)
- **repositories.py**: Data access interface definitions
- **services.py**: Business logic interface definitions

### Application Layer

- **use_cases.py**: Application use cases that orchestrate domain services
- **dto.py**: Data transfer objects for inter-layer data passing

### Infrastructure Layer

- **repositories.py**: Specific repository implementations (JSON files)
- **services.py**: Specific domain service implementations (HTTP crawler, Email notifications)
- **config.py**: Configuration management with environment variable override support
- **dependency_injection.py**: Dependency injection container managing object lifecycle

### Presentation Layer

- **cli.py**: Command-line interface providing various operation commands
- **daemon_server.py**: Daemon server providing continuous monitoring functionality

## Dependency Direction

```
Presentation Layer
        ↓
Application Layer
        ↓
Domain Layer
        ↑
Infrastructure Layer
```

- Dependencies can only point inward
- Outer layers can depend on inner layers, inner layers cannot depend on outer layers
- Dependency inversion achieved through interfaces

## Main Components

### 1. Dependency Injection Container (DIContainer)

- Manages creation and lifecycle of all objects
- Provides unified object access interface
- Supports configuration-driven object creation

### 2. Use Cases

- `MonitorNewsUseCase`: Main business logic for news monitoring
- `TestConnectionUseCase`: Connection testing
- `GetScheduleInfoUseCase`: Schedule information retrieval
- `ValidateScheduleUseCase`: Schedule configuration validation

### 3. Domain Services

- `NewsMonitoringService`: Core business logic for news monitoring
- `CrawlerService`: Web crawling service
- `NotificationService`: Notification service
- `SchedulerService`: Scheduling service

### 4. Repositories

- `NewsRepository`: News data access
- `ScheduleRepository`: Schedule configuration access
- `NotificationRepository`: Notification configuration access

## Configuration Management

### Environment Variable Support

- `EMAIL_USERNAME`: Email username
- `EMAIL_PASSWORD`: Email password
- `EMAIL_FROM_EMAIL`: Sender email
- `EMAIL_TO_EMAILS`: Recipient email list (comma-separated)
- `SCHEDULER_ENABLED`: Whether to enable scheduler
- `SCHEDULER_START_IMMEDIATELY`: Whether to start immediately

### Configuration File Structure

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
    "user_agents": [...]
  },
  "storage": {
    "cache_dir": "data/cache",
    "cleanup_interval_days": 30
  },
  "scheduler": {
    "enabled": true,
    "start_immediately": false,
    "rules": [...]
  },
  "notifications": {
    "email": {
      "enabled": true,
      "smtp_server": "smtp.gmail.com",
      "smtp_port": 587,
      "username": "...",
      "password": "...",
      "from_email": "...",
      "to_emails": [...]
    }
  }
}
```

## Usage

### Command Line Interface

```bash
# Run crawler once
python run_clean.py crawl

# Test connections
python run_clean.py test

# View schedule information
python run_clean.py schedule

# Validate schedule configuration
python run_clean.py validate

# View cache statistics
python run_clean.py stats

# Clean up cache
python run_clean.py cleanup --days 30
```

### Daemon Server

```bash
# Start service
python run_daemon_clean.py start

# Stop service
python run_daemon_clean.py stop

# Restart service
python run_daemon_clean.py restart

# Check status
python run_daemon_clean.py status
```

## Testing Strategy

### Unit Testing

- Each domain entity and service should have corresponding unit tests
- Use Mock objects to isolate external dependencies
- Test coverage should reach 80% or above

### Integration Testing

- Test integration between use cases and infrastructure layer
- Test correctness of dependency injection container
- Test configuration management functionality

### End-to-End Testing

- Test complete monitoring workflow
- Test notification functionality
- Test scheduling functionality

## Extensibility

### Adding Notification Channels

1. Define new notification service interface in `domain/services.py`
2. Implement specific notification service in `infrastructure/services.py`
3. Register new service in `dependency_injection.py`
4. Use new notification service in `NewsMonitoringService`

### Adding Data Storage

1. Define new repository interface in `domain/repositories.py`
2. Implement specific repository in `infrastructure/repositories.py`
3. Register new repository in `dependency_injection.py`

### Adding Crawler Targets

1. Create new crawler service implementation
2. Implement corresponding data parsing logic
3. Register new service in dependency injection container

## Performance Considerations

### Caching Strategy

- Use JSON files to cache news items
- Support cache cleanup and statistics
- Atomic writes to prevent data corruption

### Connection Management

- Use Session objects to reuse HTTP connections
- Implement retry mechanisms and exponential backoff
- Support DNS resolution testing

### Scheduling Optimization

- Support complex time rules
- Avoid duplicate execution
- Error recovery mechanisms

## Monitoring and Logging

### Health Check

- HTTP endpoint provides service status
- Includes service version and uptime
- Supports external monitoring systems

### Error Handling

- Unified error handling mechanism
- Detailed error messages
- Graceful error recovery

## Security

### Configuration Security

- Support environment variable override for sensitive information
- Avoid hardcoding passwords in code
- Configuration file permission control

### Network Security

- Support HTTPS connections
- Implement connection timeouts and retries
- Prevent infinite retry attacks

## Maintainability

### Code Quality

- Follow PEP 8 code style
- Use type hints to improve readability
- Complete documentation strings

### Modular Design

- Clear module boundaries
- Low coupling, high cohesion
- Easy to understand and modify

This architecture design ensures system maintainability, testability, and extensibility while following the core principles of Clean Architecture.
