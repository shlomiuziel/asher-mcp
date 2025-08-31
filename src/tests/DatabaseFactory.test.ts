import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseFactory, DatabaseConfig } from '../services/DatabaseFactory.js';

// Mock both database services
vi.mock('../services/DatabaseService.js', () => ({
  SQLiteDatabaseService: {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn(),
      close: vi.fn(),
    }),
  },
}));

vi.mock('../services/PostgreSQLDatabaseService.js', () => ({
  PostgreSQLDatabaseService: {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn(),
      close: vi.fn(),
    }),
  },
}));

describe('DatabaseFactory', () => {
  beforeEach(async () => {
    await DatabaseFactory.resetInstance();
    vi.clearAllMocks();
    delete process.env.DB_TYPE;
  });

  afterEach(async () => {
    await DatabaseFactory.resetInstance();
  });

  it('should create SQLite service by default', () => {
    const service = DatabaseFactory.createDatabaseService();
    expect(service).toBeDefined();
  });

  it('should create SQLite service when explicitly configured', () => {
    const config: DatabaseConfig = { type: 'sqlite' };
    const service = DatabaseFactory.createDatabaseService(config);
    expect(service).toBeDefined();
  });

  it('should create PostgreSQL service when configured', () => {
    const config: DatabaseConfig = {
      type: 'postgresql',
      postgresql: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      },
    };
    const service = DatabaseFactory.createDatabaseService(config);
    expect(service).toBeDefined();
  });

  it('should use environment variables for PostgreSQL config', () => {
    process.env.DB_TYPE = 'postgresql';
    process.env.DB_HOST = 'testhost';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpass';

    const service = DatabaseFactory.createDatabaseService();
    expect(service).toBeDefined();
  });

  it('should return singleton instance', () => {
    const instance1 = DatabaseFactory.getInstance();
    const instance2 = DatabaseFactory.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should throw error for unsupported database type', () => {
    const config = { type: 'unsupported' as any };
    expect(() => DatabaseFactory.createDatabaseService(config)).toThrow(
      'Unsupported database type'
    );
  });
});
