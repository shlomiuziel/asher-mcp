/**
 * Core TypeScript type definitions for Asher
 */

// CompanyType represents all supported financial institutions
export type CompanyType =
  | 'hapoalim'
  | 'leumi'
  | 'discount'
  | 'mercantile'
  | 'mizrahi'
  | 'beinleumi'
  | 'massad'
  | 'otsarHahayal'
  | 'visaCal'
  | 'max'
  | 'isracard'
  | 'amex'
  | 'yahav'
  | 'beyhadBishvilha';

// Specific credential interfaces for each company type
export interface HapoalimCredentials {
  userCode: string;
  password: string;
}

export interface LeumiCredentials {
  username: string;
  password: string;
}

export interface DiscountCredentials {
  id: string;
  password: string;
  num: string;
}

export interface MercantileCredentials {
  id: string;
  password: string;
  num: string;
}

export interface MizrahiCredentials {
  username: string;
  password: string;
}

export interface BeinleumiCredentials {
  username: string;
  password: string;
}

export interface MassadCredentials {
  username: string;
  password: string;
}

export interface OtsarHahayalCredentials {
  username: string;
  password: string;
}

export interface VisaCalCredentials {
  username: string;
  password: string;
}

export interface MaxCredentials {
  username: string;
  password: string;
}

export interface IsracardCredentials {
  id: string;
  card6Digits: string;
  password: string;
}

export interface AmexCredentials {
  username: string;
  card6Digits: string;
  password: string;
}

export interface YahavCredentials {
  username: string;
  password: string;
  nationalID: string;
}

export interface BeyhadBishvilhaCredentials {
  id: string;
  password: string;
}

// Base scraper configuration interface
export interface BaseScraperConfig {
  scraper_type: CompanyType;
  friendly_name: string; // Mandatory
  tags?: string[]; // Optional
}

// Discriminated union type for all scraper configurations
export type ScraperConfig =
  | (BaseScraperConfig & { scraper_type: 'hapoalim'; credentials: HapoalimCredentials })
  | (BaseScraperConfig & { scraper_type: 'leumi'; credentials: LeumiCredentials })
  | (BaseScraperConfig & { scraper_type: 'discount'; credentials: DiscountCredentials })
  | (BaseScraperConfig & { scraper_type: 'mercantile'; credentials: MercantileCredentials })
  | (BaseScraperConfig & { scraper_type: 'mizrahi'; credentials: MizrahiCredentials })
  | (BaseScraperConfig & { scraper_type: 'beinleumi'; credentials: BeinleumiCredentials })
  | (BaseScraperConfig & { scraper_type: 'massad'; credentials: MassadCredentials })
  | (BaseScraperConfig & { scraper_type: 'otsarHahayal'; credentials: OtsarHahayalCredentials })
  | (BaseScraperConfig & { scraper_type: 'visaCal'; credentials: VisaCalCredentials })
  | (BaseScraperConfig & { scraper_type: 'max'; credentials: MaxCredentials })
  | (BaseScraperConfig & { scraper_type: 'isracard'; credentials: IsracardCredentials })
  | (BaseScraperConfig & { scraper_type: 'amex'; credentials: AmexCredentials })
  | (BaseScraperConfig & { scraper_type: 'yahav'; credentials: YahavCredentials })
  | (BaseScraperConfig & {
      scraper_type: 'beyhadBishvilha';
      credentials: BeyhadBishvilhaCredentials;
    });

export interface Transaction {
  identifier: string; // From scraper, part of compound PK
  type: string; // e.g., 'normal', 'installments'
  status: string; // e.g., 'completed', 'pending'
  date: string; // ISO Date string - transaction occurrence
  processedDate: string; // ISO Date string - when bank processed it (used for LST)
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  memo?: string; // Optional
  category?: string; // Optional, user-defined or future feature
  // scraper_credential_id will be added when saving to DB, not part of this core type from scraper
}

// Database row types
export interface ScraperCredentialRow {
  id: number;
  scraper_type: string;
  credentials: string; // JSON string of the credentials object
  last_scraped_timestamp: string | null; // ISO 8601 date string or null
  friendly_name: string;
  tags: string | null; // JSON array of strings or null
}

export interface TransactionRow {
  scraper_credential_id: number;
  identifier: string;
  type: string;
  status: string;
  date: string; // ISO 8601
  processedDate: string; // ISO 8601
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  description: string;
  memo: string | null;
  category: string | null;
}
