import { readFile, existsSync } from 'fs';
import { z } from 'zod';
import { DatabaseService } from '../services/DatabaseService.js';
import { encryptionKeyService } from '../services/EncryptionKeyService.js';
import inquirer from 'inquirer';
import path from 'path';
import { promisify } from 'util';
import { createSection, logInfo, logSuccess, logError, logWarning } from '../utils/cli.js';

const readFileAsync = promisify(readFile);

// Define the schema for the credentials file
export const CredentialsSchema = z.object({
  credentials: z.array(
    z.object({
      scraper_type: z.string(),
      friendly_name: z.string(),
      credentials: z.record(z.unknown()),
    })
  ),
});

export type CredentialsFile = z.infer<typeof CredentialsSchema>;

/**
 * Prompt the user to set an encryption key
 */
async function promptForEncryptionKey(confirm: boolean = true): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'key',
      message: 'Enter encryption key (min 6 characters):',
      validate: (input: string) => {
        if (input.length < 6) {
          return 'Encryption key must be at least 6 characters long';
        }
        return true;
      },
    },
  ]);

  if (confirm) {
    await inquirer.prompt([
      {
        type: 'password',
        name: 'confirmKey',
        message: 'Confirm encryption key:',
        validate: (input: string) => {
          if (input !== answers.key) {
            return 'Encryption keys do not match';
          }
          return true;
        },
      },
    ]);
  }

  return answers.key;
}

/**
 * Ingest credentials from a JSON file
 * @param filePath Path to the credentials JSON file
 * @param encryptionKey Optional encryption key to use for the database
 */
export async function ingestCredentials(filePath: string, encryptionKey?: string): Promise<void> {
  logInfo(`Reading credentials from: ${filePath}`);

  // Read and parse the credentials file
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const fileContent = await readFileAsync(resolvedPath, 'utf-8');

  const jsonData = JSON.parse(fileContent);

  // Validate the JSON structure
  const result = CredentialsSchema.safeParse(jsonData);
  if (!result.success) {
    throw new Error(`Invalid credentials file: ${result.error.message}`);
  }

  const credentialsData = result.data;
  logInfo(`Found ${credentialsData.credentials.length} credential(s) to process`);

  // Check if we need to set up the encryption key
  const dbService = DatabaseService.getInstance();
  const dbExists = await dbService.databaseExists();

  // Handle database initialization and encryption key setup
  try {
    if (!dbExists) {
      logInfo('New database detected. Setting up encryption...');

      // Use provided key or prompt for one
      let key: string;
      if (encryptionKey) {
        logInfo('Using provided encryption key');
        key = encryptionKey;
      } else {
        logInfo('No encryption key provided, please enter one:');
        key = await promptForEncryptionKey();
      }

      // Set the key in the encryption service
      encryptionKeyService.setKey(key);

      logInfo('Initializing database...');
      await dbService.initialize();
      console.log(
        createSection({
          title: 'Success!',
          emoji: '✅',
          color: 'green',
        })
      );
      logSuccess('Credentials have been successfully ingested and are ready to use!');
    } else {
      // For existing database, ensure key is available
      logInfo('Existing database detected. Please enter the encryption key:');
      const key = await promptForEncryptionKey(false);
      encryptionKeyService.setKey(key);

      // Initialize the database with the provided key
      console.log(
        createSection({
          title: 'Initializing Database',
          emoji: '🔑',
          color: 'blue',
        })
      );
      logInfo('Initializing database...');
      await dbService.initialize();
      console.log(
        createSection({
          title: 'Database Initialized',
          emoji: '✅',
          color: 'green',
        })
      );
      logSuccess('Database initialized successfully');
    }
  } catch (error) {
    console.log(
      createSection({
        title: 'Error Initializing Database',
        emoji: '❌',
        color: 'red',
      })
    );
    logError(
      `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    process.exit(1);
  }

  // Process each credential
  let successCount = 0;
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < credentialsData.credentials.length; i++) {
    const cred = credentialsData.credentials[i];
    console.log(
      createSection({
        title: `Processing credential ${i + 1}/${credentialsData.credentials.length}: ${cred.friendly_name}`,
        emoji: '🔑',
        color: 'blue',
      })
    );

    try {
      // Upsert the credential
      await dbService.upsertScraperCredential({
        scraper_type: cred.scraper_type,
        friendly_name: cred.friendly_name,
        credentials: JSON.stringify(cred.credentials),
        tags: JSON.stringify([]),
      });

      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`Error: ${errorMessage}`);
      errors.push({
        index: i,
        error: errorMessage,
      });
    }
  }

  // Print summary
  console.log(
    createSection({
      title: 'Ingestion Summary',
      emoji: '📊',
      color: 'cyan',
    })
  );

  logInfo(`Total credentials: ${credentialsData.credentials.length}`);
  logInfo(`Successfully processed: ${successCount}`);

  if (errors.length > 0) {
    logWarning(`Failed to process: ${errors.length}`);
    console.log(
      createSection({
        title: 'Errors',
        emoji: '❌',
        color: 'red',
      })
    );

    errors.forEach(err => {
      logError(`[${err.index + 1}]: ${err.error}`);
    });

    // If there were any errors, exit with non-zero code
    process.exit(1);
  }

  console.log(
    createSection({
      title: 'All done!',
      emoji: '✨',
      color: 'green',
    })
  );
}
