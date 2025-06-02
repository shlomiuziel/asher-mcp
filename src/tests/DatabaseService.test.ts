import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransactionRow } from '../types.js';

class MockDatabaseService {
  initialize = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  upsertScraperCredential = vi.fn().mockResolvedValue(1);
  getScraperCredentials = vi.fn().mockResolvedValue([]);
  getScraperCredentialByFriendlyName = vi.fn().mockResolvedValue(null);
  updateLastScrapedTimestamp = vi.fn().mockResolvedValue(undefined);
  deleteScraperCredentials = vi.fn().mockResolvedValue(true);
  saveTransaction = vi.fn().mockResolvedValue(1);
  getTransactions = vi.fn().mockResolvedValue([]);
  query = vi.fn().mockResolvedValue([]);
  execute = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });
}

const mockDbService = new MockDatabaseService();

vi.mock('../services/EncryptionKeyService.js', () => ({
  encryptionKeyService: {
    getKey: vi.fn().mockReturnValue('test-encryption-key'),
    setKey: vi.fn().mockResolvedValue(undefined),
    ensureKeyIsAvailable: vi.fn().mockResolvedValue(undefined),
    clearKey: vi.fn().mockReturnValue(undefined),
  },
}));

vi.mock('../services/DatabaseService.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(() => mockDbService),
  },
}));

// Import after setting up mocks
import { DatabaseService } from '../services/DatabaseService.js';

describe('DatabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDbService.initialize.mockResolvedValue(undefined);
    mockDbService.close.mockResolvedValue(undefined);
    mockDbService.upsertScraperCredential.mockResolvedValue(1);
    mockDbService.getScraperCredentials.mockResolvedValue([]);
    mockDbService.deleteScraperCredentials.mockResolvedValue(true);
    mockDbService.saveTransaction.mockResolvedValue(1);
    mockDbService.getTransactions.mockResolvedValue([]);
    mockDbService.execute.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });
    mockDbService.query.mockResolvedValue([]);
    mockDbService.updateLastScrapedTimestamp.mockResolvedValue(undefined);
    mockDbService.getScraperCredentialByFriendlyName.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scraper_credentials table', () => {
    it('should get scraper credentials', async () => {
      const mockCredentials = [
        {
          id: 1,
          scraper_type: 'hapoalim',
          credentials: JSON.stringify({ userCode: 'test', password: 'test' }),
          friendly_name: 'Test Account',
          tags: JSON.stringify(['checking', 'primary']),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          last_scraped_timestamp: null,
        },
      ];

      mockDbService.getScraperCredentials.mockResolvedValueOnce(mockCredentials);

      const db = DatabaseService.getInstance();
      const credentials = await db.getScraperCredentials();

      expect(credentials).toEqual(mockCredentials);
      expect(mockDbService.getScraperCredentials).toHaveBeenCalledTimes(1);
    });

    it('should get scraper credential by friendly name', async () => {
      const mockCredential = {
        id: 1,
        scraper_type: 'hapoalim',
        credentials: JSON.stringify({ userCode: 'test', password: 'test' }),
        friendly_name: 'Test Account',
        tags: JSON.stringify(['checking', 'primary']),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        last_scraped_timestamp: null,
      };

      mockDbService.getScraperCredentialByFriendlyName.mockResolvedValueOnce(mockCredential);

      const db = DatabaseService.getInstance();
      const credential = await db.getScraperCredentialByFriendlyName('Test Account');

      expect(credential).toEqual(mockCredential);
      expect(mockDbService.getScraperCredentialByFriendlyName).toHaveBeenCalledWith('Test Account');
    });

    it('should update last scraped timestamp', async () => {
      const friendlyName = 'Test Account';
      const timestamp = new Date().toISOString();

      const db = DatabaseService.getInstance();
      await db.updateLastScrapedTimestamp(friendlyName, timestamp);

      expect(mockDbService.updateLastScrapedTimestamp).toHaveBeenCalledWith(
        friendlyName,
        timestamp
      );
    });

    it('should delete scraper credentials', async () => {
      const scraperId = '1';
      mockDbService.deleteScraperCredentials.mockResolvedValueOnce(true);

      const db = DatabaseService.getInstance();
      const result = await db.deleteScraperCredentials(scraperId);

      expect(result).toBe(true);
      expect(mockDbService.deleteScraperCredentials).toHaveBeenCalledWith(scraperId);
    });

    it('should upsert scraper credential', async () => {
      const credential = {
        scraper_type: 'hapoalim',
        credentials: JSON.stringify({ userCode: 'test', password: 'test' }),
        friendly_name: 'Test Account',
        tags: JSON.stringify(['checking', 'primary']),
      };
      const credentialId = 1;
      mockDbService.upsertScraperCredential.mockResolvedValueOnce(credentialId);

      const db = DatabaseService.getInstance();
      const result = await db.upsertScraperCredential(credential);

      expect(result).toBe(credentialId);
      expect(mockDbService.upsertScraperCredential).toHaveBeenCalledWith(credential);
    });
  });

  describe('transactions', () => {
    const testCredentialId = 1;

    it('should get transactions by credential ID', async () => {
      const mockTransactions = [
        {
          scraper_credential_id: testCredentialId,
          identifier: 'tx-1',
          type: 'normal',
          status: 'completed',
          date: '2025-05-24T10:00:00.000Z',
          processedDate: '2025-05-24T10:00:00.000Z',
          originalAmount: 100,
          originalCurrency: 'ILS',
          chargedAmount: 100,
          chargedCurrency: 'ILS',
          description: 'Test Transaction',
          memo: 'Test Memo',
          category: 'Test Category',
        },
      ];

      mockDbService.getTransactions.mockResolvedValueOnce(mockTransactions);

      const db = DatabaseService.getInstance();
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      const transactions = await db.getTransactions(testCredentialId, startDate, endDate);

      expect(transactions).toEqual(mockTransactions);
      expect(mockDbService.getTransactions).toHaveBeenCalledWith(
        testCredentialId,
        startDate,
        endDate
      );
    });

    it('should handle empty transactions', async () => {
      mockDbService.getTransactions.mockResolvedValueOnce([]);

      const db = DatabaseService.getInstance();
      const transactions = await db.getTransactions(testCredentialId, undefined, undefined);

      expect(transactions).toEqual([]);
      expect(mockDbService.getTransactions).toHaveBeenCalledWith(
        testCredentialId,
        undefined,
        undefined
      );
    });

    it('should get transactions within date range', async () => {
      const mockTransactions = [
        {
          scraper_credential_id: testCredentialId,
          identifier: 'tx-2',
          type: 'normal',
          status: 'completed',
          date: '2025-05-24T10:00:00.000Z',
          processedDate: '2025-05-24T10:00:00.000Z',
          originalAmount: 200,
          originalCurrency: 'ILS',
          chargedAmount: 200,
          chargedCurrency: 'ILS',
          description: 'Test Transaction 2',
          memo: 'Test Memo 2',
          category: 'Test Category 2',
        },
      ];

      mockDbService.getTransactions.mockResolvedValueOnce(mockTransactions);

      const db = DatabaseService.getInstance();
      const startDate = new Date('2025-05-24T00:00:00.000Z');
      const endDate = new Date('2025-05-24T23:59:59.999Z');
      const transactions = await db.getTransactions(testCredentialId, startDate, endDate);

      expect(transactions).toEqual(mockTransactions);
      expect(mockDbService.getTransactions).toHaveBeenCalledWith(
        testCredentialId,
        startDate,
        endDate
      );
    });

    it('should save transaction', async () => {
      const testTransaction: Omit<TransactionRow, 'id' | 'createdAt' | 'updatedAt'> = {
        scraper_credential_id: testCredentialId,
        identifier: 'new-tx',
        type: 'normal',
        status: 'completed',
        date: '2025-05-24T10:00:00.000Z',
        processedDate: '2025-05-24T10:00:00.000Z',
        originalAmount: 100,
        originalCurrency: 'ILS',
        chargedAmount: 100,
        chargedCurrency: 'ILS',
        description: 'New Transaction',
        memo: 'Test New',
        category: 'Test Category',
      };

      mockDbService.saveTransaction.mockResolvedValueOnce(3);

      const db = DatabaseService.getInstance();
      const result = await db.saveTransaction(testTransaction);

      expect(result).toBe(3);
      expect(mockDbService.saveTransaction).toHaveBeenCalledWith(testTransaction);
    });
  });
});
