import Database from 'better-sqlite3-multiple-ciphers';
import { ScraperCredentialRow, TransactionRow } from '../types.js';
import { existsSync, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { validateSelectQuery } from '../utils/sqlValidation.js';
import { encryptionKeyService } from './EncryptionKeyService.js';
import { DatabaseService as DatabaseServiceInterface } from '../interfaces/DatabaseService.js';

// Cross-platform app data directory
function getAppDataPath() {
  const home = homedir();

  switch (process.platform) {
    case 'win32':
      return process.env.APPDATA || join(home, 'AppData', 'Roaming');
    case 'darwin':
      return join(home, 'Library', 'Application Support');
    default:
      return process.env.XDG_DATA_HOME || join(home, '.local', 'share');
  }
}

export class SQLiteDatabaseService implements DatabaseServiceInterface {
  private db: Database | null = null;
  private static instance: SQLiteDatabaseService | null = null;
  private initialized: boolean = false;
  private dbPath: string;
  private static getDefaultDbPath(): string {
    const appDataDir = join(getAppDataPath(), 'Asher');
    const dbPath = join(appDataDir, 'transactions.db');

    // Ensure the directory exists
    if (!existsSync(appDataDir)) {
      mkdirSync(appDataDir, { recursive: true });
    }

    return dbPath;
  }

  private constructor(dbPath: string) {
    this.dbPath = dbPath || SQLiteDatabaseService.getDefaultDbPath();

    // Ensure the directory exists for the custom path if provided
    if (dbPath) {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Check if the database file exists
   */
  public async databaseExists(): Promise<boolean> {
    return existsSync(this.dbPath);
  }

  /**
   * Checks if the database is properly set up and ready for use
   * @throws {Error} If the database is not properly set up
   */
  private ensureReady(): void {
    if (!this.initialized || !this.db) {
      throw new Error('Database is not initialized. Please call initialize() first.');
    }
  }

  private async applyEncryption(db: Database, isNewDatabase: boolean): Promise<void> {
    const key = await encryptionKeyService.ensureKeyIsAvailable();

    try {
      db.pragma(`cipher='sqlcipher'`);
      db.pragma(`legacy=4`);
      db.pragma(`${isNewDatabase ? 'rekey' : 'key'}='${key}'`);
      // Basic check — try accessing the schema
      console.log(db.prepare('PRAGMA schema_version').get());
    } catch (error) {
      encryptionKeyService.clearKey();
      db.close();
      throw new Error(
        `${error instanceof Error ? error.message : 'Unknown error'}, incorrect key?`
      );
    }
  }

  /**
   * Initializes the database connection and sets up the schema if needed
   * @returns The initialized database instance
   */
  public async initialize(): Promise<Database> {
    if (this.initialized && this.db) {
      return this.db;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    const isNewDatabase = !(await this.databaseExists());

    // Create a new database connection
    const db = new Database(this.dbPath);

    // If this is a new database, set restrictive permissions
    if (isNewDatabase) {
      try {
        // 0o600 = rw------- (read/write for owner only)
        chmodSync(this.dbPath, 0o600);
      } catch (error) {
        db.close();
        throw new Error(
          `Failed to set database file permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    await this.applyEncryption(db, isNewDatabase);

    this.db = db;

    try {
      // Initialize the database schema
      this.initializeDatabase();

      // Mark as initialized
      this.initialized = true;

      return db;
    } catch (error) {
      // If initialization fails, clean up
      this.db.close();
      this.db = null;
      this.initialized = false;
      throw error;
    }
  }

  public static getInstance(dbPath?: string): SQLiteDatabaseService {
    // If no path provided, use the default one
    const pathToUse = dbPath || SQLiteDatabaseService.getDefaultDbPath();

    // If we have an instance but it's for a different path, reset it
    if (SQLiteDatabaseService.instance && SQLiteDatabaseService.instance.dbPath !== pathToUse) {
      SQLiteDatabaseService.instance.close().catch(console.error);
      SQLiteDatabaseService.instance = null;
    }

    if (!SQLiteDatabaseService.instance) {
      SQLiteDatabaseService.instance = new SQLiteDatabaseService(pathToUse);
    }

    return SQLiteDatabaseService.instance;
  }

  private assertInitialized(): Database {
    if (!this.initialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  private initializeDatabase(): void {
    const db = this.db;

    // This should never happen because we check in the caller, but TypeScript needs this
    if (!db) {
      throw new Error('Database connection not established');
    }

    // Enable foreign key support
    db.pragma('foreign_keys = ON');

    try {
      // Create tables if they don't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS scraper_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
          originalAmount REAL NOT NULL,
          originalCurrency TEXT NOT NULL,
          chargedAmount REAL NOT NULL,
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
    }
  }

  // Scraper credentials methods
  public async deleteScraperCredentials(scraperId: string): Promise<boolean> {
    try {
      this.ensureReady();
      const db = this.assertInitialized();
      const stmt = db.prepare('DELETE FROM scraper_credentials WHERE id = ?');
      const result = stmt.run(scraperId);
      return result.changes > 0;
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
    const db = this.assertInitialized();

    const stmt = db.prepare(`
      INSERT INTO scraper_credentials (
        scraper_type, 
        credentials, 
        friendly_name, 
        tags
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(scraper_type, friendly_name) 
      DO UPDATE SET 
        credentials = excluded.credentials,
        tags = excluded.tags
      RETURNING id;
    `);

    const { scraper_type, credentials: creds, friendly_name, tags } = credentials;
    const tagsJson = typeof tags === 'string' ? tags : JSON.stringify(tags || []);

    const result = stmt.get(scraper_type, creds, friendly_name, tagsJson) as { id: number };

    return result.id;
  }

  public async getScraperCredentials(): Promise<ScraperCredentialRow[]> {
    this.ensureReady();
    const db = this.assertInitialized();
    const stmt = db.prepare('SELECT * FROM scraper_credentials');
    return stmt.all() as ScraperCredentialRow[];
  }

  public async updateLastScrapedTimestamp(friendlyName: string, timestamp: string): Promise<void> {
    this.ensureReady();
    const db = this.assertInitialized();
    const stmt = db.prepare(
      'UPDATE scraper_credentials SET last_scraped_timestamp = ? WHERE friendly_name = ?'
    );
    stmt.run(timestamp, friendlyName);
  }

  public async getScraperCredentialByFriendlyName(
    friendlyName: string
  ): Promise<ScraperCredentialRow | null> {
    this.ensureReady();
    const db = this.assertInitialized();
    const stmt = db.prepare('SELECT * FROM scraper_credentials WHERE friendly_name = ?');
    return (stmt.get(friendlyName) as ScraperCredentialRow) || null;
  }

  // Transaction methods
  public async saveTransaction(
    transaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number> {
    this.ensureReady();
    const db = this.assertInitialized();

    const stmt = db.prepare(`
      INSERT INTO transactions (
        scraper_credential_id, identifier, type, status, date, processedDate, 
        originalAmount, originalCurrency, chargedAmount, chargedCurrency, 
        description, memo, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id;
    `);

    const result = stmt.get(
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
      transaction.category || null
    ) as { id: number };

    return result.id;
  }

  public async getTransactions(
    scraperCredentialId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionRow[]> {
    this.ensureReady();
    try {
      const db = this.assertInitialized();
      let query = 'SELECT * FROM transactions WHERE scraper_credential_id = ?';
      const params: (string | number)[] = [scraperCredentialId];

      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate.toISOString());
      }
      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate.toISOString());
      }

      const stmt = db.prepare(query);
      return stmt.all(...params) as TransactionRow[];
    } catch (error) {
      console.error('Failed to get transactions:', error);
      throw error; // Let the caller handle the error
    }
  }

  public close(): Promise<void> {
    return new Promise(resolve => {
      const db = this.assertInitialized();
      db.close();
      this.db = null;
      this.initialized = false;
      resolve();
    });
  }

  /**
   * Execute a raw SQL query
   * @param query SQL query string
   * @param params Optional parameters for prepared statements
   * @returns Query results
   */
  public async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const db = this.assertInitialized();
      const stmt = db.prepare(query);
      return params.length > 0 ? stmt.all(...params) : stmt.all();
    } catch (error) {
      console.error('Query failed:', query, error);
      throw error;
    }
  }

  /**
   * Executes a validated SELECT query
   * @param query The SQL query to execute
   * @returns The query result or an error object
   */
  /**
   * Lists all user tables in the database
   * @returns Object containing success status and table names or error message
   */
  public async listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      const db = this.assertInitialized();
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all();

      const tables = rows.map((row: { name: string }) => row.name);
      return { success: true, tables };
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
    // First, validate the query
    const validation = validateSelectQuery(query);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    try {
      const db = this.db as any as Database;

      // Execute the query
      const result = db.prepare(query).all();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing query',
      };
    }
  }

  /**
   * Execute a write operation (INSERT/UPDATE/DELETE)
   * @param query SQL query string
   * @param params Parameters for prepared statement
   * @returns Result object with changes and lastID
   */
  public async execute(
    query: string,
    params: any[] = []
  ): Promise<{
    changes: number;
    lastInsertRowid: number | bigint;
  }> {
    try {
      const db = this.assertInitialized();
      const stmt = db.prepare(query);
      const result = params.length > 0 ? stmt.run(...params) : stmt.run();
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      console.error('Execute failed:', query, error);
      throw error;
    }
  }
}

export function getDbInstance(path?: string) {
  return SQLiteDatabaseService.getInstance(path);
}
