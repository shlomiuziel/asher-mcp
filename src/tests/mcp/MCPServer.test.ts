import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server as MCPServer } from '../../mcp/Server.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { encryptionKeyService } from '../../services/EncryptionKeyService.js';

// Mock the McpServer and StdioServerTransport
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
    prompt: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    server: { onerror: null },
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    onRequest: vi.fn(),
  })),
}));

// Mock the DatabaseService and EncryptionKeyService
vi.mock('../../services/DatabaseService.js', () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../services/EncryptionKeyService.js', () => ({
  encryptionKeyService: {
    ensureKeyIsAvailable: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('MCPServer', () => {
  let server: MCPServer;
  let mockDb: any;
  let mockMcpServer: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      }),
      initialize: vi.fn().mockResolvedValue(undefined),
      db: {},
    };

    // Mock the DatabaseService instance
    (DatabaseService.getInstance as any).mockReturnValue(mockDb);

    // Mock encryption key service
    (encryptionKeyService.ensureKeyIsAvailable as any).mockResolvedValue(undefined);

    // Create fresh instance for each test
    server = new MCPServer();

    // Get reference to the mocked McpServer
    mockMcpServer = (server as any).server;
  });

  describe('Server methods', () => {
    it('should start the server successfully', async () => {
      await server.start();
      expect(mockMcpServer.connect).toHaveBeenCalled();
    });

    it('should handle server start errors', async () => {
      const error = new Error('Transport error');
      mockMcpServer.connect.mockRejectedValueOnce(error);

      await expect(server.start()).rejects.toThrow();
    });
  });

  describe('Tool registration', () => {
    it('should register tools during initialization', () => {
      // Verify that tools were registered
      expect(mockMcpServer.tool).toHaveBeenCalled();
    });

    it('should register the listTables tool', () => {
      // Check if the listTables tool was registered
      const calls = mockMcpServer.tool.mock.calls;
      const listTablesCall = calls.find((call: any[]) => call[0] === 'listTables');
      expect(listTablesCall).toBeDefined();
    });

    it('should register the getTableSchema tool', () => {
      // Check if the getTableSchema tool was registered
      const calls = mockMcpServer.tool.mock.calls;
      const getTableSchemaCall = calls.find((call: any[]) => call[0] === 'getTableSchema');
      expect(getTableSchemaCall).toBeDefined();
    });

    it('should register the sqlQuery tool', () => {
      // Check if the sqlQuery tool was registered
      const calls = mockMcpServer.tool.mock.calls;
      const sqlQueryCall = calls.find((call: any[]) => call[0] === 'sqlQuery');
      expect(sqlQueryCall).toBeDefined();
    });

    it('should register the listScrapers tool', () => {
      // Check if the listScrapers tool was registered
      const calls = mockMcpServer.tool.mock.calls;
      const listScrapersCall = calls.find((call: any[]) => call[0] === 'listScrapers');
      expect(listScrapersCall).toBeDefined();
    });

    it('should register the fetchTransactions tool', () => {
      // Check if the fetchTransactions tool was registered
      const calls = mockMcpServer.tool.mock.calls;
      const fetchTransactionsCall = calls.find((call: any[]) => call[0] === 'fetchTransactions');
      expect(fetchTransactionsCall).toBeDefined();
    });
  });
});
