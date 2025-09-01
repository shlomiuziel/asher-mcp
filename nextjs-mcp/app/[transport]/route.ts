import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getDatabaseService } from '../../src/lib/database';
import { getScraperService } from '../../src/lib/scraper-service';

interface TextContent {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

type ZodRecord<T extends z.ZodTypeAny = z.ZodTypeAny> = Record<string, z.infer<T>>;

interface ToolSchema {
  description?: string;
  inputSchema?: Record<string, ZodRecord>;
}

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

function textResponse(text: string): { content: TextContent[] } {
  return {
    content: [{ type: 'text', text }],
  };
}

const tools: Record<string, { handler: ToolHandler; schema?: ToolSchema }> = {
  listTables: {
    handler: async () => {
      const db = getDatabaseService();
      const result = await db.listTables();
      if (!result.success) {
        throw new Error(result.error || 'Failed to list tables');
      }
      return { success: true, data: { tables: result.tables } };
    },
    schema: {
      description: 'List all tables in the database',
    },
  },

  getTableSchema: {
    handler: async (params: Record<string, unknown>) => {
      const { table } = params as { table: string };
      if (!table) {
        throw new Error('Table name is required');
      }
      const db = getDatabaseService();
      const result = await db.executeSafeSelectQuery(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`, [table]);
      if (!result.success) {
        throw new Error(result.error || 'Failed to get table schema');
      }
      return { success: true, data: { schema: result.data } };
    },
    schema: {
      description: 'Get the schema for a specific table',
      inputSchema: {
        table: z.string().describe('Name of the table to get schema for'),
      },
    },
  },

  sqlQuery: {
    handler: async (params: Record<string, unknown>) => {
      const { query } = params as { query: string };
      if (!query) {
        throw new Error('Query is required');
      }

      const db = getDatabaseService();
      const result = await db.executeSafeSelectQuery(query);
      if (!result.success) {
        throw new Error(result.error || 'Query execution failed');
      }
      return { success: true, data: result.data };
    },
    schema: {
      description: 'Execute a safe SELECT query on allowed tables',
      inputSchema: {
        query: z.string().describe('SQL SELECT query to execute'),
      },
    },
  },

  describeTable: {
    handler: async (params: Record<string, unknown>) => {
      const { table } = params as { table: string };
      if (!table) {
        throw new Error('Table name is required');
      }
      const db = getDatabaseService();
      const columnsResult = await db.executeSafeSelectQuery(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`, [table]);
      const indexesResult = await db.executeSafeSelectQuery(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`, [table]);

      if (!columnsResult.success) {
        throw new Error(columnsResult.error || 'Failed to get table columns');
      }
      if (!indexesResult.success) {
        throw new Error(indexesResult.error || 'Failed to get table indexes');
      }

      return {
        success: true,
        data: {
          columns: columnsResult.data,
          indexes: indexesResult.data,
        },
      };
    },
    schema: {
      description: 'Get detailed information about a table including columns and indexes',
      inputSchema: {
        table: z.string().describe('Name of the table to describe'),
      },
    },
  },

  listScrapers: {
    handler: async () => {
      const scraperService = getScraperService();
      const scrapers = scraperService.getAvailableScrapers();
      return { success: true, data: { scrapers } };
    },
    schema: {
      description: 'List all available bank scrapers',
      inputSchema: {},
    },
  },

  fetchTransactions: {
    handler: async () => {
      try {
        const scraperService = getScraperService();
        const result = await scraperService.fetchAllTransactions();

        return {
          success: result.success,
          data: {
            results: result.results.map(r => ({
              scraper: r.scraper,
              friendlyName: r.friendlyName,
              success: r.success,
              error: r.error,
              errorType: r.errorType,
              transactionCount:
                (r.accounts as { txns?: unknown[] }[] | undefined)?.reduce((sum, acc) => sum + (acc.txns?.length || 0), 0) || 0,
            })),
            totalTransactions: result.results.reduce(
              (sum, r) =>
                sum + ((r.accounts as { txns?: unknown[] }[] | undefined)?.reduce((s, acc) => s + (acc.txns?.length || 0), 0) || 0),
              0
            ),
          },
        };
      } catch (error: unknown) {
        console.error('Error in fetchTransactions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorType = error instanceof Error ? error.name : 'ScraperError';
        return {
          success: false,
          error: errorMessage,
          errorType,
        };
      }
    },
    schema: {
      description: 'Fetch transactions from all configured bank scrapers',
      inputSchema: {},
    },
  },
};

const prompts = {
  'fetch-last-month-transactions': () => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Fetch transactions from the last month and calculate the total expenses. Make sure to:
                    1. Query the database for transactions within the last month's date range
                    2. Filter for expenses (negative amounts)
                    3. Sum up the total expenses
                    4. Return a summary including:
                      - Total expenses amount
                      - Number of transactions
                      - List of transactions with dates and amounts`,
        },
      },
    ],
  }),
};

const mcpHandler = createMcpHandler(
  (server) => {
    Object.entries(tools).forEach(([name, { handler, schema }]) => {
      server.tool(
        name,
        schema?.description || '',
        schema?.inputSchema || {},
        async (params: Record<string, unknown>) => {
          try {
            const result = await handler(params);
            return textResponse(JSON.stringify(result));
          } catch (error: unknown) {
            console.error(`Error in ${name}:`, error);
            const errorMessage = error instanceof Error ? error.message : `Error in ${name}`;
            throw new McpError(ErrorCode.InternalError, errorMessage);
          }
        }
      );
    });

    Object.entries(prompts).forEach(([name, promptHandler]) => {
      server.prompt(name, promptHandler);
    });
  }
);

export { mcpHandler as GET, mcpHandler as POST, mcpHandler as DELETE };