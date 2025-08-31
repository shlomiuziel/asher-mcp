import israeliBankScrapers from 'israeli-bank-scrapers';
import { sendNotification } from '../utils/notify.js';
const { createScraper } = israeliBankScrapers;
import type { ScraperOptions } from 'israeli-bank-scrapers';
import { DatabaseFactory } from './DatabaseFactory.js';
import { DatabaseService } from '../interfaces/DatabaseService.js';

// Get database instance
const databaseService: DatabaseService = DatabaseFactory.getInstance();

interface ScrapingResult {
  success: boolean;
  accounts?: Array<{
    accountNumber: string;
    txns: ScraperTransaction[];
  }>;
  errorType?: string;
  errorMessage?: string;
  error?: Error;
}

interface ScraperTransaction {
  identifier?: string | number;
  type: string;
  status: string;
  date: Date | string;
  processedDate?: Date | string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  description: string;
  memo?: string;
  category?: string;
  currency?: string;
}

export class ScraperService {
  private static instance: ScraperService;
  private databaseService: DatabaseService;

  private constructor() {
    this.databaseService = databaseService;
  }

  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  /**
   * Fetches transactions for all configured scrapers
   */
  public async fetchAllTransactions(): Promise<{
    success: boolean;
    results: Array<{
      scraper: string;
      friendlyName: string;
      success: boolean;
      accounts?: any[];
      error?: string;
      errorType?: string;
    }>;
  }> {
    try {
      // Get all configured scrapers from the database
      const scraperConfigs = await databaseService.query<{
        id: number;
        scraper_type: string;
        credentials: string;
        friendly_name: string;
        tags: string | null;
        last_scraped_timestamp: string | null;
      }>(`
        SELECT id, scraper_type, credentials, friendly_name, tags, last_scraped_timestamp
        FROM scraper_credentials
        WHERE credentials IS NOT NULL
      `);

      const scraperConfigsTyped = scraperConfigs as Array<{
        id: number;
        scraper_type: string;
        credentials: string;
        friendly_name: string;
        tags: string | null;
        last_scraped_timestamp: string | null;
      }>;

      const results = [];

      if (!scraperConfigsTyped.length) {
        console.log('No configured scrapers found');
        throw new Error('No configured scrapers found');
      }

      for (const config of scraperConfigsTyped) {
        try {
          // Calculate start date (1 year ago or last scraped date)
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          const startDate = config.last_scraped_timestamp
            ? new Date(new Date(config.last_scraped_timestamp).getTime() + 1000) // Add 1 second to avoid processing the same transaction
            : oneYearAgo;

          let credentials: any;
          try {
            credentials = JSON.parse(config.credentials);
          } catch (e) {
            console.error(`Failed to parse credentials for ${config.friendly_name}:`, e);
            results.push({
              scraper: config.scraper_type,
              friendlyName: config.friendly_name,
              success: false,
              error: 'Invalid credentials format',
              errorType: 'CredentialsError',
            });
            continue;
          }

          const result = await this.scrapeAccount({
            scraperType: config.scraper_type as any,
            credentials,
            startDate,
            showBrowser: false,
          });

          if (result.success && result.accounts) {
            const transactionCount = result.accounts.reduce(
              (sum: number, acc: { txns?: any[] }) => sum + (acc.txns?.length || 0),
              0
            );

            console.log(
              config.scraper_type,
              config.friendly_name,
              `Successfully scraped ${transactionCount} transactions`,
              { transactionCount }
            );

            await this.saveScrapedTransactions(result.accounts, config.id);

            const latestDate = this.getLatestTransactionDate(result.accounts);
            if (latestDate) {
              await databaseService.updateLastScrapedTimestamp(
                config.friendly_name,
                latestDate.toISOString()
              );
            }

            await sendNotification({
              title: 'Scraping Complete',
              message: `Successfully scraped ${transactionCount} transactions from ${config.friendly_name}`,
              sound: true,
              wait: false,
            });
          }

          if (!result.success) {
            console.error(
              config.scraper_type,
              config.friendly_name,
              'Failed to scrape transactions',
              {
                error: result.errorMessage,
                errorType: result.errorType,
              }
            );

            await sendNotification({
              title: 'Scraping Failed',
              message: `Failed to scrape ${config.friendly_name}: ${result.errorMessage || 'Unknown error'}`,
              sound: true,
              wait: false,
            });
          }

          results.push({
            scraper: config.scraper_type,
            friendlyName: config.friendly_name,
            success: result.success,
            accounts: result.accounts,
            error: result.errorMessage,
            errorType: result.errorType,
          });
        } catch (error: any) {
          console.error(`Error processing ${config.friendly_name}:`, error);
          results.push({
            scraper: config.scraper_type,
            friendlyName: config.friendly_name,
            success: false,
            error: error.message || 'Unknown error occurred',
            errorType: error.name || 'ScraperError',
          });
        }
      }

      return { success: true, results };
    } catch (error: any) {
      console.error('Error in fetchAllTransactions:', error);
      return {
        success: false,
        results: [
          {
            scraper: 'global',
            friendlyName: 'Global',
            success: false,
            error: error.message || 'Unknown error occurred',
            errorType: error.name || 'GlobalError',
          },
        ],
      };
    }
  }

  /**
   * Scrapes a single account
   */
  private async scrapeAccount(options: {
    scraperType: string;
    credentials: any;
    startDate: Date;
    showBrowser?: boolean;
  }): Promise<ScrapingResult> {
    const { scraperType, credentials, startDate, showBrowser = false } = options;

    try {
      const scraperOptions: ScraperOptions = {
        companyId: scraperType as any,
        startDate,
        showBrowser,
        verbose: false,
        timeout: 60000,
      };

      const scraper = createScraper(scraperOptions);
      const result = await scraper.scrape(credentials);

      return {
        ...result,
        success: result.success,
        errorMessage: result.errorMessage,
        errorType: result.errorType,
      };
    } catch (error: any) {
      console.error(`Error in scrapeAccount for ${scraperType}:`, error);
      return {
        success: false,
        errorMessage: error.message || 'Unknown error occurred',
        errorType: error.name || 'ScraperError',
        error,
      };
    }
  }

  /**
   * Saves scraped transactions to the database
   */
  private async saveScrapedTransactions(
    accounts: Array<{ txns: ScraperTransaction[] }>,
    scraperCredentialId: number
  ): Promise<void> {
    // Process all transactions from all accounts
    const allTransactions = accounts.flatMap(account => account.txns || []);

    for (const tx of allTransactions) {
      try {
        const processedDate = tx.processedDate || tx.date;
        const date = tx.date instanceof Date ? tx.date.toISOString() : tx.date;
        const processedDateStr =
          processedDate instanceof Date ? processedDate.toISOString() : processedDate;

        const transaction = {
          scraper_credential_id: scraperCredentialId,
          identifier:
            tx.identifier?.toString() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: tx.type || 'normal',
          status: tx.status || 'completed',
          date,
          processedDate: processedDateStr,
          originalAmount: tx.originalAmount || tx.chargedAmount || 0,
          originalCurrency: tx.originalCurrency || 'ILS',
          chargedAmount: tx.chargedAmount || 0,
          chargedCurrency: tx.currency || 'ILS',
          description: tx.description || '',
          memo: tx.memo || null,
          category: tx.category || null,
        };

        // Use upsert-like behavior by checking if transaction exists first
        try {
          await databaseService.saveTransaction(transaction);
        } catch (error) {
          // If it fails due to duplicate, that's expected (similar to INSERT OR IGNORE)
          if (error instanceof Error && error.message.includes('duplicate')) {
            console.log(`Transaction ${transaction.identifier} already exists, skipping`);
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }
  }

  /**
   * Gets the latest transaction date from the scraped accounts
   */
  private getLatestTransactionDate(accounts: Array<{ txns: ScraperTransaction[] }>): Date | null {
    let latestDate: Date | null = null;

    for (const account of accounts) {
      for (const tx of account.txns || []) {
        const txDate = tx.date;
        const date = txDate instanceof Date ? txDate : new Date(txDate);

        if (!latestDate || date > latestDate) {
          latestDate = date;
        }
      }
    }

    return latestDate;
  }
}

export const scraperService = ScraperService.getInstance();
