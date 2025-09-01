import { DatabaseService } from '../interfaces/DatabaseService.js';
import { SQLiteDatabaseService } from './DatabaseService.js';
import { PostgreSQLDatabaseService, PostgreSQLConfig } from './PostgreSQLDatabaseService.js';

export type DatabaseType = 'sqlite' | 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  sqlite?: {
    path?: string;
  };
  postgresql?: PostgreSQLConfig;
}

export class DatabaseFactory {
  private static instance: DatabaseService | null = null;

  private static inferDatabaseTypeFromUrl(url: string): DatabaseType {
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      return 'postgresql';
    }
    if (url.startsWith('sqlite://') || url.includes('.db') || url.includes('.sqlite')) {
      return 'sqlite';
    }
    // Default to sqlite for file paths
    return 'sqlite';
  }

  public static createDatabaseService(config?: DatabaseConfig): DatabaseService {
    let dbType: DatabaseType;

    // First check if DATABASE_URL exists and infer type
    if (process.env.DATABASE_URL) {
      dbType = DatabaseFactory.inferDatabaseTypeFromUrl(process.env.DATABASE_URL);
    } else {
      dbType = config?.type || 'sqlite';
    }

    switch (dbType) {
      case 'sqlite':
        // If DATABASE_URL is an SQLite path, use it
        if (process.env.DATABASE_URL && dbType === 'sqlite') {
          const sqlitePath = process.env.DATABASE_URL.replace('sqlite://', '');
          return SQLiteDatabaseService.getInstance(sqlitePath);
        }
        return SQLiteDatabaseService.getInstance(config?.sqlite?.path);

      case 'postgresql':
        if (process.env.DATABASE_URL) {
          return PostgreSQLDatabaseService.getInstanceFromConnectionString(
            process.env.DATABASE_URL
          );
        }
        if (!config?.postgresql) {
          const pgConfig: PostgreSQLConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'asher',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            ssl: process.env.DB_SSL === 'true',
          };
          return PostgreSQLDatabaseService.getInstance(pgConfig);
        }
        return PostgreSQLDatabaseService.getInstance(config.postgresql);

      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  public static getInstance(config?: DatabaseConfig): DatabaseService {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = DatabaseFactory.createDatabaseService(config);
    }
    return DatabaseFactory.instance;
  }

  public static async resetInstance(): Promise<void> {
    if (DatabaseFactory.instance) {
      await DatabaseFactory.instance.close();
      DatabaseFactory.instance = null;
    }
  }
}
