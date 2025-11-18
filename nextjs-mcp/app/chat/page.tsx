"use client";

import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { ToolCallRenderer } from "./components/ToolCallRenderer";
import { ExpenseSummary } from "./components/ExpenseSummary";

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
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="financialAgent">
      <ChatInterface />
    </CopilotKit>
  );
}
