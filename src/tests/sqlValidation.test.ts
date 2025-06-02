import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateSelectQuery } from '../utils/sqlValidation.js';
import { DatabaseService } from '../services/DatabaseService.js';

describe('SQL Validation', () => {
  let mockDb: any;

  beforeEach(() => {
    // Create a mock database with a simple query method
    mockDb = {
      prepare: vi.fn().mockImplementation(() => ({
        all: vi.fn().mockReturnValue([{ id: 1, amount: 100 }])
      }))
    };
  });

  describe('validateSelectQuery', () => {
    it('should validate a simple SELECT query', () => {
      const result = validateSelectQuery('SELECT * FROM transactions');
      expect(result).toEqual({ valid: true });
    });

    it('should reject non-string input', () => {
      // @ts-expect-error - Testing invalid input type
      const result = validateSelectQuery(123);
      expect(result).toEqual({
        valid: false,
        reason: 'Query must be a string'
      });
    });

    it('should reject empty queries', () => {
      const result = validateSelectQuery('   ');
      expect(result).toEqual({
        valid: false,
        reason: 'Empty query'
      });
    });

    it('should reject multiple statements', () => {
      const result = validateSelectQuery('SELECT * FROM transactions; SELECT * FROM scraper_credentials');
      expect(result).toEqual({
        valid: false,
        reason: 'Multiple statements are not allowed'
      });
    });

    it('should allow semicolons in string literals', () => {
      const result = validateSelectQuery(`SELECT * FROM transactions WHERE note = 'This is a note with ; semicolon'`);
      expect(result).toEqual({ valid: true });
    });

    it('should allow semicolons in double-quoted strings', () => {
      const result = validateSelectQuery(`SELECT * FROM transactions WHERE note = "This is a note with ; semicolon"`);
      expect(result).toEqual({ valid: true });
    });

    describe('PRAGMA statements', () => {
      it('should allow PRAGMA table_info for allowed tables', () => {
        const result = validateSelectQuery('PRAGMA table_info(transactions)');
        expect(result).toEqual({ valid: true });
      });

      it('should allow PRAGMA index_list for allowed tables', () => {
        const result = validateSelectQuery('PRAGMA index_list(scraper_credentials)');
        expect(result).toEqual({ valid: true });
      });

      it('should reject PRAGMA for non-allowed tables', () => {
        const result = validateSelectQuery('PRAGMA table_info(users)');
        expect(result).toEqual({
          valid: false,
          reason: 'Access to table not allowed in PRAGMA: users'
        });
      });

      it('should reject malformed PRAGMA statements', () => {
        const result = validateSelectQuery('PRAGMA invalid_pragma(transactions)');
        expect(result.valid).toBe(false);
      });

      it('should reject PRAGMA with SQL injection attempts', () => {
        const result = validateSelectQuery('PRAGMA table_info(transactions; DROP TABLE users)');
        expect(result.valid).toBe(false);
      });
    });

    it('should handle escaped quotes in strings', () => {
      const result = validateSelectQuery(`SELECT * FROM transactions WHERE note = 'This is a note with \'; semicolon'`);
      expect(result).toEqual({ valid: false, reason: 'Multiple statements are not allowed' });
    });

    it('should handle escaped slash in strings', () => {
      const result = validateSelectQuery(`SELECT * FROM transactions WHERE note = 'This is a note with \\\'; semicolon'`);
      expect(result).toEqual({ valid: true });
    });

    it('should detect unquoted semicolons after strings', () => {
      const result = validateSelectQuery(`SELECT * FROM transactions WHERE note = 'test'; DROP TABLE transactions`);
      expect(result).toEqual({
        valid: false,
        reason: 'Multiple statements are not allowed'
      });
    });

    it('should handle complex string scenarios', () => {
      const query = `
        SELECT * FROM transactions 
        WHERE note = 'This; has; semicolons;' 
        AND description = "So; does; this"
        AND id = 1;`;
      const result = validateSelectQuery(query);
      expect(result).toEqual({
        valid: false,
        reason: 'Multiple statements are not allowed'
      });
    });

    it('should reject non-SELECT queries', () => {
      const result = validateSelectQuery('DELETE FROM transactions');
      expect(result).toEqual({
        valid: false,
        reason: 'Only SELECT statements are allowed'
      });
    });

    it('should reject queries with disallowed tables', () => {
      const result = validateSelectQuery('SELECT * FROM users');
      expect(result).toEqual({
        valid: false,
        reason: 'Access to table(s) not allowed: users'
      });
    });

    it('should reject invalid SQL syntax', () => {
      const result = validateSelectQuery('SELECT * FROM transactions WHERE');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid SQL syntax');
    });
  });

  describe('executeSafeSelectQuery', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
      // Create a real DatabaseService instance with a mock database
      dbService = DatabaseService.getInstance(':memory:');
      
      // Mock the internal database methods
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => ({
          all: vi.fn().mockReturnValue([{ id: 1, amount: 100 }])
        }))
      };
      
      // @ts-ignore - Allow setting private property for testing
      (dbService as any).db = mockDb;
    });

    it('should execute a valid SELECT query', async () => {
      const result = await dbService.executeSafeSelectQuery('SELECT * FROM transactions');
      
      expect(result).toEqual({
        success: true,
        data: [{ id: 1, amount: 100 }]
      });
    });

    it('should reject invalid queries', async () => {
      const result = await dbService.executeSafeSelectQuery('SELECT * FROM users');
      
      expect(result).toEqual({
        success: false,
        error: 'Access to table(s) not allowed: users'
      });
    });

    it('should handle database errors', async () => {
      // Mock database to throw an error
      const dbError = new Error('Database connection failed');
      // @ts-ignore - Access private property for testing
      (dbService as any).db.prepare.mockImplementationOnce(() => ({
        all: vi.fn().mockImplementation(() => {
          throw dbError;
        })
      }));

      const result = await dbService.executeSafeSelectQuery('SELECT * FROM transactions');
      
      expect(result).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });
  });

  describe('table name extraction', () => {
    it('should handle different table name patterns', () => {
      const testCases = [
        { query: 'SELECT * FROM transactions', expected: ['transactions'] },
        { query: 'SELECT * FROM scraper_credentials', expected: ['scraper_credentials'] },
        { query: 'SELECT * FROM transactions t', expected: ['transactions'] },
        { query: 'SELECT * FROM transactions AS t', expected: ['transactions'] },
        { query: 'SELECT * FROM transactions WHERE id = 1', expected: ['transactions'] },
        { query: 'SELECT * FROM transactions, scraper_credentials', expected: ['transactions', 'scraper_credentials'] },
        { query: 'SELECT * FROM transactions JOIN scraper_credentials', expected: ['transactions', 'scraper_credentials'] },
        { query: 'SELECT * FROM transactions\nWHERE id = 1', expected: ['transactions'] },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = validateSelectQuery(query);
        expect(result).toEqual({ valid: true });
      });
    });
  });
});
