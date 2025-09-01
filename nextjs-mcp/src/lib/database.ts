import { sql } from '@vercel/postgres';
import { ScraperCredentialRow, TransactionRow } from '../types';

export interface DatabaseService {
  databaseExists(): Promise<boolean>;
  initialize(): Promise<unknown>;
  close(): Promise<void>;

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

  saveTransaction(
    transaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number>;
  getTransactions(
    scraperCredentialId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionRow[]>;

  query<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
  execute(
    query: string,
    params?: unknown[]
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
  }>;

  listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }>;
  executeSafeSelectQuery(query: string, params?: unknown[]): Promise<{ success: boolean; data?: unknown; error?: string }>;
}

class VercelPostgresDatabaseService implements DatabaseService {
  async databaseExists(): Promise<boolean> {
    try {
      await sql`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<unknown> {
    // Vercel Postgres handles initialization automatically
    return true;
  }

  async close(): Promise<void> {
    // Vercel Postgres handles connection pooling automatically
  }

  async deleteScraperCredentials(scraperId: string): Promise<boolean> {
    try {
      const result = await sql`DELETE FROM scraper_credentials WHERE scraper_id = ${scraperId}`;
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting scraper credentials:', error);
      return false;
    }
  }

  async upsertScraperCredential(
    credentials: Omit<
      ScraperCredentialRow,
      'id' | 'createdAt' | 'updatedAt' | 'last_scraped_timestamp'
    >
  ): Promise<number> {
    const result = await sql`
      INSERT INTO scraper_credentials (scraper_id, friendly_name, encrypted_credentials)
      VALUES (${credentials.scraperId}, ${credentials.friendlyName}, ${credentials.encryptedCredentials})
      ON CONFLICT (scraper_id) 
      DO UPDATE SET 
        friendly_name = ${credentials.friendlyName},
        encrypted_credentials = ${credentials.encryptedCredentials},
        updated_at = NOW()
      RETURNING id
    `;
    return result.rows[0].id;
  }

  async getScraperCredentials(): Promise<ScraperCredentialRow[]> {
    const result = await sql`SELECT * FROM scraper_credentials ORDER BY friendly_name`;
    return result.rows as ScraperCredentialRow[];
  }

  async updateLastScrapedTimestamp(friendlyName: string, timestamp: string): Promise<void> {
    await sql`
      UPDATE scraper_credentials 
      SET last_scraped_timestamp = ${timestamp}, updated_at = NOW()
      WHERE friendly_name = ${friendlyName}
    `;
  }

  async getScraperCredentialByFriendlyName(friendlyName: string): Promise<ScraperCredentialRow | null> {
    const result = await sql`
      SELECT * FROM scraper_credentials WHERE friendly_name = ${friendlyName}
    `;
    return result.rows[0] as ScraperCredentialRow || null;
  }

  async saveTransaction(
    transaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number> {
    const result = await sql`
      INSERT INTO transactions (
        scraper_credential_id, unique_transaction_id, date, processed_date, 
        original_amount, original_currency, charge_amount, description, memo, 
        category, original_category, account_name, identifier
      ) VALUES (
        ${transaction.scraperCredentialId}, ${transaction.uniqueTransactionId},
        ${transaction.date}, ${transaction.processedDate}, ${transaction.originalAmount},
        ${transaction.originalCurrency}, ${transaction.chargeAmount}, ${transaction.description},
        ${transaction.memo}, ${transaction.category}, ${transaction.originalCategory},
        ${transaction.accountName}, ${transaction.identifier}
      )
      ON CONFLICT (unique_transaction_id) DO NOTHING
      RETURNING id
    `;
    return result.rows[0]?.id || 0;
  }

  async getTransactions(
    scraperCredentialId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionRow[]> {
    const params: unknown[] = [scraperCredentialId];
    let queryText = 'SELECT * FROM transactions WHERE scraper_credential_id = $1';
    
    if (startDate) {
      params.push(startDate.toISOString());
      queryText += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate.toISOString());
      queryText += ` AND date <= $${params.length}`;
    }
    
    queryText += ' ORDER BY date DESC';
    
    const result = await sql.query(queryText, params);
    return result.rows as TransactionRow[];
  }

  async query<T = unknown>(query: string, params?: unknown[]): Promise<T[]> {
    const result = await sql.query(query, params);
    return result.rows as T[];
  }

  async execute(
    query: string,
    params?: unknown[]
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
  }> {
    const result = await sql.query(query, params);
    return {
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id || 0,
    };
  }

  async listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      const result = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      const tables = result.rows.map(row => row.table_name);
      return { success: true, tables };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  async executeSafeSelectQuery(query: string, params?: unknown[]): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      if (!query.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
      }
      
      const result = await sql.query(query, params);
      return { success: true, data: result.rows };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }
}

let databaseInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseInstance) {
    databaseInstance = new VercelPostgresDatabaseService();
  }
  return databaseInstance;
}