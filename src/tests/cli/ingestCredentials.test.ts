import { describe, it, expect, vi, beforeEach } from 'vitest';

const testCredentials = vi.hoisted(() => JSON.stringify({
  credentials: [
    {
      scraper_type: 'test',
      friendly_name: 'Test Credential',
      credentials: {
        username: 'testuser',
        password: 'testpass'
      }
    }
  ]
}));

// Create mocks before importing any modules
const mockExistsSync = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockReadFileSync = vi.hoisted(() => vi.fn().mockReturnValue(testCredentials));
const mockPrompt = vi.hoisted(() => vi.fn().mockResolvedValue({ key: 'test-key', confirmKey: 'test-key' }));
const mockDatabaseExists = vi.hoisted(() => vi.fn().mockResolvedValue(false));
const mockInitialize =  vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpsertScraperCredential = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSetKey = vi.hoisted(() => vi.fn());
const mockEnsureKeyIsAvailable = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockIsAbsolute = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockResolve = vi.hoisted(() => vi.fn().mockImplementation((_, p) => p));

// Mock modules
vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFile: mockReadFileSync
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mockPrompt
  }
}));

vi.mock('../../services/DatabaseService.js', () => ({
  DatabaseService: {
    getInstance: vi.fn().mockReturnValue({
      databaseExists: mockDatabaseExists,
      initialize: mockInitialize,
      upsertScraperCredential: mockUpsertScraperCredential,
      close: vi.fn()
    })
  }
}));

vi.mock('../../services/EncryptionKeyService.js', () => ({
  encryptionKeyService: {
    setKey: mockSetKey,
    ensureKeyIsAvailable: mockEnsureKeyIsAvailable
  }
}));

vi.mock('../../utils/claudeConfig.js', () => ({
  configureClaudeIntegration: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('../../utils/cli.js', () => ({
  createSection: vi.fn().mockReturnValue('Section'),
  logInfo: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn()
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    isAbsolute: mockIsAbsolute,
    resolve: mockResolve,
    join: vi.fn().mockImplementation((...args) => args.join('/')),
    dirname: vi.fn().mockReturnValue('/mock/dir')
  },
  isAbsolute: mockIsAbsolute,
  resolve: mockResolve,
  join: vi.fn().mockImplementation((...args) => args.join('/')),
  dirname: vi.fn().mockReturnValue('/mock/dir')
}));

vi.mock('util', () => ({
  promisify: vi.fn().mockImplementation((fn) => fn)
}));

// Import the module under test after all mocks are defined
import { ingestCredentials } from '../../cli/ingestCredentials.js';

describe('ingestCredentials', () => {  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process credentials file successfully', async () => {
    await ingestCredentials('test-credentials.json');
    
    expect(mockUpsertScraperCredential).toHaveBeenCalled();
    expect(mockSetKey).toHaveBeenCalledWith('test-key');

    expect(mockReadFileSync).toHaveBeenCalledWith(
      'test-credentials.json',
      'utf-8'
    );
  });

  it('should handle file read error', async () => {
    mockReadFileSync.mockRejectedValueOnce(new Error('File not found'));

    await expect(ingestCredentials('nonexistent.json')).rejects.toThrow();

    expect(mockReadFileSync).toHaveBeenCalledWith(
      'nonexistent.json',
      'utf-8'
    );
  });

  it('should process credentials file for new database', async () => {
    mockDatabaseExists.mockResolvedValue(false);
    
    await ingestCredentials('test-credentials.json');
    
    expect(mockSetKey).toHaveBeenCalledWith('test-key');
    expect(mockUpsertScraperCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_type: 'test',
        friendly_name: 'Test Credential',
        credentials: expect.any(String)
      })
    );
  });

  it('should handle existing database', async () => {
    mockDatabaseExists.mockResolvedValue(true);
    
    await ingestCredentials('test-credentials.json');
    
    expect(mockUpsertScraperCredential).toHaveBeenCalled();
  });

  it('should handle invalid JSON file', async () => {
    const invalidJson = 'invalid-json';
    mockReadFileSync.mockResolvedValueOnce(invalidJson);
    
    await expect(ingestCredentials('invalid.json')).rejects.toThrow(/is not valid JSON/);
    
    expect(mockReadFileSync).toHaveBeenCalledWith(
      'invalid.json',
      'utf-8'
    );
  });
});
