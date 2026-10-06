"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellRing, Zap, TrendingUp, TrendingDown, Copy, CheckCircle, X, Plus, Filter, Send } from 'lucide-react';
import PremiumLocked from './PremiumLocked';
import { useSocket } from "@/hooks/useSocket";

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface SmartAlert {
  id: string;
  type: 'ledger_move' | 'smart_buy' | 'smart_sell' | 'profit_target' | 'risk_alert' | 'copy_signal';
  walletLabel: string;
  walletAddress: string;
  title: string;
  description: string;
  action?: {
    type: 'BUY' | 'SELL' | 'TRANSFER';
    token: string;
    amount: number;
    usdValue: number;
  };
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  copyable?: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    type: string;
    value: any;
  }[];
  actions: {
    telegram?: boolean;
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
}

export default function SmartAlertsEngine({ isPremium, selectedWalletAddress }: { isPremium: boolean, selectedWalletAddress?: string }) {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [showCreateRule, setShowCreateRule] = useState(false);

  const { on, off } = useSocket();

  // Fetch rules from real backend
  useEffect(() => {
    if (!isPremium) return;

    const fetchRules = async () => {
        try {
            const walletRes = await fetch('/api/user/wallet'); 
            const walletData = await walletRes.json();
            if (walletData?.address) {
                const res = await fetch(`/api/user/alert-rules?userId=${walletData.address}`);
                const data = await res.json();
                if (data.rules) setAlertRules(data.rules);
            }
        } catch (e) {
            console.error("Failed to load alert rules", e);
        }
    };

    fetchRules();

    // Fetch alerts (Persistent History)
    const fetchAlerts = async () => {
        try {
            const walletRes = await fetch('/api/user/wallet'); 
            const walletData = await walletRes.json();
            
            if (walletData?.address) {
                // Fetch persisted notifications from DB
                const res = await fetch(`/api/user/notifications?userId=${walletData.address}`);
                const data = await res.json();
                if (data.alerts) setAlerts(data.alerts);
            }
        } catch (e) {
            console.error("Failed to fetch alerts", e);
        }
    };
    fetchAlerts();
    
    // WebSocket Listener for real-time "Push"
    const handleNewAlert = (data: any) => {
      console.log(" [SmartAlerts] Instanteous Push Received:", data);
      
      const newAlert: SmartAlert = {
        id: data.hash || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
        type: 'ledger_move',
        walletLabel: 'Ledger Tracker',
        walletAddress: data.from || '0x',
        title: `Ballena Detectada: ${data.amount} ${data.asset}`,
        description: `Se ha detectado un movimiento institucional de ${(data.usdValue/1000000).toFixed(2)}M USD en ${data.chain}.`,
        action: {
          type: 'TRANSFER',
          token: data.asset,
          amount: data.amount,
          usdValue: data.usdValue
        },
        timestamp: new Date(),
        priority: data.usdValue > 1000000 ? 'critical' : 'high',
        read: false
      };

      setAlerts(prev => {
        if (prev.some(a => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev].slice(0, 50);
      });
    };

    on('new-ledger-alert', handleNewAlert);
    return () => off('new-ledger-alert', handleNewAlert);

  }, [on, off, isPremium]);


  const filteredAlerts = alerts.filter(alert => {
    // [MASTER-FILTER] Filter by selected wallet if provided
    if (selectedWalletAddress && alert.walletAddress.toLowerCase() !== selectedWalletAddress.toLowerCase()) {
        return false;
    }
    if (filter === 'unread') return !alert.read;
    if (filter === 'critical') return alert.priority === 'critical';
    return true;
  });

  const unreadCount = alerts.filter(a => !a.read).length;

  const handleCopyAttest = (alert: SmartAlert) => {
    if (!alert.copyable || !alert.action) return;
    window.alert(` Copy Attest Executed!\n\n${alert.action.type} ${safeToLocaleString(alert.action.amount)} ${alert.action.token}\nValue: $${safeToLocaleString(alert.action.usdValue)}`);
  };

  const handleMarkRead = async (id: string) => {
      // Optimistic
      setAlerts(alerts.map(a => a.id === id ? { ...a, read: true } : a));
      try {
          await fetch('/api/user/notifications', {
              method: 'PUT',
              body: JSON.stringify({ id, read: true })
          });
      } catch (e) {
          console.error("Failed to mark read", e);
      }
  };

  const toggleRule = async (ruleId: string) => {
    const rule = alertRules.find(r => r.id === ruleId);
    if (!rule) return;

    const newEnabled = !rule.enabled;
    // Optimistic update
    setAlertRules(rules =>
      rules.map(r => r.id === ruleId ? { ...r, enabled: newEnabled } : r)
    );

    try {
        await fetch(`/api/user/alert-rules?id=${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled: newEnabled })
        });
    } catch (e) {
        // Revert on error
        setAlertRules(rules =>
            rules.map(r => r.id === ruleId ? { ...r, enabled: !newEnabled } : r)
        );
        console.error("Failed to toggle rule", e);
    }
  };

  const handleCreateRule = async (name: string, channels: any) => {
    try {
        const walletRes = await fetch('/api/user/wallet'); 
        const walletData = await walletRes.json();
        
        if (!walletData?.address) {
            alert("Error: No user wallet found.");
            return;
        }

        const res = await fetch('/api/user/alert-rules', {
            method: 'POST',
            body: JSON.stringify({
                userId: walletData.address,
                name,
                actions: channels,
                conditions: [{ type: 'custom', value: 'all' }]
            })
        });

        if (res.ok) {
            const { rule } = await res.json();
            setAlertRules(prev => [rule, ...prev]);
            setShowCreateRule(false);
            alert("Rule created successfully! Notifications will be sent to your configured channels.");
        }
    } catch (e) {
        console.error("Failed to create rule", e);
        alert("Failed to create rule.");
    }
  };

  /* 
  if (!isPremium) {
    return (
      <PremiumLocked
        feature="Smart Alerts Engine"
        description="Get instant notifications when ledgers make moves, prices spike, or unusual volume is detected. Never miss a attesting opportunity."
        icon="zap"
        onUpgrade={() => {
          const upgradeBtn = document.querySelector('[data-upgrade-trigger="true"]') as HTMLButtonElement;
          upgradeBtn?.click();
        }}
      />
    );
  }
  */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shadow-xl backdrop-blur-md">
                <BellRing className="text-blue-400" size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter uppercase italic">
                Elite Intel
                {unreadCount > 0 && (
                  <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-900/40 animate-pulse">
                    {unreadCount} NEW SIGNAL
                  </span>
                )}
              </h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">
                Deep Space AI Surveillance Active
              </p>
            </div>
        </div>

        <button
          onClick={() => setShowCreateRule(true)}
          className="px-6 py-3 bg-white text-black rounded-xl font-black hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl uppercase text-xs tracking-widest"
        >
          <Plus size={18} />
          Configure Alerts
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
        {(['all', 'unread', 'critical'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all capitalize tracking-widest ${
              filter === f ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredAlerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              index={index}
              onCopyAttest={handleCopyAttest}
              onMarkRead={() => handleMarkRead(alert.id)}
            />
          ))}
        </AnimatePresence>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-24 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
            <Bell size={64} className="mx-auto mb-6 opacity-10" />
            <p className="text-2xl font-black text-white uppercase tracking-tighter">No signals detected</p>
            <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-2">The blockchain is currently silent</p>
          </div>
        )}
      </div>

      {/* Alert Rules */}
      <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <Filter size={120} />
        </div>
        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3 uppercase italic tracking-tighter">
          <Zap className="text-blue-400" />
          Active Protocols
        </h3>

        <div className="space-y-4">
          {alertRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all"
            >
              <div className="flex-1">
                <div className="font-black text-white mb-2 uppercase tracking-tight">{rule.name}</div>
                <div className="flex gap-2">
                  {rule.actions.telegram && <ActionBadge icon="" label="Telegram" />}
                  {rule.actions.push && <ActionBadge icon="" label="Push" />}
                  {rule.actions.email && <ActionBadge icon="" label="Email" />}
                  {rule.actions.sms && <ActionBadge icon="" label="SMS" />}
                </div>
              </div>

              <button
                onClick={() => toggleRule(rule.id)}
                className={`px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest transition-all ${
                  rule.enabled
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {rule.enabled ? 'ACTIVE' : 'DISABLED'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <CreateRuleModal 
        isOpen={showCreateRule} 
        onClose={() => setShowCreateRule(false)} 
        onCreate={handleCreateRule} 
      />
    </div>
  );
}

function CreateRuleModal({ isOpen, onClose, onCreate }: { isOpen: boolean, onClose: () => void, onCreate: (name: string, actions: any) => void }) {
  const [name, setName] = useState('');
  const [actions, setActions] = useState({ telegram: true, push: true, email: false, sms: false });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0B0E11] w-full max-w-md rounded-[2.5rem] p-10 border border-white/10 shadow-3xl">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Configure Signal</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"><X size={28} /></button>
        </div>
        
        <div className="space-y-8">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-3">Protocol Identity</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LEDGER WATCHER ALPHA" 
              className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-[#25D366] text-white font-bold transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-4">Transmission Channels</label>
            <div className="grid grid-cols-2 gap-3">
              {(['telegram', 'push', 'email', 'sms'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setActions(prev => ({ ...prev, [ch]: !prev[ch] }))}
                  className={`p-4 rounded-2xl border-2 font-black transition-all text-[10px] uppercase tracking-widest flex items-center gap-3 ${
                    actions[ch] ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-900/40' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'
                  }`}
                >
                  <span className="text-lg">
                    {ch === 'telegram' && ''}
                    {ch === 'push' && ''}
                    {ch === 'email' && ''}
                    {ch === 'sms' && ''}
                  </span>
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => { if(name) onCreate(name, actions); }}
            className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all shadow-2xl"
          >
            Deploy Rule
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AlertCard({ alert, index, onCopyAttest, onMarkRead }: {
  alert: SmartAlert;
  index: number;
  onCopyAttest: (alert: SmartAlert) => void;
  onMarkRead: () => void;
}) {
  const getPriorityStyles = (priority: string) => {
    switch(priority) {
      case 'critical': return 'border-[#25D366] bg-blue-600/5 shadow-blue-900/10';
      case 'high': return 'border-purple-500 bg-purple-600/5 shadow-purple-900/10';
      case 'medium': return 'border-white/20 bg-white/5';
      default: return 'border-gray-800 bg-gray-900/5';
    }
  };

  const eurRate = 0.92;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className={`relative p-6 rounded-3xl border backdrop-blur-3xl transition-all group overflow-hidden ${getPriorityStyles(alert.priority)} ${
        alert.read ? 'opacity-40 grayscale-[0.5]' : 'ring-1 ring-white/5 shadow-2xl'
      }`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
          <img src="/logo-mark.png" alt="Logo" className="w-16 h-16 object-contain" />
      </div>

      <div className="flex items-start justify-between gap-6 relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl font-black text-white uppercase italic tracking-tighter">{alert.title}</span>
            {alert.priority === 'critical' && (
                <span className="px-2 py-0.5 bg-blue-600 text-[8px] font-black text-white rounded uppercase tracking-[0.2em]">Critical</span>
            )}
            {!alert.read && (
              <div className="w-2.5 h-2.5 bg-[#25D366] rounded-full animate-ping" />
            )}
          </div>
          
          <p className="text-sm font-medium text-gray-400 mb-5 leading-relaxed max-w-2xl">{alert.description}</p>

          {alert.action && (
            <div className="flex flex-wrap items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                alert.action.type === 'BUY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                alert.action.type === 'SELL' ? 'bg-red-500/10 text-red-100 border border-red-500/20' :
                'bg-[#25D366]/10 text-blue-400 border border-[#25D366]/20'
              }`}>
                {alert.action.type}
              </div>
              <div className="flex flex-col">
                  <span className="font-black text-white text-lg">
                    {alert.action.amount.toLocaleString('de-DE')} {alert.action.token}
                  </span>
                  <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-gray-300">
                        ${alert.action.usdValue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        ({(alert.action.usdValue * eurRate).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                  </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-500">W</div>
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{alert.walletLabel}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600/50" />
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
            </div>
            {alert.copyable && (
              <button
                onClick={() => onCopyAttest(alert)}
                className="text-[10px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-2 uppercase tracking-widest ml-auto"
              >
                <Copy size={14} />
                Mirror Execution
              </button>
            )}
          </div>
        </div>

        {!alert.read && (
          <button
            onClick={onMarkRead}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all shadow-xl"
            title="Mark as analyzed"
          >
            <CheckCircle size={24} className="text-blue-400" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ActionBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest">
      <span className="text-sm">{icon}</span> {label}
    </span>
  );
}


