#!/usr/bin/env node

// Redirect all console output to stderr first
import '../utils/consoleRedirect.js';

import { program } from 'commander';
import inquirer from 'inquirer';
import { sendNotification } from '../utils/notify.js';
import { ingestCredentials } from './ingestCredentials.js';
import { createSection } from '../utils/cli.js';
import { configureClaudeIntegration } from '../utils/claudeConfig.js';

// Initialize logger with console output enabled
import { configureLogger } from '../utils/logger.js';
configureLogger({ enableConsoleOutput: true });

program
  .name('asher')
  .description('CLI for managing Asher financial data aggregator')
  .version('0.1.0');

program
  .command('ingest-creds')
  .description('Ingest credentials from a JSON file')
  .requiredOption('-f, --file <path>', 'Path to the credentials JSON file')
  .option('-k, --key <key>', 'Encryption key for the database (optional, will prompt if not provided and needed)')
  .action(async (options) => {
    try {
      await ingestCredentials(options.file, options.key);
      
      // Notification Setup Section
      console.log(createSection({
        title: 'Notification Setup',
        emoji: '📢',
        color: 'blue'
      }));
      
      const { enableNotifications } = await inquirer.prompt([{
        type: 'confirm',
        name: 'enableNotifications',
        message: '  We use desktop notifications to fetch the decryption password.\n  Please make sure terminal-notifier is enabled in your system settings.\n\n  Do you want to test it now?',
        default: true,
        prefix: '  ',
        suffix: '\n'
      }]);
      
      console.log('\n'); // Add extra spacing

      if (enableNotifications) {
        console.log('  🔔  A test notification will appear shortly.');
        console.log('  Please enable notifications for "terminal-notifier" in your system settings when prompted.\n');
        
        try {
          await sendNotification({
            title: 'Asher CLI - Test Notification',
            message: 'This is a test notification.',
            sound: true,
            wait: false,
            timeout: 15
          });
          console.log('  ✅  Test notification sent successfully!');
          console.log('  ℹ️   If you didn\'t see it, please check your system notification settings.\n');
        } catch (error) {
          console.warn('  ⚠️  Could not send test notification.');
          console.warn('  ℹ️   Make sure notifications are enabled for your terminal.\n');
        }
      } else {
        console.log('  ℹ️  Notifications disabled.');
        console.log('  ℹ️  You can enable them later in your system settings.\n');
      }

      // Transaction Scraping Section
      console.log(createSection({
        title: 'Transaction Scraping',
        emoji: '🔄',
        color: 'blue'
      }));
      
      const { shouldScrape } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldScrape',
        message: '  Would you like to scrape transactions from the ingested accounts now?',
        default: true,
        prefix: '  ',
        suffix: '\n'
      }]);
      
      console.log('\n'); // Add extra spacing

      if (shouldScrape) {
        console.log('\nStarting transaction scraping...');
        // Import the ScraperService
        const { scraperService } = await import('../services/ScraperService.js');
        
        const result = await scraperService.fetchAllTransactions();
        
        if (result.success) {
          const successCount = result.results.filter((r: { success: boolean }) => r.success).length;
          const total = result.results.length;
          console.log(`✅ Successfully scraped from ${successCount} of ${total} accounts`);
          
          // Show summary of results
          result.results.forEach((r: { 
            success: boolean; 
            friendlyName: string; 
            accounts?: Array<{ txns?: any[] }>; 
            error?: string 
          }) => {
            const status = r.success ? '✅' : '❌';
            const transactionCount = r.accounts?.reduce(
              (sum: number, acc: { txns?: any[] }) => sum + (acc.txns?.length || 0), 
              0
            ) || 0;
            console.log(`  ${status} ${r.friendlyName}: ${r.success ? `Found ${transactionCount} transactions` : `Error: ${r.error}`}`);
          });
        } else {
          console.error('Failed to scrape transactions');
          result.results.forEach((r: { success: boolean; friendlyName: string; error?: string }) => {
            if (!r.success) {
              console.error(`  ❌ ${r.friendlyName}: ${r.error}`);
            }
          });
        }
      }
      
      // Final Summary
      console.log(createSection({
        title: 'Success!',
        emoji: '🎉',
        color: 'green'
      }));
      console.log('  ✅  Credentials have been successfully ingested and are ready to use!\n');
      
      // Claude Integration Section
      console.log(createSection({
        title: 'Claude Desktop Integration',
        emoji: '🤖',
        color: 'blue'
      }));
      
      const { configureClaude } = await inquirer.prompt([{
        type: 'confirm',
        name: 'configureClaude',
        message: '  Would you like to configure Claude desktop integration now?',
        default: true,
        prefix: '  ',
        suffix: '\n'
      }]);
      
      console.log('\n'); // Add extra spacing
      
      if (configureClaude) {
        console.log('  ⚙️   Configuring Claude desktop integration...\n');
        const result = await configureClaudeIntegration(process.cwd());
        console.log(`  ${result.message}\n`);
      } else {
        console.log('  ℹ️   Claude desktop configuration skipped.');
        console.log('  ℹ️   You can configure it later using: npm run configure:claude\n');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error occurred');
      process.exit(1);
    }
  });

// Add diagnostics command
program
  .command('configure:claude')
  .description('Configure Claude desktop integration')
  .action(async () => {
    try {
      console.log('Configuring Claude desktop integration...');
      const result = await configureClaudeIntegration(process.cwd());
      console.log(result.message);
      process.exit(0);
    } catch (error) {
      console.error('Error configuring Claude integration:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('diagnostics:notify')
  .description('Test node-notifier notifications')
  .option('-t, --title <title>', 'Notification title', 'Test Notification')
  .option('-m, --message <message>', 'Notification message', 'This is a test notification from Asher CLI')
  .option('--sound', 'Enable sound with notification', false)
  .action(async (options: { title: string; message: string; sound: boolean }) => {
    try {
      console.log('Sending test notification...');
      
      await sendNotification({
        title: options.title,
        message: options.message,
        sound: options.sound,
        wait: false
      });
      
      console.log('Notification sent successfully!');
    } catch (error) {
      console.error('Failed to send notification:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
