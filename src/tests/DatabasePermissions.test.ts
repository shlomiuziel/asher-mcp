import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDbInstance } from '../services/DatabaseService.js';
import { existsSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { encryptionKeyService } from '../services/EncryptionKeyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Database Permissions', () => {
  const testDbPath = join(__dirname, '../../test-permissions.db');
  const dbFiles = [
    testDbPath,                     // main db file
    `${testDbPath}-shm`,           // shared memory file
    `${testDbPath}-wal`            // write-ahead log file
  ];

  const removeIfExists = (filePath: string) => {
    if (existsSync(filePath)) {
      console.log(`Removing existing file: ${filePath}`);
      unlinkSync(filePath);
    }
  };

  beforeAll(() => {
    console.log('Cleaning up any existing test database files...');
    dbFiles.forEach(removeIfExists);
  });

  afterAll(() => {
    console.log('Cleaning up test database files...');
    dbFiles.forEach(file => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (error) {
          console.warn(`Failed to remove ${file}:`, error instanceof Error ? error.message : String(error));
        }
      }
    });
  });

  it('should create database file with correct permissions (600)', async () => {
    console.log('Testing database file permissions...');
    
    const db = getDbInstance(testDbPath);
    
    const testKey = 'test-key-1234567890-1234567890-1234567890';
    encryptionKeyService.setKey(testKey);
    await db.initialize();
    
    // Check file permissions
    const stats = statSync(testDbPath);
    const fileMode = (stats.mode & 0o777).toString(8).padStart(3, '0');
    
    console.log(`\nTest Results:`);
    console.log(`Database file: ${testDbPath}`);
    console.log(`File permissions: ${fileMode} (should be 600)`);
    
    expect(fileMode).toBe('600');
    expect(stats.mode & 0o400).toBeTruthy(); // Owner readable
    expect(stats.mode & 0o200).toBeTruthy(); // Owner writable
    expect(stats.mode & 0o020).toBeFalsy();  // Group writable (should not be)
    expect(stats.mode & 0x002).toBeFalsy();  // Others writable (should not be)
  });
});
