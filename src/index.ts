/**
 * Main entry point for the news monitoring application
 */
import { main as cliMain } from './presentation/cli';

// Re-export for easier access
export { main as cliMain } from './presentation/cli';
export { main as daemonMain } from './presentation/daemon';

// Main entry point
if (require.main === module) {
  cliMain()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}
