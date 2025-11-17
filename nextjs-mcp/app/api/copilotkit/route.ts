import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { MastraAgent } from "@ag-ui/mastra";
import { getMastra } from "@/mastra";
import { testMCPConnection } from "../../../src/mastra/mcp-client";
import { inspect } from "util";

// Ensure all errors are logged to console
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:');
  console.error(inspect(error, { depth: 10, colors: false, maxArrayLength: null }));
});

process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Promise Rejection:');
  console.error(inspect(reason, { depth: 10, colors: false, maxArrayLength: null }));
});

// Build a Next.js API route that handles the CopilotKit runtime requests
export const POST = async (req: NextRequest) => {
  console.log('📨 CopilotKit POST request received');

  // Create a custom fetch wrapper for the OpenAI client
  const customFetch: typeof fetch = async (...args) => {
    const [url, options] = args;

    console.log('🔍 Fetch intercepted:', typeof url === 'string' ? url : 'URL object');

    // Log all requests
    if (typeof url === 'string' && url.includes('openrouter.ai')) {
      console.log('🌐 HTTP Request to OpenRouter:');
      console.log('  URL:', url);
      console.log('  Method:', options?.method || 'GET');
      if (options?.body) {
        try {
          const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
          console.log('  Body:', inspect(body, { depth: 3, colors: false }));
        } catch {
          console.log('  Body (raw):', String(options.body).substring(0, 500));
        }
      }
    }

    try {
      const response = await fetch(...args);

      // Log failed responses for OpenRouter
      if (typeof url === 'string' && url.includes('openrouter.ai')) {
        if (!response.ok) {
          const clonedResponse = response.clone();
          const errorText = await clonedResponse.text();
          console.error('❌ OpenRouter API Error Response:');
          console.error('  Status:', response.status, response.statusText);
          console.error('  Headers:', Object.fromEntries(response.headers.entries()));
          console.error('  Body:', errorText);
          try {
            const errorJson = JSON.parse(errorText);
            console.error('  Parsed error:', inspect(errorJson, { depth: 10, colors: false }));
          } catch {
            // Error text is not JSON
          }
        } else {
          console.log('✅ OpenRouter API request successful (status:', response.status, ')');
        }
      }

      return response;
    } catch (error) {
      console.error('❌ Fetch threw error:', inspect(error, { depth: 10, colors: false }));
      throw error;
    }
  };

  // Create OpenAI client configured for OpenRouter with custom fetch
  const openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: "https://openrouter.ai/api/v1",
    fetch: customFetch,
  });

  // Create service adapter
  const serviceAdapter = new OpenAIAdapter({
    openai,
    model: "openai/gpt-4o",
    disableParallelToolCalls: true,
  });

  console.log('🤖 Initializing Mastra...');
  const mastra = await getMastra();

  console.log('🧪 Testing MCP connection...');
  await testMCPConnection();

  console.log('🔗 Getting Mastra agents...');
  const agents = MastraAgent.getLocalAgents({ mastra });

  console.log('✅ Agents ready:', Object.keys(agents));

  const runtime = new CopilotRuntime({
    agents: agents
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  try {
    console.log('📨 CopilotKit request:', req.method, req.url);
    const response = await handleRequest(req);
    console.log('✅ CopilotKit response:', response.status);
    return response;
  } catch (error: unknown) {
    console.error('❌ CopilotKit request error - Full error details:');
    console.error(inspect(error, { depth: 10, colors: false, maxArrayLength: null }));

    const err = error as {
      message?: string;
      status?: number;
      code?: string | number;
      type?: string;
      error?: unknown;
      headers?: unknown;
      stack?: string;
      request_id?: string;
      param?: unknown;
    };

    console.error('\n❌ Structured error breakdown:');
    console.error('  Message:', err.message);
    console.error('  Status:', err.status);
    console.error('  Code:', err.code);
    console.error('  Type:', err.type);
    console.error('  Request ID:', err.request_id);

    if (err.error) {
      console.error('  Error object:', inspect(err.error, { depth: 10, colors: false, maxArrayLength: null }));
    }
    if (err.headers) {
      console.error('  Headers:', inspect(err.headers, { depth: 10, colors: false, maxArrayLength: null }));
    }
    if (err.param) {
      console.error('  Param:', inspect(err.param, { depth: 10, colors: false, maxArrayLength: null }));
    }
    if (err.stack) {
      console.error('  Stack trace:', err.stack);
    }

    throw error;
  }
};
