# **Asher: MCP Financial Data Aggregator \- Product Requirements Document**

Version: 1.0  
Date: May 23, 2025  
Project Name: Asher

## **1\. Introduction**

Asher is a personal Model Context Protocol (MCP) server designed to securely scrape, store, and manage financial data from various Israeli bank and credit card accounts. It leverages the israeli-bank-scrapers library, stores data in an encrypted local SQLite database, and exposes MCP tools for data interaction and scraping management. This document outlines the detailed specifications for its development.

## **2\. Goals and Objectives**

* **Secure Data Aggregation:** To securely scrape financial transaction data from multiple supported Israeli financial institutions.  
* **Local Encrypted Storage:** To store all scraped data and user credentials in a locally encrypted SQLite database, ensuring user privacy.  
* **MCP Server Interface:** To provide an MCP-compliant server interface for programmatic interaction with the stored data and server functionalities, enabling integration with clients like Claude.  
* **User-Friendly Credential Management:** To offer a command-line interface (CLI) for easy ingestion and management of scraper credentials.  
* **Robust Operation:** To implement reliable scraping logic, timestamp management for incremental fetching, and clear user notifications for ongoing processes.  
* **Testability:** To design the application with testability in mind, incorporating unit and integration tests.

## **3\. Target Audience**

The primary user is an individual who is fairly comfortable with code and wishes to aggregate their personal financial data for private use and analysis, potentially through an MCP client.

## **4\. Key Features & Functionality**

### **4.1. Data Scraping**

* **Multi-Account Support:** Support for all scrapers defined in the israeli-bank-scrapers library.  
* **Incremental Scraping:**  
  * Initial scrape fetches data from up to one year prior.  
  * Subsequent scrapes fetch data from the last\_scraped\_timestamp or one year prior, whichever is more recent.  
  * last\_scraped\_timestamp is updated based on the processedDate of the latest successfully scraped transaction for an account.  
* **Scraping Trigger:** Initiated via an MCP tool (trigger\_bank\_scrape). This tool will always attempt to scrape all configured accounts.  
* **User Notifications:** node-notifier will be used to inform the user about:  
  * Start of scraping for each account (e.g., "Starting scrape for \[friendly\_name\] from \[startDate\]...").  
  * End of scraping for each account (success with transaction count, no new data, or failure with error details).

### **4.2. Data Storage**

* **Database:** Local SQLite database named transactions.db.  
* **Encryption:** The database will be encrypted using better-sqlite3-multiple-ciphers.  
* **Table Schemas:**  
  * scraper\_credentials: Stores configurations for each financial account.  
  * transactions: Stores individual financial transactions.  
* **Data Integrity:** INSERT OR REPLACE (or INSERT ... ON CONFLICT DO UPDATE) strategy for the transactions table to handle updates to existing transactions if re-scraped.

### **4.3. Encryption Key Management**

* **Service:** A dedicated EncryptionKeyService (e.g., src/services/EncryptionKeyService.ts) will manage the encryption key.  
* **In-Memory Storage:** The key will be stored in a static variable within the service for the duration of the current process.  
* **Initial Key Setup (CLI):**  
  * If transactions.db does not exist, the ingest-creds CLI command will prompt the user (via inquirer in the terminal) to enter and confirm a new encryption key.  
  * This key is used to create and encrypt the new database and is stored in the EncryptionKeyService.  
* **Subsequent Key Retrieval (MCP Tools, Scraping):**  
  * If the key is not in memory, EncryptionKeyService.ensureKeyIsAvailable() will use node-notifier (with reply: true) to prompt the user for the key via a system notification.  
  * A retry-once mechanism will be implemented for node-notifier prompts. If key retrieval fails after retries, the operation will terminate gracefully.

### **4.4. Command-Line Interface (CLI)**

* **Tooling:** commander for argument parsing, inquirer for terminal prompts.  
* **Primary Command:** ingest-creds \--file \<path\_to\_credentials.json\>  
  * Reads scraper configurations from the specified JSON file.  
  * Validates the JSON content against the ScraperConfig\[\] Zod schema.  
  * Handles database initialization and encryption key setup/retrieval.  
  * Upserts (inserts or replaces) valid entries into the scraper\_credentials table using scraper\_type and friendly\_name as a composite key.  
  * Stores credentials and tags as JSON strings. last\_scraped\_timestamp is initially NULL.  
  * **Error Handling:** Processes all valid entries, skips invalid ones, and reports all errors at the end.

### **4.5. MCP Server**

* **SDK:** @modelcontextprotocol/sdk.  
* **Adaptation:** Based on the mcp-server-sqlite-npx example.  
* **Database Library Change:** Will replace sqlite3 with better-sqlite3-multiple-ciphers.  
* **Encrypted DB Access:** All database interactions within MCP tools will use the EncryptionKeyService to obtain the key and connect to the encrypted database.  
* **Standard MCP Tools:** listTables, getTableSchema, sqlQuery (read-only for SELECT), write\_query (for INSERT, UPDATE, DELETE \- with caution), create\_table, describe\_table.  
* **Custom MCP Tool:** trigger\_bank\_scrape (as described in section 4.1).

## **5\. Technical Specifications**

* **Language:** TypeScript  
* **Primary Libraries:**  
  * israeli-bank-scrapers: For financial data scraping.  
  * better-sqlite3-multiple-ciphers: For encrypted SQLite database operations.  
  * node-notifier: For system notifications (key prompts, scraping progress).  
  * commander: For CLI argument parsing.  
  * inquirer: For interactive terminal prompts (initial key setup).  
  * zod: For runtime data validation.  
  * @modelcontextprotocol/sdk: For MCP server implementation.  
  * vitest: For unit and integration testing.  
* **Project Structure (Illustrative):**  
  asher/  
  ├── src/  
  │   ├── cli.ts                  \# CLI logic (ingest-creds)  
  │   ├── db.ts                   \# Database schema setup, saveTransactions  
  │   ├── mcp\_server.ts           \# MCP server setup and tool handlers  
  │   ├── types.ts                \# Core TypeScript type definitions  
  │   ├── services/  
  │   │   └── EncryptionKeyService.ts \# Encryption key management  
  │   └── scrapers/               \# Core scraping orchestration logic (called by MCP tool)  
  ├── tests/  
  │   ├── unit/  
  │   │   └── ...                 \# Unit test files  
  │   └── integration/  
  │       └── ...                 \# Integration test files  
  ├── credentials.example.json    \# Example structure for credentials file  
  ├── package.json  
  └── tsconfig.json

## **6\. Data Models**

### **6.1. credentials.json File Format**

An array of ScraperConfig objects:  
\[  
  {  
    "scraper\_type": "visaCal", // From CompanyType  
    "friendly\_name": "My Personal Visa", // Mandatory  
    "credentials": {  
      "username": "your\_username",  
      "password": "your\_password"  
      // ... other fields as required by 'visaCal'  
    },  
    "tags": \["personal", "primary\_card"\] // Optional array of strings  
  },  
  // ... more entries  
\]

### **6.2. TypeScript Types (src/types.ts)**

* **CompanyType**: A string literal union type derived from israeli-bank-scrapers's company identifiers (e.g., 'hapoalim', 'leumi', 'discount', 'mercantile', 'mizrahi', 'beinleumi', 'massad', 'otsarHahayal', 'visaCal', 'max', 'isracard', 'amex', 'yahav', 'beyhadBishvilha').  
* **Specific Credential Interfaces**: For each CompanyType, an interface defining its required credential fields (e.g., HapoalimCredentials, LeumiCredentials, etc.).  
  * HapoalimCredentials: { userCode: string; password: string; }  
  * LeumiCredentials: { username: string; password: string; }  
  * DiscountCredentials: { id: string; password: string; num: string; }  
  * MercantileCredentials: { id: string; password: string; num: string; }  
  * MizrahiCredentials: { username: string; password: string; }  
  * BeinleumiCredentials: { username: string; password: string; }  
  * MassadCredentials: { username: string; password: string; }  
  * OtsarHahayalCredentials: { username: string; password: string; }  
  * VisaCalCredentials: { username: string; password: string; }  
  * MaxCredentials: { username: string; password: string; }  
  * IsracardCredentials: { id: string; card6Digits: string; password: string; }  
  * AmexCredentials: { username: string; card6Digits: string; password: string; }  
  * YahavCredentials: { username: string; password: string; nationalID: string; }  
  * BeyhadBishvilhaCredentials: { id: string; password: string; }  
* **BaseScraperConfig**:  
  interface BaseScraperConfig {  
    scraper\_type: CompanyType;  
    friendly\_name: string; // Mandatory  
    tags?: string\[\];        // Optional  
  }

* **ScraperConfig**: A discriminated union type based on scraper\_type, extending BaseScraperConfig and including the corresponding specific credential interface.  
  export type ScraperConfig \=  
    | (BaseScraperConfig & { scraper\_type: 'hapoalim'; credentials: HapoalimCredentials; })  
    | (BaseScraperConfig & { scraper\_type: 'leumi'; credentials: LeumiCredentials; })  
    // ... and so on for all company types

* **Transaction**: Interface matching the fields from israeli-bank-scrapers and the transactions table schema.  
  export interface Transaction {  
    identifier: string; // From scraper, part of compound PK  
    type: string; // e.g., 'normal', 'installments'  
    status: string; // e.g., 'completed', 'pending'  
    date: string; // ISO Date string \- transaction occurrence  
    processedDate: string; // ISO Date string \- when bank processed it (used for LST)  
    originalAmount: number;  
    originalCurrency: string;  
    chargedAmount: number;  
    chargedCurrency: string;  
    description: string;  
    memo?: string; // Optional  
    category?: string; // Optional, user-defined or future feature  
    // scraper\_credential\_id will be added when saving to DB, not part of this core type from scraper  
  }

### **6.3. Database Table Schemas (transactions.db)**

* **scraper\_credentials Table:**  
  * id: INTEGER PRIMARY KEY AUTOINCREMENT  
  * scraper\_type: TEXT NOT NULL (Corresponds to CompanyType)  
  * credentials: TEXT NOT NULL (JSON string of specific credentials)  
  * last\_scraped\_timestamp: TEXT NULL (ISO 8601 date string, from processedDate)  
  * friendly\_name: TEXT NOT NULL  
  * tags: TEXT NULL (JSON array of strings)  
  * UNIQUE (scraper\_type, friendly\_name)  
* **transactions Table:**  
  * scraper\_credential\_id: INTEGER NOT NULL (FOREIGN KEY (scraper\_credentials.id))  
  * identifier: TEXT NOT NULL (Transaction ID from the scraper library)  
  * type: TEXT  
  * status: TEXT  
  * date: TEXT NOT NULL (ISO 8601\)  
  * processedDate: TEXT NOT NULL (ISO 8601\)  
  * originalAmount: REAL NOT NULL  
  * originalCurrency: TEXT NOT NULL  
  * chargedAmount: REAL NOT NULL  
  * chargedCurrency: TEXT NOT NULL  
  * description: TEXT NOT NULL  
  * memo: TEXT  
  * category: TEXT  
  * PRIMARY KEY (scraper\_credential\_id, identifier)

## **7\. Testing Strategy**

* **Framework:** Vitest  
* **Unit Tests:**  
  * **EncryptionKeyService**: Test key storage, retrieval, node-notifier (mocked) interaction, and retry logic.  
  * **CLI Ingestion Logic (src/cli.ts)**: Test file reading (fs mocked), JSON parsing, Zod validation, EncryptionKeyService (mocked) interaction, and DB upsert calls (mocked).  
  * **Core Scraping Logic (src/scrapers/\*)**: Test startDate calculation, israeli-bank-scrapers (mocked) interaction, node-notifier (mocked) interaction, and last\_scraped\_timestamp update logic.  
  * **Database Interaction Functions (src/db.ts)**: Test SQL query formation and parameter binding, mocking better-sqlite3-multiple-ciphers.  
  * **MCP Tool Handlers (src/mcp\_server.ts)**: Test argument parsing (Zod), interaction with mocked database layer/core scraping logic, and response formatting.  
* **Integration Tests:**  
  * **Scope 1: CLI (Ingestion) \+ Database \+ EncryptionKeyService**:  
    * Tests ingest-creds command with a real encrypted SQLite database.  
    * inquirer and node-notifier will be mocked to simulate user input for keys.  
    * Scenarios: New DB, existing DB, updates, invalid JSON/schema, wrong key, empty file.  
    * Test DB files will be created and torn down for each test/suite.  
  * **Scope 2: MCP Server Tools \+ Database \+ EncryptionKeyService**:  
    * Tests MCP tool handlers interacting with a real encrypted SQLite database.  
    * Encryption key will be directly set in EncryptionKeyService for tests.  
    * The MCP server's tool invocation logic will be called programmatically, not via stdio.  
  * **Handling israeli-bank-scrapers**: This library will be mocked at the module level (vi.mock) to return predefined, static transaction data, avoiding live network calls.

## **8\. Security Considerations**

* **Credential Storage:** User's financial account credentials will be stored in the scraper\_credentials table within the encrypted transactions.db. The security of these credentials relies entirely on the strength of the user-chosen database encryption key and the security of the better-sqlite3-multiple-ciphers library.  
* **Encryption Key Handling:**  
  * The encryption key is never stored persistently by Asher.  
  * It is held in memory only for the duration of the application's process.  
  * The user is responsible for securely managing their encryption key. Loss of the key means loss of access to all data.  
* **Input Validation:** Zod will be used to validate credentials.json to prevent malformed data from being processed. SQL queries in MCP tools should be constructed carefully to prevent injection vulnerabilities (parameterized queries are standard with better-sqlite3).

## **9\. Future Considerations (Out of Scope for v1.0)**

* Automated, scheduled scraping (e.g., daily cron job).  
* Additional CLI commands (e.g., list/remove credentials, manually trigger scrape).  
* GUI for easier management.  
* Support for other scraper libraries or manual transaction input.  
* Advanced data analysis and reporting features.  
* Storing the encryption key in OS keychain (platform-dependent and complex).

This document provides a comprehensive specification for the Asher project.