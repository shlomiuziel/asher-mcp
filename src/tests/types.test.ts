import { describe, it, expect } from 'vitest';
import { CompanyType } from '../types.js';
import { scraperConfigSchema } from '../schemas.js';

describe('TypeScript Types and Zod Schemas', () => {
  describe('CompanyType', () => {
    it('should have the correct company types', () => {
      const companyTypes: CompanyType[] = [
        'hapoalim',
        'leumi',
        'discount',
        'mercantile',
        'mizrahi',
        'beinleumi',
        'massad',
        'otsarHahayal',
        'visaCal',
        'max',
        'isracard',
        'amex',
        'yahav',
        'beyhadBishvilha',
      ];

      companyTypes.forEach(type => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('ScraperConfig Schema', () => {
    it('should validate a valid hapoalim config', () => {
      const validConfig = {
        scraper_type: 'hapoalim',
        friendly_name: 'My Hapoalim Account',
        credentials: {
          userCode: 'testuser',
          password: 'testpass',
        },
        tags: ['checking', 'primary'],
      };

      const result = scraperConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should validate a valid isracard config', () => {
      const validConfig = {
        scraper_type: 'isracard',
        friendly_name: 'My Isracard',
        credentials: {
          id: '123456',
          card6Digits: '123456',
          password: 'testpass',
        },
      };

      const result = scraperConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should invalidate a config with missing required fields', () => {
      const invalidConfig = {
        scraper_type: 'hapoalim',
        // Missing friendly_name
        credentials: {
          userCode: 'testuser',
          // Missing password
        },
      };

      const result = scraperConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should invalidate a config with invalid card digits', () => {
      const invalidConfig = {
        scraper_type: 'isracard',
        friendly_name: 'My Isracard',
        credentials: {
          id: '123456',
          card6Digits: '12345', // Only 5 digits
          password: 'testpass',
        },
      };

      const result = scraperConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => 
          issue.message === 'Card number must be 6 digits'
        )).toBe(true);
      }
    });
  });
});
