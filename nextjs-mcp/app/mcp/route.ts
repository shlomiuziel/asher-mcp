import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getDatabaseService } from '../../src/lib/database';

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

  getCurrentDate: {
    handler: async () => {
      const now = new Date();
      return {
        success: true,
        data: {
          date: now.toISOString().split('T')[0], // YYYY-MM-DD
          datetime: now.toISOString(),
          timestamp: now.getTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
    },
    schema: {
      description: 'Get the current date and time. Use this to understand what "today", "this month", "this year" means in user queries.',
      inputSchema: {},
    },
  },
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
  }
);

export { mcpHandler as GET, mcpHandler as POST, mcpHandler as DELETE };