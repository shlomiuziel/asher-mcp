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

export interface BaseScraperConfig {
  scraper_type: CompanyType;
  friendly_name: string;
  tags?: string[];
}

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
  identifier: string;
  type: string;
  status: string;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargeAmount: number;
  description: string;
  memo?: string;
  category?: string;
}

export interface ScraperCredentialRow {
  id: number;
  scraperId: string;
  friendlyName: string;
  encryptedCredentials: string;
  lastScrapedTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRow {
  id: number;
  scraperCredentialId: number;
  uniqueTransactionId: string;
  date: string;
  processedDate: string;
  originalAmount: number;
  originalCurrency: string;
  chargeAmount: number;
  description: string;
  memo: string | null;
  category: string | null;
  originalCategory: string | null;
  accountName: string;
  identifier: string;
  createdAt: string;
  updatedAt: string;
}