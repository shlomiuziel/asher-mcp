import { ScraperCredentialRow, TransactionRow } from '../types.js';

export interface DatabaseService {
  databaseExists(): Promise<boolean>;
  initialize(): Promise<any>;
  close(): Promise<void>;

  // Scraper credentials methods
  deleteScraperCredentials(scraperId: string): Promise<boolean>;
  upsertScraperCredential(
    credentials: Omit<
      ScraperCredentialRow,
      'id' | 'createdAt' | 'updatedAt' | 'last_scraped_timestamp'
    >
  ): Promise<number>;
  getScraperCredentials(): Promise<ScraperCredentialRow[]>;
  updateLastScrapedTimestamp(friendlyName: string, timestamp: string): Promise<void>;
  getScraperCredentialByFriendlyName(friendlyName: string): Promise<ScraperCredentialRow | null>;

  // Transaction methods
  saveTransaction(
    transaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number>;
  getTransactions(
    scraperCredentialId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionRow[]>;

  // Query methods
  query<T = any>(query: string, params?: any[]): Promise<T[]>;
  execute(
    query: string,
    params?: any[]
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
  }>;

  // Utility methods
  listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }>;
  executeSafeSelectQuery(query: string): Promise<{ success: boolean; data?: any; error?: string }>;
}
