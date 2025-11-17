import { Mastra } from "@mastra/core";
import { getFinancialAgent } from "./agents/financial-agent";

console.log('🚀 Initializing Mastra instance...');

export async function getMastra() {
  const financialAgent = await getFinancialAgent();

  return new Mastra({
    agents: {
      financialAgent,
    },
  });
}

console.log('✅ Mastra factory ready');
