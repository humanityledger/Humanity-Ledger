import React from 'react';

export default function CreatorDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Creator Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your revenue, subscriptions, and payouts.</p>
          </div>
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
              Export
            </button>
            <button className="px-4 py-2 bg-[#25D366] text-white rounded-md text-sm font-medium hover:bg-[#20b858] shadow-sm transition-all">
              Settings
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Native USDC Revenue */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-medium text-gray-500 mb-2">Native USDC Revenue</div>
            <div className="flex items-baseline space-x-2">
              <div className="text-3xl font-bold tracking-tight">$12,450.00</div>
              <div className="text-sm font-medium text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">+14.2%</div>
            </div>
            <div className="text-xs text-gray-400 mt-4">Last 30 days</div>
          </div>

          {/* Subscription MRR */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-medium text-gray-500 mb-2">Subscription MRR</div>
            <div className="flex items-baseline space-x-2">
              <div className="text-3xl font-bold tracking-tight">$4,200.00</div>
              <div className="text-sm font-medium text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">+5.4%</div>
            </div>
            <div className="text-xs text-gray-400 mt-4">Monthly Recurring Revenue</div>
          </div>

          {/* Gas Abstraction Costs */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="text-sm font-medium text-gray-500 mb-2">Gas Abstraction Costs</div>
            <div className="flex items-baseline space-x-2">
              <div className="text-3xl font-bold tracking-tight">$45.20</div>
              <div className="text-sm font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">-2.1%</div>
            </div>
            <div className="text-xs text-gray-400 mt-4">Sponsored transactions</div>
          </div>

          {/* Payout Automation */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium text-gray-500">Payout Automation</div>
              <div className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse mt-1.5"></div>
            </div>
            <div className="flex items-baseline space-x-2">
              <div className="text-3xl font-bold tracking-tight">Active</div>
            </div>
            <div className="text-xs text-gray-400 mt-4">Next payout in 3 days</div>
          </div>
        </div>

        {/* Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart Placeholder */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-gray-900">Revenue Overview</h2>
              <select className="text-sm border-none bg-gray-50 text-gray-600 rounded-md px-3 py-1.5 focus:ring-0 cursor-pointer">
                <option>Last 30 days</option>
                <option>This Year</option>
                <option>All Time</option>
              </select>
            </div>
            <div className="h-64 w-full flex items-end space-x-2">
              {/* Dummy Chart Bars */}
              {[40, 60, 45, 80, 50, 90, 75, 100, 85, 110, 95, 120].map((height, i) => (
                <div key={i} className="flex-1 bg-gray-100 hover:bg-[#25D366]/20 rounded-t-sm transition-colors relative group" style={{ height: `${height}%` }}>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap">
                    ${height * 100}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
              <a href="#" className="text-sm text-[#25D366] hover:underline font-medium">View all</a>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { name: 'Subscription Payment', user: 'alice.eth', amount: '+$50.00', status: 'Success', time: '2m ago' },
                { name: 'One-time Support', user: 'bob.lens', amount: '+$10.00', status: 'Success', time: '1h ago' },
                { name: 'Gas Fee', user: 'Network', amount: '-$0.15', status: 'Deducted', time: '2h ago' },
                { name: 'Subscription Payment', user: 'charlie.eth', amount: '+$50.00', status: 'Success', time: '5h ago' },
                { name: 'Payout', user: 'Bank Account', amount: '-$1,200.00', status: 'Processing', time: '1d ago' },
              ].map((tx, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${tx.amount.startsWith('+') ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-gray-100 text-gray-500'}`}>
                      {tx.amount.startsWith('+') ? '↓' : '↑'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tx.name}</div>
                      <div className="text-xs text-gray-500">{tx.user} • {tx.time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${tx.amount.startsWith('+') ? 'text-gray-900' : 'text-gray-500'}`}>{tx.amount}</div>
                    <div className="text-xs text-gray-400">{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
