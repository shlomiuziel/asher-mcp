import israeliBankScrapers from 'israeli-bank-scrapers';
const { createScraper, CompanyTypes } = israeliBankScrapers;
import type { ScraperOptions } from 'israeli-bank-scrapers';
import { getDatabaseService } from './database';

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
  constructor() {}

  public getAvailableScrapers(): string[] {
    return Object.entries(CompanyTypes)
      .filter(([key]) => isNaN(Number(key)))
      .map(([key]) => key);
  }

  public async fetchAllTransactions(): Promise<{
    success: boolean;
    results: Array<{
      scraper: string;
      friendlyName: string;
      success: boolean;
      accounts?: unknown[];
      error?: string;
      errorType?: string;
    }>;
  }> {
    try {
      const databaseService = getDatabaseService();
      
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

      const results = [];

      if (!scraperConfigs.length) {
        console.log('No configured scrapers found');
        throw new Error('No configured scrapers found');
      }

      for (const config of scraperConfigs) {
        try {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          const startDate = config.last_scraped_timestamp
            ? new Date(new Date(config.last_scraped_timestamp).getTime() + 1000)
            : oneYearAgo;

          let credentials: unknown;
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
            scraperType: config.scraper_type,
            credentials,
            startDate,
            showBrowser: false,
          });

          if (result.success && result.accounts) {
            const transactionCount = (result.accounts as { txns?: unknown[] }[]).reduce(
              (sum: number, acc) => sum + (acc.txns?.length || 0),
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
          }

          results.push({
            scraper: config.scraper_type,
            friendlyName: config.friendly_name,
            success: result.success,
            accounts: result.accounts,
            error: result.errorMessage,
            errorType: result.errorType,
          });
        } catch (error: unknown) {
          console.error(`Error processing ${config.friendly_name}:`, error);
          results.push({
            scraper: config.scraper_type,
            friendlyName: config.friendly_name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            errorType: error instanceof Error ? error.name : 'ScraperError',
          });
        }
      }

      return { success: true, results };
    } catch (error: unknown) {
      console.error('Error in fetchAllTransactions:', error);
      return {
        success: false,
        results: [
          {
            scraper: 'global',
            friendlyName: 'Global',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            errorType: error instanceof Error ? error.name : 'GlobalError',
          },
        ],
      };
    }
  }

  private async scrapeAccount(options: {
    scraperType: string;
    credentials: unknown;
    startDate: Date;
    showBrowser?: boolean;
  }): Promise<ScrapingResult> {
    const { scraperType, credentials, startDate, showBrowser = false } = options;

    try {
      const scraperOptions: ScraperOptions = {
        companyId: CompanyTypes[scraperType as keyof typeof CompanyTypes],
        startDate,
        showBrowser,
        verbose: false,
        timeout: 60000,
      };

      const scraper = createScraper(scraperOptions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await scraper.scrape(credentials as any);

      return {
        ...result,
        success: result.success,
        errorMessage: result.errorMessage,
        errorType: result.errorType,
      };
    } catch (error: unknown) {
      console.error(`Error in scrapeAccount for ${scraperType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorType = error instanceof Error ? error.name : 'ScraperError';
      return {
        success: false,
        errorMessage,
        errorType,
        error: error instanceof Error ? error : undefined,
      };
    }
  }

  private async saveScrapedTransactions(
    accounts: Array<{ txns: ScraperTransaction[] }>,
    scraperCredentialId: number
  ): Promise<void> {
    const databaseService = getDatabaseService();
    const allTransactions = accounts.flatMap(account => account.txns || []);

    for (const tx of allTransactions) {
      try {
        const processedDate = tx.processedDate || tx.date;
        const date = tx.date instanceof Date ? tx.date.toISOString() : tx.date;
        const processedDateStr =
          processedDate instanceof Date ? processedDate.toISOString() : processedDate;

        const transaction = {
          scraperCredentialId,
          uniqueTransactionId: `${scraperCredentialId}-${tx.identifier?.toString() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`}`,
          date,
          processedDate: processedDateStr,
          originalAmount: tx.originalAmount || tx.chargedAmount || 0,
          originalCurrency: tx.originalCurrency || 'ILS',
          chargeAmount: tx.chargedAmount || 0,
          description: tx.description || '',
          memo: tx.memo || null,
          category: tx.category || null,
          originalCategory: tx.category || null,
          accountName: 'default',
          identifier: tx.identifier?.toString() || '',
        };

        await databaseService.saveTransaction(transaction);
      } catch (error) {
        if (error instanceof Error && error.message.includes('duplicate')) {
          console.log(`Transaction ${tx.identifier} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }

  private getLatestTransactionDate(
    accounts: Array<{ txns: ScraperTransaction[] }>
  ): Date | null {
    let latestDate: Date | null = null;

    for (const account of accounts) {
      for (const tx of account.txns || []) {
        const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
        if (!latestDate || txDate > latestDate) {
          latestDate = txDate;
        }
      }
    }

    return latestDate;
  }
}

let scraperInstance: ScraperService | null = null;

export function getScraperService(): ScraperService {
  if (!scraperInstance) {
    scraperInstance = new ScraperService();
  }
  return scraperInstance;
}