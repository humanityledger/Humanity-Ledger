"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Mail, MessageSquare, Send, Check, X, AlertCircle, Sparkles, TestTube } from 'lucide-react';
import TelegramLoginButton from './TelegramLoginButton';

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
  config: Record<string, string>;
  status: 'connected' | 'disconnected' | 'testing';
}

export default function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: 'email',
      name: 'Email',
      icon: <Mail size={24} />,
      enabled: false,
      config: { address: '' },
      status: 'disconnected',
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: <Send size={24} />,
      enabled: false,
      config: { chatId: '', topicId: '' },
      status: 'disconnected',
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: <MessageSquare size={24} />,
      enabled: false,
      config: { webhookUrl: '' },
      status: 'disconnected',
    },
  ]);

  const [alertTypes, setAlertTypes] = useState({
    ledgerMovement: { enabled: true, threshold: 500000000 }, // $500,000,000
    priceAlert: { enabled: true },
    smartMoneyChange: { enabled: true, minChange: 10 },
    dailyDigest: { enabled: false },
  });

  const [testing, setTesting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleToggleChannel = (channelId: string) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, enabled: !ch.enabled } : ch
      )
    );
  };

  const handleConfigChange = (channelId: string, field: string, value: string) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.id === channelId
          ? { ...ch, config: { ...ch.config, [field]: value } }
          : ch
      )
    );
  };

  const handleTestNotification = async (channelId: string) => {
    const channel = channels.find(ch => ch.id === channelId);
    if (!channel) return;

    setTesting(channelId);

    try {
      let endpoint = '';
      let body: any = {
        type: 'custom',
        data: { message: 'Test notification from Humanity Ledger VIP ' },
      };

      switch (channelId) {
        case 'email':
          endpoint = '/api/notifications/email';
          body.to = channel.config.address;
          body.type = 'ledger_alert';
          body.data = {
            address: '0x1234567890123456789012345678901234567890',
            type: 'SWAP',
            amount: 250000,
            token: 'ETH',
          };
          break;
        
        case 'telegram':
          const topicParam = channel.config.topicId ? `&topicId=${channel.config.topicId}` : '';
          endpoint = `/api/notifications/telegram?chatId=${channel.config.chatId}${topicParam}`;
          break;
        
        case 'discord':
          endpoint = '/api/notifications/discord';
          body.webhookUrl = channel.config.webhookUrl;
          body.type = 'ledger_alert';
          body.data = {
            address: '0x1234567890123456789012345678901234567890',
            type: 'SWAP',
            amount: 250000,
            token: 'ETH',
          };
          break;
      }

      const response = await fetch(endpoint, {
        method: channelId === 'telegram' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(channelId !== 'telegram' && { body: JSON.stringify(body) }),
      });

      if (response.ok) {
        setChannels(prev =>
          prev.map(ch =>
            ch.id === channelId ? { ...ch, status: 'connected' } : ch
          )
        );
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      alert(`Test failed for ${channel.name}. Check your configuration.`);
    } finally {
      setTesting(null);
    }
  };

  const [loading, setLoading] = useState(true);

  // Load from database on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/user/settings/notifications');
        const data = await response.json();
        
        if (data.settings) {
          const s = data.settings;
          setChannels(prev => prev.map(ch => {
            if (ch.id === 'telegram') {
              return { 
                ...ch, 
                enabled: s.telegramEnabled || false, 
                config: { 
                  chatId: String(s.telegramChatId || ''), 
                  topicId: String(s.telegramTopicId || ''),
                  username: String(s.telegramUsername || '') 
                },
                status: s.telegramChatId ? 'connected' : 'disconnected'
              } as NotificationChannel;
            }
            if (ch.id === 'email') {
              return { 
                ...ch, 
                enabled: s.emailNotifications || false, 
                config: { address: String(s.emailAddress || '') } 
              } as NotificationChannel;
            }
            return ch;
          }));

          // LOAD TRIGGER THRESHOLDS
          if (s.ledgerThreshold) {
            setAlertTypes(prev => ({
              ...prev,
              ledgerMovement: { 
                ...prev.ledgerMovement, 
                threshold: Number(s.ledgerThreshold) 
              }
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    const telegram = channels.find(c => c.id === 'telegram');
    const email = channels.find(c => c.id === 'email');

    setIsSaving(true);
    try {
      const response = await fetch('/api/user/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramEnabled: telegram?.enabled,
          telegramChatId: telegram?.config.chatId,
          telegramTopicId: telegram?.config.topicId,
          telegramUsername: telegram?.config.username,
          ledgerThreshold: Number(alertTypes.ledgerMovement.threshold),
          emailNotifications: email?.enabled,
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      alert('Failed to save settings to cloud.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#1F1F1F] flex items-center gap-3">
          <Bell className="text-purple-600" />
          Notification Settings
        </h1>
        <p className="text-sm text-[#1F1F1F]/70 mt-1">
          Configure multi-channel alerts for ledger tracking
        </p>
      </div>

      {/* Alert Info */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <Sparkles className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-emerald-900">
            <strong>Unlocked Feature!</strong> Get instant notifications via Email, Telegram, or Discord when:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Large ledger movements detected (customizable threshold)</li>
              <li>Price targets reached</li>
              <li>Smart Money scores change significantly</li>
              <li>Daily portfolio digest</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-[#1F1F1F]">Channels</h2>

        {channels.map(channel => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onToggle={() => handleToggleChannel(channel.id)}
            onConfigChange={(field, value) => handleConfigChange(channel.id, field, value)}
            onTest={() => handleTestNotification(channel.id)}
            testing={testing === channel.id}
          />
        ))}
      </div>

      {/* Alert Triggers */}
      <div className="p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#1F1F1F]/10 space-y-4">
        <h2 className="text-xl font-black text-[#1F1F1F]">Alert Triggers</h2>

        <div className="space-y-3">
          <TriggerToggle
            label="Ledger Movement Alerts"
            description="Notify when transaction exceeds threshold"
            enabled={alertTypes.ledgerMovement.enabled}
            onToggle={() =>
              setAlertTypes(prev => ({
                ...prev,
                ledgerMovement: { ...prev.ledgerMovement, enabled: !prev.ledgerMovement.enabled },
              }))
            }
          >
            <input
              type="number"
              value={alertTypes.ledgerMovement.threshold}
              onChange={e =>
                setAlertTypes(prev => ({
                  ...prev,
                  ledgerMovement: { ...prev.ledgerMovement, threshold: parseInt(e.target.value) },
                }))
              }
              className="px-3 py-2 bg-white border border-[#1F1F1F]/20 rounded-lg w-32"
              placeholder="500000000"
            />
            <span className="text-sm text-[#1F1F1F]/70">USD ($500,000,000)</span>
          </TriggerToggle>

          <TriggerToggle
            label="Price Alerts"
            description="Notify when price targets are reached"
            enabled={alertTypes.priceAlert.enabled}
            onToggle={() =>
              setAlertTypes(prev => ({
                ...prev,
                priceAlert: { ...prev.priceAlert, enabled: !prev.priceAlert.enabled },
              }))
            }
          />

          <TriggerToggle
            label="Smart Money Score Changes"
            description="Notify when wallet score changes significantly"
            enabled={alertTypes.smartMoneyChange.enabled}
            onToggle={() =>
              setAlertTypes(prev => ({
                ...prev,
                smartMoneyChange: { ...prev.smartMoneyChange, enabled: !prev.smartMoneyChange.enabled },
              }))
            }
          >
            <input
              type="number"
              value={alertTypes.smartMoneyChange.minChange}
              onChange={e =>
                setAlertTypes(prev => ({
                  ...prev,
                  smartMoneyChange: { ...prev.smartMoneyChange, minChange: parseInt(e.target.value) },
                }))
              }
              className="px-3 py-2 bg-white border border-[#1F1F1F]/20 rounded-lg w-20"
              placeholder="10"
            />
            <span className="text-sm text-[#1F1F1F]/70">points</span>
          </TriggerToggle>

          <TriggerToggle
            label="Daily Digest"
            description="Receive daily summary at 9:00 AM"
            enabled={alertTypes.dailyDigest.enabled}
            onToggle={() =>
              setAlertTypes(prev => ({
                ...prev,
                dailyDigest: { ...prev.dailyDigest, enabled: !prev.dailyDigest.enabled },
              }))
            }
          />
        </div>
      </div>

      {/* Save Button */}
      <button 
        id="save-settings-btn"
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
          showSuccess 
            ? 'bg-green-600 text-white' 
            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
        } disabled:opacity-70 disabled:cursor-not-allowed`}
      >
        {isSaving ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Sparkles size={20} />
            </motion.div>
            Saving Settings...
          </>
        ) : showSuccess ? (
          <>
            <Check size={20} />
            Saved Successfully!
          </>
        ) : (
          <>
            <span></span>
            Save Settings
          </>
        )}
      </button>
    </div>
  );
}

function ChannelCard({
  channel,
  onToggle,
  onConfigChange,
  onTest,
  testing,
}: {
  channel: NotificationChannel;
  onToggle: () => void;
  onConfigChange: (field: string, value: string) => void;
  onTest: () => void;
  testing: boolean;
}) {
  const getSetupInstructions = () => {
    switch (channel.id) {
      case 'email':
        return 'Enter your email address to receive alerts';
      case 'telegram':
        return '1. Search @HumanDeFiBot on Telegram\n2. Send /start\n3. Copy your Chat ID and paste below';
      case 'discord':
        return '1. Right-click Discord channel  Edit Channel\n2. Integrations  Webhooks  New Webhook\n3. Copy webhook URL and paste below';
      default:
        return '';
    }
  };

  const getConfigField = () => {
    switch (channel.id) {
      case 'email':
        return {
          label: 'Email Address',
          placeholder: 'your@email.com',
          type: 'email',
          field: 'address',
        };
      case 'telegram':
        return {
          label: 'Chat ID',
          placeholder: '123456789',
          type: 'text',
          field: 'chatId',
        };
      case 'discord':
        return {
          label: 'Webhook URL',
          placeholder: 'https://discord.com/api/webhooks/...',
          type: 'url',
          field: 'webhookUrl',
        };
      default:
        return null;
    }
  };

  const configField = getConfigField();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#1F1F1F]/10"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
            {channel.icon}
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1F1F1F]">{channel.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {channel.status === 'connected' && (
                <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                  <Check size={14} /> Connected
                </span>
              )}
              {channel.status === 'disconnected' && (
                <span className="flex items-center gap-1 text-xs font-bold text-[#1F1F1F]/50">
                  <AlertCircle size={14} /> Not configured
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onToggle}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            channel.enabled
              ? 'bg-purple-600 text-white'
              : 'bg-[#1F1F1F]/10 text-[#1F1F1F]/70'
          }`}
        >
          {channel.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {channel.enabled && (
        <div className="space-y-4">
          {channel.id === 'telegram' ? (
            <div className="space-y-4">
              {channel.config.chatId ? (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-green-800 uppercase tracking-wider mb-1">
                      Connected Account
                    </p>
                    <p className="font-mono text-green-900 font-bold">
                      {channel.config.username ? `@${channel.config.username}` : `ID: ${channel.config.chatId}`}
                    </p>
                  </div>
                  <button
                    onClick={() => onConfigChange('chatId', '')}
                    className="text-xs text-indigo-500 hover:underline font-bold"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="flex justify-center py-2">
                  <TelegramLoginButton 
                    botName="warningledgersbot"
                    onAuth={(user) => {
                      onConfigChange('chatId', user.id.toString());
                      if (user.username) {
                        onConfigChange('username', user.username);
                      }
                    }}
                  />
                </div>
              )}
              {channel.config.chatId && (
                <div className="mt-2">
                  <label className="block text-xs font-bold text-[#1F1F1F]/70 mb-1">
                    Topic ID / Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={channel.config.topicId || ''}
                    onChange={e => {
                      let val = e.target.value;
                      // Smart Parse: If URL is pasted, extract the last numeric segment
                      // Example: https://t.me/Humanity LedgerFi/1367 -> 1367
                      if (val.includes('t.me/') || val.includes('telegram.org/')) {
                        const parts = val.split('/');
                        const lastPart = parts[parts.length - 1];
                        if (lastPart && /^\d+$/.test(lastPart)) {
                          val = lastPart; // Auto extract
                        }
                      }
                      onConfigChange('topicId', val);
                    }}
                    placeholder="Paste link (e.g. t.me/mygroup/1367) or ID"
                    className="w-full px-4 py-2 bg-white border border-[#1F1F1F]/20 rounded-xl outline-none text-sm focus:border-purple-600"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 pl-1">
                    Tip: Paste the full topic link and we'll extract the ID automatically.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-900 whitespace-pre-line">
                {getSetupInstructions()}
              </div>

              {configField && (
                <div>
                  <label className="block text-sm font-bold text-[#1F1F1F] mb-2">
                    {configField.label}
                  </label>
                  <input
                    type={configField.type}
                    value={channel.config[configField.field] || ''}
                    onChange={e => onConfigChange(configField.field, e.target.value)}
                    placeholder={configField.placeholder}
                    className="w-full px-4 py-3 bg-white border border-[#1F1F1F]/20 rounded-xl outline-none focus:border-purple-600"
                  />
                </div>
              )}
            </>
          )}

          <button
            onClick={onTest}
            disabled={testing || (channel.id === 'telegram' ? !channel.config.chatId : !channel.config[configField?.field || ''])}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F1F1F] text-white rounded-xl font-bold hover:bg-[#1F1F1F]/90 transition-all disabled:opacity-50 w-full justify-center"
          >
            <TestTube size={16} />
            {testing ? 'Sending Test...' : 'Send Test Notification'}
          </button>
        </div>
      )}
    </motion.div>
  );
}

function TriggerToggle({
  label,
  description,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-white rounded-xl border border-[#1F1F1F]/10">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-[#1F1F1F]">{label}</h4>
            <button
              onClick={onToggle}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-[#1F1F1F]/10 text-[#1F1F1F]/50'
              }`}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <p className="text-sm text-[#1F1F1F]/70 mt-1">{description}</p>
          
          {enabled && children && (
            <div className="flex items-center gap-2 mt-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



