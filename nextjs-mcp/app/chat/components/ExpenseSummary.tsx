"use client";

import { useFrontendTool } from "@copilotkit/react-core";

interface Transaction {
  description: string;
  charged_amount: number;
  charged_currency?: string;
  date: string;
}

interface ExpenseSummaryArgs {
  transactions: Transaction[];
  month: number;
  year: number;
  currency?: string;
}

interface SummaryResult {
  month: number;
  year: number;
  totalExpenses: number;
  transactionCount: number;
  currency: string;
  categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  transactions: Transaction[];
}

export function ExpenseSummary() {
  useFrontendTool({
    name: "render_expense_summary",
    description: "Renders a visual summary of expenses with category breakdown and transaction details. Supports both single-month and multi-month views. Use this after fetching transaction data to display a beautiful expense summary card.",
    parameters: [
      {
        name: "transactions",
        type: "object[]",
        description: "Array of transactions to summarize",
        attributes: [
          {
            name: "description",
            type: "string",
            description: "Transaction category or description",
          },
          {
            name: "charged_amount",
            type: "number",
            description: "Transaction amount (negative for expenses)",
          },
          {
            name: "date",
            type: "string",
            description: "Transaction date",
          },
          {
            name: "charged_currency",
            type: "string",
            description: "Transaction currency (optional)",
          },
        ],
        required: true,
      },
      {
        name: "month",
        type: "number",
        description: "Month number (1-12)",
        required: true,
      },
      {
        name: "year",
        type: "number",
        description: "Year (e.g., 2024)",
        required: true,
      },
      {
        name: "currency",
        type: "string",
        description: "Currency code (e.g., 'NIS', 'USD'). Defaults to 'NIS'",
        required: false,
      },
    ],
    handler: async ({ transactions, month, year, currency }: ExpenseSummaryArgs) => {
      // Determine currency - use provided currency, or infer from transactions, or default to NIS
      const determinedCurrency = currency ||
        transactions.find(t => t.charged_currency)?.charged_currency ||
        'NIS';

      // Calculate summary from transactions
      const totalExpenses = transactions.reduce((sum, t) => sum + t.charged_amount, 0);

      // Group by category
      const categoryMap = new Map<string, number>();
      transactions.forEach((t) => {
        const current = categoryMap.get(t.description) || 0;
        categoryMap.set(t.description, current + t.charged_amount);
      });

      const categories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: Math.abs(totalExpenses) > 0 ? (amount / Math.abs(totalExpenses)) * 100 : 0,
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 10);

      return {
        month,
        year,
        totalExpenses,
        transactionCount: transactions.length,
        currency: determinedCurrency,
        categories,
        transactions: transactions,
      };
    },
    render: ({ status, args, result }: { status: string; args: Partial<ExpenseSummaryArgs>; result?: SummaryResult }) => {
      if (status === "inProgress" || status === "executing") {
        return (
          <div className="my-4 rounded-lg border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-blue-800">
                Analyzing expenses for {args.month && args.year ? new Date(args.year, args.month - 1).toLocaleString('default', { month: 'long' }) + ' ' + args.year : 'the selected period'}...
              </span>
            </div>
          </div>
        );
      }

      if (status === "complete" && result) {
        // Determine if transactions span multiple months
        const uniqueMonths = new Set(
          result.transactions.map(t => {
            const date = new Date(t.date);
            return `${date.getFullYear()}-${date.getMonth()}`;
          })
        );
        const isMultiMonth = uniqueMonths.size > 1;

        // Generate title based on single or multi-month data
        let title: string;
        if (isMultiMonth) {
          const dates = result.transactions.map(t => new Date(t.date));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          const startMonth = minDate.toLocaleString('default', { month: 'short', year: 'numeric' });
          const endMonth = maxDate.toLocaleString('default', { month: 'short', year: 'numeric' });
          title = `${startMonth} - ${endMonth} Expense Summary`;
        } else {
          const monthName = new Date(result.year, result.month - 1).toLocaleString('default', { month: 'long' });
          title = `${monthName} ${result.year} Expense Summary`;
        }

        // Currency symbol mapping
        const getCurrencySymbol = (currency: string) => {
          const symbols: Record<string, string> = {
            'NIS': '₪',
            'ILS': '₪',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'GBR': '£',
          };
          return symbols[currency.toUpperCase()] || currency;
        };

        const currencySymbol = getCurrencySymbol(result.currency);

        return (
          <div className="my-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-xl font-semibold text-gray-800">
              {title}
            </h3>

            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <div className="text-sm text-gray-600">Total Expenses</div>
              <div className="text-3xl font-bold text-blue-600">
                {currencySymbol}{result.totalExpenses.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">
                {result.transactionCount} transactions
              </div>
            </div>

            {result.categories.length > 0 && (
              <div>
                <h4 className="mb-3 font-medium text-gray-700">Top Categories</h4>
                <div className="space-y-2">
                  {result.categories.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">
                          {category.category}
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${category.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="font-semibold text-gray-800">
                          {currencySymbol}{category.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {category.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.transactions.length > 0 && (
              <div className="mt-6">
                <div className="mb-6 rounded-lg bg-gray-50 p-4">
                  {(() => {
                    // Determine if transactions span multiple months
                    const uniqueMonths = new Set(
                      result.transactions.map(t => {
                        const date = new Date(t.date);
                        return `${date.getFullYear()}-${date.getMonth()}`;
                      })
                    );

                    const isMultiMonth = uniqueMonths.size > 1;

                    if (isMultiMonth) {
                      // Group by month
                      const monthlyTransactions = result.transactions.reduce((acc, transaction) => {
                        const date = new Date(transaction.date);
                        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                        if (!acc[monthKey]) {
                          acc[monthKey] = {
                            count: 0,
                            year: date.getFullYear(),
                            month: date.getMonth(),
                          };
                        }
                        acc[monthKey].count += 1;
                        return acc;
                      }, {} as Record<string, { count: number; year: number; month: number }>);

                      const months = Object.values(monthlyTransactions).sort((a, b) => {
                        if (a.year !== b.year) return a.year - b.year;
                        return a.month - b.month;
                      });

                      const maxCount = Math.max(...months.map(m => m.count));

                      return (
                        <>
                          <h4 className="mb-3 font-medium text-gray-700">Monthly Transaction Volume</h4>
                          <div className="flex items-end justify-between gap-2 h-32">
                            {months.map((monthData, index) => {
                              const heightPercent = maxCount > 0 ? (monthData.count / maxCount) * 100 : 0;
                              const monthName = new Date(monthData.year, monthData.month).toLocaleString('default', { month: 'short' });

                              return (
                                <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                  <div
                                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                    style={{ height: `${heightPercent}%`, minHeight: monthData.count > 0 ? '4px' : '0' }}
                                  />
                                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                    {monthName} {monthData.year}: {monthData.count} transaction{monthData.count !== 1 ? 's' : ''}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">{monthName}</div>
                                  <div className="text-xs text-gray-400">{monthData.year}</div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    } else {
                      // Group by day (single month)
                      const dailyTransactions = result.transactions.reduce((acc, transaction) => {
                        const day = new Date(transaction.date).getDate();
                        acc[day] = (acc[day] || 0) + 1;
                        return acc;
                      }, {} as Record<number, number>);

                      const maxCount = Math.max(...Object.values(dailyTransactions));
                      const days = Array.from({ length: new Date(result.year, result.month, 0).getDate() }, (_, i) => i + 1);

                      return (
                        <>
                          <h4 className="mb-3 font-medium text-gray-700">Daily Transaction Volume</h4>
                          <div className="flex items-end justify-between gap-1 h-32">
                            {days.map((day) => {
                              const count = dailyTransactions[day] || 0;
                              const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;

                              return (
                                <div key={day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                                  <div
                                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                    style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '4px' : '0' }}
                                  />
                                  {count > 0 && (
                                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                      Day {day}: {count} transaction{count !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 mt-1">{day}</div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>

                <h4 className="mb-3 font-medium text-gray-700">Transaction Details</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.transactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {new Date(transaction.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {transaction.description}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {currencySymbol}{transaction.charged_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      }

      return <></>;
    },
  });

  return null;
}
