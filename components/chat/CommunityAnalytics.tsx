'use client';
import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  LineChart, 
  PieChart, 
  Activity, 
  Users, 
  UserMinus, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreHorizontal,
  Calendar,
  Filter,
  Download,
  AlertCircle,
  Search,
  ChevronDown,
  RefreshCcw,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';

// Fake Data for Charts
const growthData = [
  { month: 'Jan', users: 1200, active: 800, new: 300, churned: 20 },
  { month: 'Feb', users: 1900, active: 1100, new: 720, churned: 45 },
  { month: 'Mar', users: 2400, active: 1500, new: 550, churned: 30 },
  { month: 'Apr', users: 3100, active: 2200, new: 800, churned: 60 },
  { month: 'May', users: 4200, active: 3100, new: 1200, churned: 100 },
  { month: 'Jun', users: 5800, active: 4500, new: 1700, churned: 150 },
  { month: 'Jul', users: 7100, active: 5800, new: 1450, churned: 180 },
];

const heatmapData = Array.from({ length: 7 }, (_, day) => 
  Array.from({ length: 24 }, (_, hour) => {
    // Generate realistic looking heatmap data (higher in evenings/weekends)
    const baseActivity = Math.floor(Math.random() * 30);
    const timeBoost = (hour >= 18 && hour <= 22) ? 50 : (hour >= 9 && hour <= 17) ? 20 : 0;
    const weekendBoost = (day >= 5) ? 20 : 0;
    return Math.min(100, baseActivity + timeBoost + weekendBoost);
  })
);

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const churnRiskUsers = [
  { id: 1, name: 'Alice Smith', role: 'Moderator', lastActive: '2 days ago', riskScore: 85, messages: 1205, joinDate: 'Jan 2023' },
  { id: 2, name: 'Bob Johnson', role: 'Member', lastActive: '5 days ago', riskScore: 72, messages: 432, joinDate: 'Mar 2023' },
  { id: 3, name: 'Charlie Brown', role: 'Contributor', lastActive: '1 week ago', riskScore: 64, messages: 890, joinDate: 'Feb 2023' },
  { id: 4, name: 'Diana Prince', role: 'Member', lastActive: '2 weeks ago', riskScore: 91, messages: 156, joinDate: 'May 2023' },
  { id: 5, name: 'Evan Wright', role: 'Member', lastActive: '3 days ago', riskScore: 58, messages: 342, joinDate: 'Jun 2023' },
  { id: 6, name: 'Fiona Gallagher', role: 'Admin', lastActive: '1 day ago', riskScore: 45, messages: 5432, joinDate: 'Dec 2022' },
  { id: 7, name: 'George Miller', role: 'Member', lastActive: '3 weeks ago', riskScore: 95, messages: 23, joinDate: 'Jul 2023' },
];

const recentActivities = [
  { id: 1, action: 'User milestone', details: 'Community reached 7,000 members', time: '2 hours ago', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 2, action: 'High activity detected', details: 'General channel saw 500% increase in messages', time: '5 hours ago', icon: Activity, color: 'text-[#25D366]', bg: 'bg-[#25D366]/10' },
  { id: 3, action: 'System update', details: 'Automated moderation rules updated', time: '1 day ago', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-50' },
];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

export default function CommunityAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnimating, setIsAnimating] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Slight delay to ensure smooth mounting animation
    const timer = setTimeout(() => setIsAnimating(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const maxTotalValue = Math.max(...growthData.map(d => d.users));

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Community Pulse</h1>
              <span className="px-2.5 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-semibold tracking-wide uppercase">Live</span>
            </div>
            <p className="text-gray-500 mt-2 text-sm max-w-xl">
              Comprehensive overview of community growth, member engagement patterns, and retention metrics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all"
              />
            </div>
            
            <div className="h-9 w-px bg-gray-200 hidden sm:block mx-1"></div>

            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Last 30 Days</span>
              <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
            </button>
            
            <button 
              onClick={handleRefresh}
              className={`p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>

            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:bg-[#20b858] transition-all shadow-[0_4px_12px_rgba(37,211,102,0.25)] hover:shadow-[0_6px_16px_rgba(37,211,102,0.3)] hover:-translate-y-0.5">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Members', value: '7,100', trend: '+12.5%', isPositive: true, icon: Users, desc: 'vs 6,310 last month' },
            { label: 'Active Users (MAU)', value: '5,800', trend: '+18.2%', isPositive: true, icon: Activity, desc: '81.6% of total users' },
            { label: 'Avg. Engagement', value: '64.3%', trend: '-2.1%', isPositive: false, icon: TrendingUp, desc: 'Messages & reactions' },
            { label: 'Churn Rate', value: '2.4%', trend: '-0.8%', isPositive: true, icon: UserMinus, desc: 'Target: < 3.0%' },
          ].map((stat, i) => (
            <Card key={i} className="hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-50 to-transparent rounded-bl-full -z-10 opacity-50 group-hover:scale-110 transition-transform"></div>
              
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{stat.value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl ${stat.isPositive && i !== 2 ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-gray-100 text-gray-500'}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              
              <div className="mt-5 flex items-center justify-between border-t border-gray-50 pt-4">
                <div className={`flex items-center gap-1 text-sm font-semibold ${stat.isPositive ? 'text-[#25D366]' : 'text-red-500'}`}>
                  {stat.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {stat.trend}
                </div>
                <span className="text-xs font-medium text-gray-400">{stat.desc}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart - Growth Analytics */}
          <Card className="col-span-1 lg:col-span-2 flex flex-col min-h-[450px]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Growth Trajectory</h2>
                <p className="text-sm text-gray-500 mt-1">Comparing total community size vs active engagement</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg">
                <button className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm border border-gray-200">12M</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">6M</button>
                <button className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">30D</button>
              </div>
            </div>
            
            <div className="flex-1 relative mt-4">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs font-medium text-gray-400 pb-2">
                <span>8k</span>
                <span>6k</span>
                <span>4k</span>
                <span>2k</span>
                <span>0</span>
              </div>
              
              <div className="w-full flex justify-between items-end h-full pl-10 pb-8 relative border-b border-gray-200">
                {/* Horizontal grid lines */}
                <div className="absolute inset-0 pl-10 flex flex-col justify-between pointer-events-none">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-full border-t border-gray-100 border-dashed h-0" />
                  ))}
                </div>

                {growthData.map((data, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 group relative z-10 w-full px-1 sm:px-3">
                    
                    {/* Elaborate Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl p-3 shadow-2xl transition-all duration-200 z-30 pointer-events-none w-48 scale-95 group-hover:scale-100 origin-bottom">
                      <div className="font-bold text-sm border-b border-gray-700 pb-2 mb-2 flex justify-between">
                        <span>{data.month} 2023</span>
                        <span className="text-gray-400">Total: {data.users}</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-300">Active</span>
                          <span className="font-semibold text-[#25D366]">{data.active}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">New Joined</span>
                          <span className="font-semibold text-blue-400">+{data.new}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">Churned</span>
                          <span className="font-semibold text-red-400">-{data.churned}</span>
                        </div>
                      </div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                    
                    <div className="flex items-end justify-center w-full gap-1 sm:gap-2 h-64 sm:h-72">
                      {/* Total Users Bar */}
                      <div 
                        className="w-1/2 max-w-[24px] bg-gray-200 rounded-t-md transition-all duration-1000 ease-out group-hover:bg-gray-300"
                        style={{ height: isAnimating ? `${(data.users / maxTotalValue) * 100}%` : '0%' }}
                      />
                      {/* Active Users Bar */}
                      <div 
                        className="w-1/2 max-w-[24px] bg-[#25D366] rounded-t-md transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(37,211,102,0.15)] group-hover:brightness-110 relative overflow-hidden"
                        style={{ height: isAnimating ? `${(data.active / maxTotalValue) * 100}%` : '0%', transitionDelay: `${i * 100}ms` }}
                      >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 font-medium absolute -bottom-8">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-8 border-t border-gray-50 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded shadow-sm bg-gray-200"></div>
                <span className="text-sm font-medium text-gray-600">Total Registered Users</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded shadow-sm bg-[#25D366]"></div>
                <span className="text-sm font-medium text-gray-600">Monthly Active Users</span>
              </div>
            </div>
          </Card>

          {/* Right Column: Churn & Activity feed */}
          <div className="col-span-1 flex flex-col gap-8">
            
            {/* Churn Prediction */}
            <Card className="flex flex-col flex-1">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Churn Risk</h2>
                  <p className="text-sm text-gray-500">AI-predicted member drop-off</p>
                </div>
                <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <MoreHorizontal className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                {churnRiskUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white transition-all group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-50 to-gray-200 border border-gray-200 flex items-center justify-center font-bold text-gray-700 shadow-sm">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{user.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{user.role}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span className="text-xs text-gray-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{user.lastActive}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        user.riskScore > 80 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {user.riskScore}% Risk
                      </div>
                      <span className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user.messages} msgs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all">
                View All At-Risk Members
              </button>
            </Card>

            {/* Quick Activity Feed */}
            <Card>
              <h2 className="text-lg font-bold text-gray-900 mb-4">System Alerts</h2>
              <div className="space-y-4">
                {recentActivities.map(activity => (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activity.bg} ${activity.color}`}>
                      <activity.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{activity.details}</p>
                      <p className="text-xs font-medium text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>

        {/* Bottom Section: Heatmap */}
        <Card className="overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Member Activity Heatmap</h2>
              <p className="text-sm text-gray-500 mt-1">Identify optimal times for announcements and events based on historical engagement.</p>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Level</span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-gray-400">Low</span>
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-[4px] bg-gray-100 border border-gray-200"></div>
                  <div className="w-5 h-5 rounded-[4px] bg-[#25D366]/20"></div>
                  <div className="w-5 h-5 rounded-[4px] bg-[#25D366]/40"></div>
                  <div className="w-5 h-5 rounded-[4px] bg-[#25D366]/70"></div>
                  <div className="w-5 h-5 rounded-[4px] bg-[#25D366] shadow-[0_0_8px_rgba(37,211,102,0.4)]"></div>
                </div>
                <span className="text-xs text-gray-400 ml-1">High</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="min-w-[800px] select-none">
              {/* X-axis labels (Hours) */}
              <div className="flex ml-14 mb-3 border-b border-gray-100 pb-2">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 text-center text-xs font-medium text-gray-400">
                    {i === 0 ? '12A' : i === 12 ? '12P' : i > 12 ? `${i-12}P` : `${i}A`}
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col gap-1.5">
                {days.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-3">
                    {/* Y-axis label (Day) */}
                    <div className="w-11 text-xs font-bold text-gray-500 text-right uppercase tracking-wide">{day}</div>
                    
                    {/* Heatmap blocks */}
                    <div className="flex-1 flex gap-1.5">
                      {heatmapData[dayIdx].map((value, hourIdx) => {
                        // Determine color intensity based on value
                        let intensityClass = 'bg-gray-50 border-gray-100';
                        if (value > 80) intensityClass = 'bg-[#25D366] border-[#25D366] shadow-[0_0_10px_rgba(37,211,102,0.3)] z-10';
                        else if (value > 60) intensityClass = 'bg-[#25D366]/80 border-[#25D366]/80';
                        else if (value > 40) intensityClass = 'bg-[#25D366]/50 border-[#25D366]/50';
                        else if (value > 20) intensityClass = 'bg-[#25D366]/20 border-[#25D366]/20';

                        return (
                          <div 
                            key={hourIdx} 
                            className={`flex-1 aspect-[4/3] rounded-[4px] border ${intensityClass} transition-all duration-200 hover:ring-2 hover:ring-gray-900/20 hover:scale-110 cursor-pointer relative group`}
                          >
                            {/* Heatmap Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs font-medium rounded-lg py-1.5 px-3 whitespace-nowrap z-30 pointer-events-none shadow-xl scale-90 group-hover:scale-100 transition-all origin-bottom">
                              <span className="block text-center text-gray-300 mb-0.5">{day}, {hourIdx}:00</span>
                              <span className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-[#25D366]" />
                                {value}% Activity
                              </span>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

      </div>
      
      {/* Global styles for custom scrollbar and animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
}
