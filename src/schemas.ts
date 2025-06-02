import { z } from 'zod';
import type { 
  HapoalimCredentials, 
  LeumiCredentials,
  DiscountCredentials,
  MercantileCredentials,
  MizrahiCredentials,
  BeinleumiCredentials,
  MassadCredentials,
  OtsarHahayalCredentials,
  VisaCalCredentials,
  MaxCredentials,
  IsracardCredentials,
  AmexCredentials,
  YahavCredentials,
  BeyhadBishvilhaCredentials
} from './types.js';

// Base schema for common scraper config properties
const baseScraperConfigSchema = {
  scraper_type: z.string().min(1, "Scraper type is required"),
  friendly_name: z.string().min(1, "Friendly name is required"),
  tags: z.array(z.string()).optional(),
};

// Specific credential schemas
const hapoalimCredentialsSchema: z.ZodType<HapoalimCredentials> = z.object({
  userCode: z.string().min(1, "User code is required"),
  password: z.string().min(1, "Password is required"),
});

const leumiCredentialsSchema: z.ZodType<LeumiCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const discountCredentialsSchema: z.ZodType<DiscountCredentials> = z.object({
  id: z.string().min(1, "ID is required"),
  password: z.string().min(1, "Password is required"),
  num: z.string().min(1, "Num is required"),
});

const mercantileCredentialsSchema: z.ZodType<MercantileCredentials> = z.object({
  id: z.string().min(1, "ID is required"),
  password: z.string().min(1, "Password is required"),
  num: z.string().min(1, "Num is required"),
});

const mizrahiCredentialsSchema: z.ZodType<MizrahiCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const beinleumiCredentialsSchema: z.ZodType<BeinleumiCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const massadCredentialsSchema: z.ZodType<MassadCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const otsarHahayalCredentialsSchema: z.ZodType<OtsarHahayalCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const visaCalCredentialsSchema: z.ZodType<VisaCalCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const maxCredentialsSchema: z.ZodType<MaxCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const isracardCredentialsSchema: z.ZodType<IsracardCredentials> = z.object({
  id: z.string().min(1, "ID is required"),
  card6Digits: z.string().length(6, "Card number must be 6 digits"),
  password: z.string().min(1, "Password is required"),
});

const amexCredentialsSchema: z.ZodType<AmexCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  card6Digits: z.string().length(6, "Card number must be 6 digits"),
  password: z.string().min(1, "Password is required"),
});

const yahavCredentialsSchema: z.ZodType<YahavCredentials> = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  nationalID: z.string().min(1, "National ID is required"),
});

const beyhadBishvilhaCredentialsSchema: z.ZodType<BeyhadBishvilhaCredentials> = z.object({
  id: z.string().min(1, "ID is required"),
  password: z.string().min(1, "Password is required"),
});

// Create a union of all possible scraper config schemas
export const scraperConfigSchema = z.union([
  // Hapoalim
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('hapoalim'),
    credentials: hapoalimCredentialsSchema,
  }),
  
  // Leumi
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('leumi'),
    credentials: leumiCredentialsSchema,
  }),
  
  // Discount
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('discount'),
    credentials: discountCredentialsSchema,
  }),
  
  // Mercantile
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('mercantile'),
    credentials: mercantileCredentialsSchema,
  }),
  
  // Mizrahi
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('mizrahi'),
    credentials: mizrahiCredentialsSchema,
  }),
  
  // Beinleumi
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('beinleumi'),
    credentials: beinleumiCredentialsSchema,
  }),
  
  // Massad
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('massad'),
    credentials: massadCredentialsSchema,
  }),
  
  // Otsar Hahayal
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('otsarHahayal'),
    credentials: otsarHahayalCredentialsSchema,
  }),
  
  // Visa Cal
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('visaCal'),
    credentials: visaCalCredentialsSchema,
  }),
  
  // Max
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('max'),
    credentials: maxCredentialsSchema,
  }),
  
  // Isracard
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('isracard'),
    credentials: isracardCredentialsSchema,
  }),
  
  // Amex
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('amex'),
    credentials: amexCredentialsSchema,
  }),
  
  // Yahav
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('yahav'),
    credentials: yahavCredentialsSchema,
  }),
  
  // Beyhad Bishvilha
  z.object({
    ...baseScraperConfigSchema,
    scraper_type: z.literal('beyhadBishvilha'),
    credentials: beyhadBishvilhaCredentialsSchema,
  }),
]);

// Schema for an array of scraper configs
export const scraperConfigsSchema = z.array(scraperConfigSchema);

// Type inference for TypeScript
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
export type ScraperConfigs = z.infer<typeof scraperConfigsSchema>;
