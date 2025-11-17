-- Setup tables for nextjs-mcp project

-- Create scraper_credentials table
CREATE TABLE IF NOT EXISTS scraper_credentials (
  id SERIAL PRIMARY KEY,
  scraper_id VARCHAR(255) UNIQUE NOT NULL,
  friendly_name VARCHAR(255) NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  last_scraped_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on scraper_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_scraper_credentials_scraper_id ON scraper_credentials(scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_credentials_friendly_name ON scraper_credentials(friendly_name);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  scraper_credential_id INTEGER NOT NULL REFERENCES scraper_credentials(id) ON DELETE CASCADE,
  identifier VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(50),
  date TIMESTAMP NOT NULL,
  processed_date TIMESTAMP,
  original_amount DECIMAL(12, 2) NOT NULL,
  original_currency VARCHAR(10),
  charged_amount DECIMAL(12, 2),
  charged_currency VARCHAR(10),
  description TEXT,
  memo TEXT,
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(scraper_credential_id, identifier)
);

-- Create indexes on transactions table for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_scraper_credential_id ON transactions(scraper_credential_id);
CREATE INDEX IF NOT EXISTS idx_transactions_identifier ON transactions(identifier);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
