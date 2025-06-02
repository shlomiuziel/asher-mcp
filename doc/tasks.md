## **Task Breakdown / Implementation Milestones**

This section outlines a high-level breakdown of tasks to implement the Asher project. Tasks can be further broken down into smaller sub-tasks during development sprints.  
**Milestone 1: Core Setup & Type Definitions**

* **Task 1.1:** Initialize TypeScript project, configure tsconfig.json, and set up package.json with initial dependencies (typescript, vitest, zod).  
* **Task 1.2:** Define all core TypeScript types in src/types.ts:  
  * CompanyType  
  * Specific credential interfaces (e.g., VisaCalCredentials, IsracardCredentials, etc. for all supported scrapers)  
  * BaseScraperConfig  
  * ScraperConfig (discriminated union)  
  * Transaction  
* **Task 1.3:** Define Zod schemas for ScraperConfig (for credentials.json validation).  
* **Task 1.4:** Set up basic Vitest configuration for unit testing.

**Milestone 2: Database Module & Encryption Key Service**

* **Task 2.1:** Implement database schema creation logic in src/db.ts for scraper\_credentials and transactions tables using better-sqlite3-multiple-ciphers.  
* **Task 2.2:** Implement EncryptionKeyService (src/services/EncryptionKeyService.ts):  
  * In-memory key storage (currentKey).  
  * setKey(key: string) method.  
  * ensureKeyIsAvailable() method (initial version without node-notifier yet, just focusing on in-memory check).  
  * \_resetCurrentKeyForTesting() helper.  
* **Task 2.3:** Implement saveTransactions(transactions: Transaction\[\], scraper\_credential\_id: number) function in src/db.ts using INSERT OR REPLACE and the compound primary key.  
* **Task 2.4:** Implement database function to upsert into scraper\_credentials table in src/db.ts (or a dedicated credentials DB module).  
* **Task 2.5:** Write unit tests for EncryptionKeyService (basic in-memory logic) and database interaction functions (saveTransactions, credential upsert) with mocked better-sqlite3-multiple-ciphers.

**Milestone 3: CLI for Credential Ingestion**

* **Task 3.1:** Set up commander for the ingest-creds \--file \<path\> command in src/cli.ts.  
* **Task 3.2:** Implement file reading and JSON parsing for credentials.json.  
* **Task 3.3:** Integrate Zod validation for the parsed credentials.json content.  
* **Task 3.4:** Implement logic for initial encryption key setup (if DB doesn't exist) using inquirer for terminal prompts (key entry and confirmation) and integrate with EncryptionKeyService.setKey().  
* **Task 3.5:** Integrate EncryptionKeyService.ensureKeyIsAvailable() for existing database scenarios (initially without node-notifier prompt, assuming key is pre-set for now or fails if not).  
* **Task 3.6:** Implement the upsert logic for scraper\_credentials using the function from Task 2.4.  
* **Task 3.7:** Implement error reporting and summary feedback for the CLI.  
* **Task 3.8:** Write unit tests for CLI logic (mocking fs, inquirer, EncryptionKeyService, DB functions).

**Milestone 4: MCP Server Base & Standard Tools**

* **Task 4.1:** Adapt the mcp-server-sqlite-npx example structure for src/mcp\_server.ts.  
* **Task 4.2:** Replace sqlite3 with better-sqlite3-multiple-ciphers in the MCP server's database wrapper/handler.  
* **Task 4.3:** Integrate EncryptionKeyService.ensureKeyIsAvailable() into the MCP server's database connection logic.  
* **Task 4.4:** Implement handlers for standard MCP tools (listTables, getTableSchema, sqlQuery, describe\_table, create\_table, write\_query) ensuring they use the encrypted database.  
* **Task 4.5:** Write unit tests for MCP tool handlers (mocking database layer).

**Milestone 5: Core Scraping Logic & trigger\_bank\_scrape MCP Tool**

* **Task 5.1:** Implement the core scraping orchestration logic in src/scrapers/ (or similar module).  
  * Fetch all credentials from scraper\_credentials table.  
  * For each account, calculate startDate based on last\_scraped\_timestamp or one-year rule.  
  * Call israeli-bank-scrapers (initially can be a simple mock).  
  * Call saveTransactions with scraped data.  
  * Update last\_scraped\_timestamp in scraper\_credentials based on processedDate.  
* **Task 5.2:** Implement the trigger\_bank\_scrape MCP tool handler in src/mcp\_server.ts to call the core scraping logic.  
* **Task 5.3:** Write unit tests for the core scraping logic (mocking israeli-bank-scrapers, DB functions, node-notifier).

**Milestone 6: User Notifications & Finalizing Key Prompts**

* **Task 6.1:** Integrate node-notifier into EncryptionKeyService.ensureKeyIsAvailable() for prompting the user when the key is not in memory (with retry logic).  
* **Task 6.2:** Integrate node-notifier into the core scraping logic for start/end/status notifications per account.  
* **Task 6.3:** Update/refine unit tests for EncryptionKeyService and scraping logic to cover node-notifier interactions.

**Milestone 7: Integration Testing**

* **Task 7.1:** Set up integration test environment (vitest config, test DB management scripts/helpers for setup/teardown).  
* **Task 7.2:** Implement integration tests for "Scope 1: CLI (Ingestion) \+ Database \+ EncryptionKeyService".  
  * Mock inquirer and node-notifier for simulating user input.  
* **Task 7.3:** Implement integration tests for "Scope 2: MCP Server Tools \+ Database \+ EncryptionKeyService".  
  * Programmatically invoke MCP tool handlers.  
  * Directly set encryption key in EncryptionKeyService.  
* **Task 7.4:** Implement mocking for israeli-bank-scrapers at the module level for integration tests, providing static test data.  
* **Task 7.5:** Integrate the mocked israeli-bank-scrapers into the trigger\_bank\_scrape tool tests within Scope 2\.

**Milestone 8: Finalization & Documentation**

* **Task 8.1:** Thorough end-to-end testing with a real MCP client (e.g., MCP Inspector, or a simple custom client script) if possible, or manual invocation of key flows.  
* **Task 8.2:** Review and complete all code comments and documentation.  
* **Task 8.3:** Create README.md with setup, usage instructions, and known limitations.  
* **Task 8.4:** Prepare credentials.example.json.  
* **Task 8.5:** Final code review and refactoring.

This task breakdown provides a structured approach to developing Asher. Each milestone builds upon the previous ones, allowing for incremental development and testing.  