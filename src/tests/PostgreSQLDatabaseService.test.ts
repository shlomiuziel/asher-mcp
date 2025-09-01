import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  PostgreSQLDatabaseService,
  PostgreSQLConfig,
} from '../services/PostgreSQLDatabaseService.js';

// Mock pg module
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('PostgreSQLDatabaseService', () => {
  let dbService: PostgreSQLDatabaseService;
  const testConfig: PostgreSQLConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_asher',
    user: 'test_user',
    password: 'test_password',
  };

  beforeAll(() => {
    dbService = PostgreSQLDatabaseService.getInstance(testConfig);
  });

  afterAll(async () => {
    await dbService.close();
  });

  it('should create instance with config', () => {
    expect(dbService).toBeInstanceOf(PostgreSQLDatabaseService);
  });

  it('should initialize successfully', async () => {
    await expect(dbService.initialize()).resolves.toBeDefined();
  });

  it('should return singleton instance', () => {
    const instance1 = PostgreSQLDatabaseService.getInstance(testConfig);
    const instance2 = PostgreSQLDatabaseService.getInstance(testConfig);
    expect(instance1).toBe(instance2);
  });

  it('should implement DatabaseService interface', () => {
    expect(dbService.databaseExists).toBeDefined();
    expect(dbService.initialize).toBeDefined();
    expect(dbService.close).toBeDefined();
    expect(dbService.query).toBeDefined();
    expect(dbService.execute).toBeDefined();
    expect(dbService.getScraperCredentials).toBeDefined();
    expect(dbService.saveTransaction).toBeDefined();
  });
});
