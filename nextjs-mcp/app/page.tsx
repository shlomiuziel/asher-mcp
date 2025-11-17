import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-white">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-5xl font-bold mb-4 text-gray-900">
          Financial Assistant
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Chat with your AI-powered financial assistant to analyze transactions,
          query your database, and gain insights about your spending.
        </p>

        <div className="flex flex-col gap-4 items-center">
          <Link
            href="/chat"
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            Start Chatting
          </Link>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-2">💰</div>
              <h3 className="text-lg font-semibold mb-2">Transaction Analysis</h3>
              <p className="text-sm text-gray-600">
                Query and analyze your transaction history with natural language
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="text-lg font-semibold mb-2">Spending Insights</h3>
              <p className="text-sm text-gray-600">
                Get intelligent insights about your spending patterns
              </p>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-2">🔍</div>
              <h3 className="text-lg font-semibold mb-2">Database Queries</h3>
              <p className="text-sm text-gray-600">
                Execute safe SQL queries on your financial data
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
