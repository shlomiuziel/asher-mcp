"use client";

import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { ToolCallRenderer } from "./components/ToolCallRenderer";
import { ExpenseSummary } from "./components/ExpenseSummary";
import { useState, useEffect } from "react";

function ChatInterface() {
  const { isLoading: isChatLoading } = useCopilotChat();

  return (
    <>
      <ToolCallRenderer />
      <ExpenseSummary />
      <div className="flex h-screen flex-col">
        <header className="border-b bg-white px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">
            Financial Assistant
          </h1>
          <p className="text-sm text-gray-600">
            Ask questions about your transactions, spending, and financial data
          </p>
        </header>
        <div className="flex-1 overflow-hidden relative">
          <CopilotChat
            disableSystemMessage={true}
            labels={{
              title: "Financial Assistant",
              initial: "Hello! I'm your financial assistant. I can help you analyze transactions, query your database, and provide insights about your spending. What would you like to know?",
            }}
            className="h-full"
          />
          {isChatLoading && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the CopilotKit endpoint is ready
    const checkEndpoint = async () => {
      try {
        const response = await fetch("/api/copilotkit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Send a minimal request to check if the endpoint is ready
            messages: [],
          }),
        });

        if (response.ok || response.status === 400) {
          // 400 is ok - it means the endpoint is up but didn't like our minimal request
          setIsLoading(false);
        } else {
          throw new Error(`Endpoint returned status ${response.status}`);
        }
      } catch (err) {
        console.error("Error checking CopilotKit endpoint:", err);
        setError("Failed to initialize chat. Please refresh the page.");
        setIsLoading(false);
      }
    };

    checkEndpoint();
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold text-gray-800">
            Failed to Load
          </h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
          <h2 className="mb-2 text-xl font-semibold text-gray-800">
            Initializing Financial Assistant
          </h2>
          <p className="text-gray-600">
            Setting up your AI assistant ...
          </p>
        </div>
      </div>
    );
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="financialAgent">
      <ChatInterface />
    </CopilotKit>
  );
}
