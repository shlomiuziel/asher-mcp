import { Pool } from 'pg';
import { ScraperCredentialRow, TransactionRow } from '../types.js';
import { validateSelectQuery } from '../utils/sqlValidation.js';
import { DatabaseService } from '../interfaces/DatabaseService.js';

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export class PostgreSQLDatabaseService implements DatabaseService {
  private pool: Pool | null = null;
  private static instance: PostgreSQLDatabaseService | null = null;
  private initialized: boolean = false;
  private config: PostgreSQLConfig;

  private constructor(config: PostgreSQLConfig) {
    this.config = config;
  }

  public async databaseExists(): Promise<boolean> {
    try {
      const client = await this.pool?.connect();
      if (!client) return false;
      const result = await client.query('SELECT 1');
      client.release();
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  private ensureReady(): void {
    if (!this.initialized || !this.pool) {
      throw new Error('Database is not initialized. Please call initialize() first.');
    }
  }

  public async initialize(): Promise<Pool> {
    if (this.initialized && this.pool) {
      return this.pool;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();

      // Initialize the database schema
      await this.initializeDatabase();

      this.initialized = true;
      return this.pool;
    } catch (error) {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      this.initialized = false;
      throw error;
    }
  }

  public static getInstance(config: PostgreSQLConfig): PostgreSQLDatabaseService {
    if (!PostgreSQLDatabaseService.instance) {
      PostgreSQLDatabaseService.instance = new PostgreSQLDatabaseService(config);
    }
    return PostgreSQLDatabaseService.instance;
  }

  public static getInstanceFromConnectionString(
    connectionString: string
  ): PostgreSQLDatabaseService {
    if (!PostgreSQLDatabaseService.instance) {
      // Parse connection string to config object
      const url = new URL(connectionString);
      const config: PostgreSQLConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.substring(1), // Remove leading slash
        user: url.username,
        password: url.password,
        ssl:
          url.searchParams.get('sslmode') === 'require' || url.searchParams.get('ssl') === 'true',
      };
      PostgreSQLDatabaseService.instance = new PostgreSQLDatabaseService(config);
    }
    return PostgreSQLDatabaseService.instance;
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS scraper_credentials (
          id SERIAL PRIMARY KEY,
          scraper_type TEXT NOT NULL,
          credentials TEXT NOT NULL,
          last_scraped_timestamp TEXT,
          friendly_name TEXT NOT NULL,
          tags TEXT,
          UNIQUE(scraper_type, friendly_name)
        );

        CREATE TABLE IF NOT EXISTS transactions (
          scraper_credential_id INTEGER NOT NULL,
          identifier TEXT NOT NULL,
          type TEXT,
          status TEXT,
          date TEXT NOT NULL,
          processedDate TEXT NOT NULL,
          originalAmount NUMERIC NOT NULL,
          originalCurrency TEXT NOT NULL,
          chargedAmount NUMERIC NOT NULL,
          chargedCurrency TEXT NOT NULL,
          description TEXT NOT NULL,
          memo TEXT,
          category TEXT,
          PRIMARY KEY (scraper_credential_id, identifier),
          FOREIGN KEY (scraper_credential_id) REFERENCES scraper_credentials(id) ON DELETE CASCADE
        );
      `);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error('Failed to initialize database tables');
    } finally {
      client.release();
    }
  }

  public async deleteScraperCredentials(scraperId: string): Promise<boolean> {
    try {
      this.ensureReady();
      const client = await this.pool!.connect();
      try {
        const result = await client.query('DELETE FROM scraper_credentials WHERE id = $1', [
          scraperId,
        ]);
        return (result.rowCount ?? 0) > 0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to delete scraper credentials:', error);
      return false;
    }
  }

  public async upsertScraperCredential(
    credentials: Omit<
      ScraperCredentialRow,
      'id' | 'createdAt' | 'updatedAt' | 'last_scraped_timestamp'
    >
  ): Promise<number> {
    this.ensureReady();
    const client = await this.pool!.connect();

    try {
      const { scraper_type, credentials: creds, friendly_name, tags } = credentials;
      const tagsJson = typeof tags === 'string' ? tags : JSON.stringify(tags || []);

      const result = await client.query(
        `
        INSERT INTO scraper_credentials (
          scraper_type, 
          credentials, 
          friendly_name, 
          tags
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT(scraper_type, friendly_name) 
        DO UPDATE SET 
          credentials = EXCLUDED.credentials,
          tags = EXCLUDED.tags
        RETURNING id;
      `,
        [scraper_type, creds, friendly_name, tagsJson]
      );

      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  public async getScraperCredentials(): Promise<ScraperCredentialRow[]> {
    this.ensureReady();
    const client = await this.pool!.connect();
    try {
      const result = await client.query('SELECT * FROM scraper_credentials');
      return result.rows as ScraperCredentialRow[];
    } finally {
      client.release();
    }
  }

  public async updateLastScrapedTimestamp(friendlyName: string, timestamp: string): Promise<void> {
    this.ensureReady();
    const client = await this.pool!.connect();
    try {
      await client.query(
        'UPDATE scraper_credentials SET last_scraped_timestamp = $1 WHERE friendly_name = $2',
        [timestamp, friendlyName]
      );
    } finally {
      client.release();
    }
  }

  public async getScraperCredentialByFriendlyName(
    friendlyName: string
  ): Promise<ScraperCredentialRow | null> {
    this.ensureReady();
    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        'SELECT * FROM scraper_credentials WHERE friendly_name = $1',
        [friendlyName]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  public async saveTransaction(
    transaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number> {
    this.ensureReady();
    const client = await this.pool!.connect();

    try {
      await client.query(
        `
        INSERT INTO transactions (
          scraper_credential_id, identifier, type, status, date, processedDate, 
          originalAmount, originalCurrency, chargedAmount, chargedCurrency, 
          description, memo, category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (scraper_credential_id, identifier) DO NOTHING;
      `,
        [
          transaction.scraper_credential_id,
          transaction.identifier,
          transaction.type || null,
          transaction.status || null,
          transaction.date,
          transaction.processedDate,
          transaction.originalAmount,
          transaction.originalCurrency,
          transaction.chargedAmount,
          transaction.chargedCurrency,
          transaction.description,
          transaction.memo || null,
          transaction.category || null,
        ]
      );

      return transaction.scraper_credential_id;
    } finally {
      client.release();
    }
  }

  public async getTransactions(
    scraperCredentialId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionRow[]> {
    this.ensureReady();
    try {
      const client = await this.pool!.connect();
      try {
        let query = 'SELECT * FROM transactions WHERE scraper_credential_id = $1';
        const params: (string | number)[] = [scraperCredentialId];

        if (startDate) {
          query += ' AND date >= $' + (params.length + 1);
          params.push(startDate.toISOString());
        }
        if (endDate) {
          query += ' AND date <= $' + (params.length + 1);
          params.push(endDate.toISOString());
        }

        const result = await client.query(query, params);
        return result.rows as TransactionRow[];
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to get transactions:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }

  public async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const client = await this.pool!.connect();
      try {
        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Query failed:', query, error);
      throw error;
    }
  }

  public async listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      const client = await this.pool!.connect();
      try {
        const result = await client.query(`
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public'
        `);

        const tables = result.rows.map((row: { tablename: string }) => row.tablename);
        return { success: true, tables };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tables',
      };
    }
  }

  public async executeSafeSelectQuery(
    query: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const validation = validateSelectQuery(query);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    try {
      const client = await this.pool!.connect();
      try {
        const result = await client.query(query);
        return { success: true, data: result.rows };
      } finally {
        client.release();
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing query',
      };
    }
  }

  public async execute(
    query: string,
    params: any[] = []
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
  }> {
    try {
      const client = await this.pool!.connect();
      try {
        const result = await client.query(query, params);
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id || 0,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Execute failed:', query, error);
      throw error;
    }
  }
}
