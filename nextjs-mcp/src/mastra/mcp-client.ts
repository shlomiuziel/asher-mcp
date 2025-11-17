import { MCPClient } from "@mastra/mcp";

console.log('🔌 Initializing MCP Client...');

// Determine the MCP server URL based on environment
const getMcpUrl = () => {
  let baseUrl: string;

  // Use environment variable if provided
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = `${process.env.NEXT_PUBLIC_APP_URL}/mcp`;
  }
  // In production, use the current host from Vercel or other platforms
  else if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}/mcp`;
  }
  // Fallback to localhost for development
  else {
    baseUrl = "http://localhost:3000/mcp";
  }

  // Append Vercel protection bypass if available
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    const url = new URL(baseUrl);
    url.searchParams.set('x-vercel-protection-bypass', process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
    return url.toString();
  }

  return baseUrl;
};

const mcpUrl = getMcpUrl();

// Create MCP client that connects to our MCP server
export const mcpClient = new MCPClient({
  servers: {
    financial: {
      url: new URL(mcpUrl),
    },
  },
  timeout: 30000,
});

console.log('✅ MCP Client initialized with server:', mcpUrl);

// Add a test function to verify MCP client can connect
export async function testMCPConnection() {
  console.log('🧪 Testing MCP connection...');
  try {
    const tools = await mcpClient.getTools();
    console.log('✅ MCP connection test successful!');
    console.log('📋 Available tools:', Object.keys(tools));
    return true;
  } catch (error) {
    console.error('❌ MCP connection test failed:', error);
    return false;
  }
}
