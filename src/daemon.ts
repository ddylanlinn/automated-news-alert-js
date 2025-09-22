/**
 * Daemon entry point for the news monitoring application
 */
import { main as daemonMain } from './presentation/daemon';

// Main entry point for daemon
if (require.main === module) {
  daemonMain()
    .then(() => {
      // Daemon main doesn't return exit code, it handles its own lifecycle
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
