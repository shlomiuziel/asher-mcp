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
        content: "If invoked a render_ tool, finish with: 'Expenses summary rendered.'",
      },
      {
        role: "system",
        content: "Default currency: NIS (Israeli New Shekel) - assume NIS when currency is not specified. Make sure to search for original currency for transactions."
      },
    ],
    model: openrouter("openai/gpt-4o"),
    tools: mcpTools,
  });

  console.log('✅ Financial agent created with tools');
  return _financialAgentInstance;
}
