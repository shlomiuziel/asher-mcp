import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { mcpClient } from "../mcp-client";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

let _financialAgentInstance: Agent | null = null;

export async function getFinancialAgent(): Promise<Agent> {
  if (_financialAgentInstance) {
    console.log('♻️ Returning cached financial agent instance');
    return _financialAgentInstance;
  }

  console.log('🔍 Fetching MCP tools for financial agent...');
  const mcpTools = await mcpClient.getTools();
  console.log('🔧 MCP Tools loaded for agent:', Object.keys(mcpTools));
  console.log('🔧 Tool count:', Object.keys(mcpTools).length);

  _financialAgentInstance = new Agent({
    name: "Financial Assistant",
    description: "A helpful financial assistant that can query transactions, analyze spending, and provide insights",
    instructions: [
      {
        role: "system",
        content: "You are a helpful financial assistant with access to transaction data and bank account information."
      },
      {
        role: "system",
        content: "When users ask about time-relative queries like 'today', 'this month', 'last week', always call the getCurrentDate tool first to get the current date, then use that information to construct your database queries."
      },
      {
        role: "system",
        content: "Default currency: NIS (Israeli New Shekel) - assume NIS when currency is not specified. Make sure to search for original currency for transactions."
      },
      {
        role: "system",
        content: "Database columns use snake_case (e.g., charged_amount, original_amount, processed_date)."
      },
      {
        role: "system",
        content: "Your capabilities include: listing all available database tables, querying transaction data using SQL, analyzing spending patterns, and providing financial insights and summaries."
      },
      {
        role: "system",
        content: "When answering questions, be precise and data-driven. Use the available tools to fetch real data and provide clear summaries and insights."
      },
      {
        role: "system",
        content: "If you need to query the database, use safe SELECT queries only. Never use UPDATE, DELETE, INSERT, or other modifying operations."
      },
      {
        role: "system",
        content: "When asked to summarize or visualize expenses, ALWAYS try to use available rendering tools. Rendering tools provide beautiful visual displays instead of plain text."
      },
      {
        role: "system",
        content: "After fetching data, check if there's a rendering tool that can display it better. For example, for expense analysis, fetch transactions then call the render_expense_summary tool with the data to create a visual summary with charts and tables."
      },
      {
        role: "system",
        content: "Available tools are automatically connected via MCP (Model Context Protocol)."
      },
    ],
    model: openrouter("openai/gpt-4o"),
    tools: mcpTools,
  });

  console.log('✅ Financial agent created with tools');
  return _financialAgentInstance;
}
