"use client";

import {
  useCopilotAction,
  CatchAllActionRenderProps,
} from "@copilotkit/react-core";

interface ToolCallDisplayProps {
  status: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

function ToolCallDisplay({ status, name, args, result }: ToolCallDisplayProps) {
  const getStatusColor = () => {
    switch (status) {
      case "executing":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "complete":
        return "bg-green-50 border-green-200 text-green-800";
      case "failed":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "executing":
        return (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        );
      case "complete":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "🔧";
    }
  };

  const getDisplayName = () => {
    // Make tool names more user-friendly
    if (name === "query") return "Querying database";
    if (name === "list_tables") return "Listing database tables";
    if (name.startsWith("render_")) return name.replace("render_", "Rendering ");
    return name;
  };

  const getStatusMessage = () => {
    if (status === "executing") {
      if (name === "query") return "Fetching data from database...";
      if (name === "list_tables") return "Retrieving table information...";
      return "Processing...";
    }
    return status;
  };

  return (
    <div
      className={`my-2 rounded-lg border p-4 ${getStatusColor()}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center mt-0.5">{getStatusIcon()}</div>
        <div className="flex-1">
          <div className="font-semibold">{getDisplayName()}</div>
          <div className="mt-1 text-sm opacity-80">
            {getStatusMessage()}
          </div>
          {name === "query" && args.sql && typeof args.sql === "string" ? (
            <div className="mt-2 text-xs font-mono bg-black/5 p-2 rounded overflow-auto max-h-20">
              {args.sql.substring(0, 150)}
              {args.sql.length > 150 ? "..." : null}
            </div>
          ) : null}
          {args && Object.keys(args).length > 0 && name !== "query" ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">
                Arguments
              </summary>
              <pre className="mt-1 overflow-auto rounded bg-black/5 p-2 text-xs">
                {JSON.stringify(args, null, 2)}
              </pre>
            </details>
          ) : null}
          {result && status === "complete" ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">
                Result
              </summary>
              <pre className="mt-1 overflow-auto rounded bg-black/5 p-2 text-xs">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ToolCallRenderer() {
  useCopilotAction({
    /**
     * The asterisk (*) matches all tool calls
     */
    name: "*",
    render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => (
      <ToolCallDisplay status={status} name={name} args={args} result={result} />
    ),
  });

  return null;
}
