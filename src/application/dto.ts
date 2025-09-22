/**
 * Data Transfer Objects for application layer
 */

export interface CrawlerConfigDTO {
  targetUrl: string;
  timeoutSeconds: number;
  maxRetries: number;
  userAgents: string[];
  cacheDir: string;
}

export interface DeploymentNotificationConfigDTO {
  enabled: boolean;
  devEmail: string;
}

export interface NotificationConfigDTO {
  enabled: boolean;
  smtpServer: string;
  smtpPort: number;
  username: string;
  password: string;
  fromEmail: string;
  toEmails: string[];
  deploymentNotification?: DeploymentNotificationConfigDTO;
}

export interface ScheduleConfigDTO {
  enabled: boolean;
  intervalHours: number;
  startImmediately: boolean;
}

export interface ServerConfigDTO {
  healthCheckPort: number;
  healthCheckHost: string;
  pidFile: string;
}

export interface AppConfigDTO {
  timezone: string;
  crawler: CrawlerConfigDTO;
  notification: NotificationConfigDTO;
  schedule: ScheduleConfigDTO;
  server: ServerConfigDTO;
}

export interface HealthCheckDTO {
  status: string;
  timestamp: Date;
  service: string;
  version?: string;
  uptime?: number;
}
