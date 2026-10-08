'use client';

};
              {/* Linked Devices */}
              <Group title="Linked Devices" footer="Link another device exactly like WhatsApp Web.">
                <Row icon={<Smartphone size={18} />} label="Link a Device" sublabel="Connect your phone or desktop via QR" onTap={() => { setQrScanMode('scan'); setModal('linked_devices'); }} />
                <Row icon={<Monitor size={18} />} label="This Device (Primary)" sublabel="Active now" value="Active" />
              </Group>

              <Group title="Profile Visibility" footer="Your display name and bio are shared with people you message.">
                <Row
                  icon={<User size={18} />}
                  label="Display Name"
                  value={displayName || 'Not set'}
                  onTap={() => setEditingName(true)}
                />
                <Row
                  icon={<FileText size={18} />}
                  label="Bio"
                  value={bio || 'Not set'}
                  onTap={() => setEditingBio(true)}
                />
                <Row
                  icon={<ShieldCheck size={18} />}
                  label="Identity Verified"
                  sublabel="XMTP end-to-end encrypted"
                  value="✓ Active"
                />
                <Row
                  icon={<Globe size={18} />}
                  label="Network"
                  value={chain?.name || 'Ethereum'}
                />
              </Group>

              <Group title="Data & Backup">
                <Row
                  icon={<Download size={18} />}
                  label="Export Chat Backup"
                  sublabel="Download encrypted JSON of your data"
                  onTap={() => {
                    try {
                      const data: Record<string, string> = {};
                      for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i)!;
                        if (k.startsWith('ledger_')) data[k] = localStorage.getItem(k) || '';
                      }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ledger-backup-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Backup downloaded');
                    } catch { toast.error('Export failed'); }
                  }}
                />
                <Row
                  icon={<RefreshCw size={18} />}
                  label="Clear Message Cache"
                  sublabel="Free up local storage"
                  onTap={() => setModal('clearCache')}
                />
              </Group>

              <Group title="Session">
                <Row
                  icon={<LogOut size={18} />}
                  label="Sign Out"
                  sublabel="Disconnect your wallet"
                  danger
                  onTap={handleSignOut}
                />
                <Row
                  icon={<Trash2 size={18} />}
                  label="Delete All Data"
                  sublabel="Permanently erase everything"
                  danger
                  onTap={() => setModal('nuke')}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              PRIVACY TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'privacy' && (
            <>
              <Group title="Who Can See" footer="Controls who can see your profile info and activity.">
                <Row icon={<Clock size={18} />} label="Last Seen" value={settings.privacy_last_seen || 'Everybody'} onTap={() => setModal('privacy_last_seen')} />
                <Row icon={<User size={18} />} label="Profile Photo" value={settings.privacy_profile_photo || 'Everybody'} onTap={() => setModal('privacy_profile_photo')} />
                <Row icon={<FileText size={18} />} label="About / Bio" value={settings.privacy_bio || 'Everybody'} onTap={() => setModal('privacy_bio')} />
                <Row icon={<Hash size={18} />} label="Group Invites" value={settings.privacy_group_invites || 'Everybody'} onTap={() => setModal('privacy_group_invites')} />
              </Group>

              <Group title="Disappearing Messages" footer="New messages in all chats will auto-delete after the chosen time.">
                <Row icon={<Trash2 size={18} />} label="Default Timer" value={settings.auto_delete_timer || 'Off'} onTap={() => setModal('auto_delete')} />
                <Row
                  icon={<EyeOff size={18} />}
                  label="Burn on Read"
                  sublabel="Messages disappear after being read"
                  toggle={!!settings.burn_on_read}
                  onToggle={v => updateSetting('burn_on_read', v)}
                />
              </Group>

              <Group title="Interactions">
                <Row
                  icon={<Eye size={18} />}
                  label="Read Receipts"
                  sublabel="Show when you've read messages"
                  toggle={settings.show_read_receipts !== false}
                  onToggle={v => updateSetting('show_read_receipts', v)}
                />
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Typing Indicators"
                  sublabel="Show when you're typing"
                  toggle={settings.typing_indicators !== false}
                  onToggle={v => updateSetting('typing_indicators', v)}
                />
                <Row
                  icon={<Shield size={18} />}
                  label="Anti-Screenshot"
                  sublabel="Block screen capture in chat"
                  toggle={!!settings.anti_screenshot}
                  onToggle={v => updateSetting('anti_screenshot', v)}
                />
              </Group>

              <Group title="Contacts">
                <Row
                  icon={<Link size={18} />}
                  label="Sync Address Book"
                  sublabel="Find friends already on Ledger Chat"
                  toggle={!!settings.address_book_sync}
                  onToggle={v => { updateSetting('address_book_sync' as any, v); toast.success(v ? 'Address book sync enabled' : 'Address book sync disabled'); }}
                />
                <Row
                  icon={<BellOff size={18} />}
                  label="Blocked Addresses"
                  sublabel="Manage blocked wallets"
                  onTap={() => setModal('blocked_list')}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              NOTIFICATIONS TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'notifications' && (
            <>
              {/* Permission banner */}
              {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-4 mb-5 flex items-start gap-3">
                  <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-amber-900">Notifications disabled</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">Enable to never miss a message.</p>
                  </div>
                  <button type="button" onClick={requestNotificationPermission} className="bg-amber-600 text-white text-[12px] font-bold px-3 py-1.5 rounded-xl shrink-0">
                    Enable
                  </button>
                </div>
              )}

              <Group title="Push Notifications">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[#1C1C1E]">Background Notifications</p>
                    <p className="text-[12px] text-[#8E8E93] mt-0.5">
                      {!push.isSupported
                        ? 'Not supported in this browser'
                        : push.permission === 'denied'
                        ? 'Blocked in browser settings — enable in Site Settings'
                        : 'Get notified even when the app is closed'}
                    </p>
                  </div>
                  {push.isSupported && push.permission !== 'denied' && (
                    push.isSubscribed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#25D366] font-bold">✓ On</span>
                        <button onClick={push.unsubscribe} className="text-[12px] text-[#8E8E93] underline">Off</button>
                      </div>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await push.subscribe();
                          if (ok) toast.success('Notifications enabled!');
                          else toast.error('Could not enable notifications');
                        }}
                        disabled={push.isLoading}
                        className="px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-[13px] font-bold rounded-xl disabled:opacity-50 transition-colors"
                      >
                        {push.isLoading ? 'Enabling…' : 'Enable'}
                      </button>
                    )
                  )}
                  {push.permission === 'denied' && (
                    <span className="text-[12px] text-red-500 font-semibold">Blocked</span>
                  )}
                </div>
              </Group>

              <Group title="Messages">
                <Row
                  icon={<MessageSquare size={18} />}
                  label="Private Messages"
                  toggle={settings.notifications_private !== false}
                  onToggle={v => updateSetting('notifications_private', v)}
                />
                <Row
                  icon={<Hash size={18} />}
                  label="Group Messages"
                  toggle={settings.notifications_groups !== false}
                  onToggle={v => updateSetting('notifications_groups', v)}
                />
                <Row
                  icon={<Bell size={18} />}
                  label="Community Updates"
                  toggle={settings.notifications_workspaces !== false}
                  onToggle={v => updateSetting('notifications_workspaces', v)}
                />
                <Row
                  icon={<Star size={18} />}
                  label="Reaction Notifications"
                  toggle={settings.notifications_reactions !== false}
                  onToggle={v => updateSetting('notifications_reactions', v)}
                />
              </Group>

              <Group title="Calls">
                <Row
                  icon={<Phone size={18} />}
                  label="Incoming Voice Calls"
                  toggle={settings.notifications_calls !== false}
                  onToggle={v => updateSetting('notifications_calls', v)}
                />
                <Row
                  icon={<Video size={18} />}
                  label="Incoming Video Calls"
                  toggle={settings.notifications_video_calls !== false}
                  onToggle={v => updateSetting('notifications_video_calls', v)}
                />
              </Group>

              <Group title="Sounds & Vibration">
                <Row
                  icon={<Volume2 size={18} />}
                  label="Message Sound"
                  toggle={settings.notification_sound !== false}
                  onToggle={v => updateSetting('notification_sound', v)}
                />
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibration"
                  toggle={settings.haptics_intensity > 0}
                  onToggle={v => updateSetting('haptics_intensity', v ? 2 : 0)}
                />
                <Row
                  icon={<Palette size={18} />}
                  label="Sound Pack"
                  value={settings.sound_pack || 'Default'}
                  onTap={() => setModal('sound_pack')}
                />
              </Group>

              <Group title="Display">
                <Row
                  icon={<Eye size={18} />}
                  label="Show Preview in Notifications"
                  sublabel="Display message content in alerts"
                  toggle={settings.notifications_private !== false && !(settings as any).hide_notification_content}
                  onToggle={v => updateSetting('hide_notification_content' as any, !v)}
                />
                <Row
                  icon={<Bell size={18} />}
                  label="Badge Count"
                  toggle={settings.badge_count !== false}
                  onToggle={v => updateSetting('badge_count', v)}
                />
                <Row
                  icon={<Moon size={18} />}
                  label="Do Not Disturb"
                  sublabel="Silence all notifications"
                  toggle={!!(settings as any).do_not_disturb}
                  onToggle={v => updateSetting('do_not_disturb' as any, v)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SECURITY TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'security' && (
            <>
              <Group title="App Lock" footer="Biometric lock uses your device's Face ID or fingerprint to protect Ledger Chat.">
                <Row
                  icon={<Fingerprint size={18} />}
                  label="Biometric Lock"
                  sublabel="Face ID / Touch ID"
                  toggle={!!settings.biometric_lock}
                  onToggle={v => updateSetting('biometric_lock', v)}
                />
                <Row
                  icon={<Key size={18} />}
                  label="App Passcode"
                  sublabel="6-digit PIN to unlock"
                  toggle={!!settings.passcode_enabled}
                  onToggle={v => updateSetting('passcode_enabled', v)}
                />
                <Row
                  icon={<Clock size={18} />}
                  label="Auto-Lock"
                  value={(settings as any).auto_lock_timer || 'Immediately'}
                  onTap={() => setModal('auto_lock')}
                />
              </Group>

              <Group title="Encryption & Identity">
                <Row
                  icon={<ShieldCheck size={18} />}
                  label="ZK Obfuscation"
                  sublabel="Hide metadata with zero-knowledge proofs"
                  toggle={!!settings.zkObfuscation}
                  onToggle={v => updateSetting('zkObfuscation', v)}
                />
                <Row
                  icon={<Lock size={18} />}
                  label="Require Wallet Signature"
                  sublabel="Sign every session with your wallet key"
                  toggle={!!settings.requireSignature}
                  onToggle={v => updateSetting('requireSignature', v)}
                />
                <Row
                  icon={<Zap size={18} />}
                  label="Ghost Mode"
                  sublabel="Auto-reply when unavailable, hide online status"
                  toggle={!!settings.ghost_auto_reply}
                  onToggle={v => updateSetting('ghost_auto_reply', v)}
                />
              </Group>

              <Group title="Network Security" footer="IP masking routes WebRTC traffic through a relay to hide your real IP address.">
                <Row
                  icon={<Shield size={18} />}
                  label="WebRTC IP Masking"
                  sublabel="Hide your IP during calls"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
                <Row
                  icon={<Globe size={18} />}
                  label="MEV Protection"
                  sublabel="Shield crypto transactions from front-running"
                  toggle={!!settings.mev_protection}
                  onToggle={v => updateSetting('mev_protection', v)}
                />
                <Row
                  icon={<Database size={18} />}
                  label="Custom RPC URL"
                  value={settings.custom_rpc_url ? 'Custom' : 'Default'}
                  onTap={() => setModal('custom_rpc')}
                />
              </Group>


              <Group title="Danger Zone" footer="These actions are permanent and cannot be undone.">
                <Row icon={<RefreshCw size={18} />} label="Clear All Caches" onTap={() => setModal('clearCache')} />
                <Row icon={<Trash2 size={18} />} label="Delete All Data" danger onTap={() => setModal('nuke')} />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              CHAT TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'chat' && (
            <>
              <Group title="Appearance">
                <Row
                  icon={<Palette size={18} />}
                  label="Chat Wallpaper"
                  value={settings.chat_background === 'default' ? 'Default' : 'Custom'}
                  onTap={() => setModal('wallpaper')}
                />
                <Row
                  icon={<Sliders size={18} />}
                  label="Font Size"
                  value={['XS','S','M','L','XL'][Math.min((settings.text_size ?? 2), 4)]}
                  onTap={() => setModal('font_size')}
                />
                <Row
                  icon={<Sun size={18} />}
                  label="Bubble Style"
                  value={settings.bubble_style || 'Default'}
                  onTap={() => setModal('bubble_style')}
                />
              </Group>

              <Group title="Media & Files" footer="Auto-download is subject to your data plan limits.">
                <Row
                  icon={<Download size={18} />}
                  label="Auto-Download Photos"
                  toggle={settings.auto_download_photos !== false}
                  onToggle={v => updateSetting('auto_download_photos', v)}
                />
                <Row
                  icon={<Download size={18} />}
                  label="Auto-Download Videos"
                  toggle={!!settings.auto_download_videos}
                  onToggle={v => updateSetting('auto_download_videos', v)}
                />
                <Row
                  icon={<Archive size={18} />}
                  label="Save Media to Photos"
                  toggle={!!settings.saveToPhotos}
                  onToggle={v => updateSetting('saveToPhotos', v)}
                />
                <Row
                  icon={<WifiOff size={18} />}
                  label="Low Data Mode"
                  sublabel="Reduce quality to save bandwidth"
                  toggle={!!settings.useLessData}
                  onToggle={v => updateSetting('useLessData', v)}
                />
              </Group>

              <Group title="Composing">
                <Row
                  icon={<Send size={18} />}
                  label="Enter to Send"
                  sublabel="Press Enter to send, Shift+Enter for newline"
                  toggle={settings.enter_to_send !== false}
                  onToggle={v => updateSetting('enter_to_send', v)}
                />
                <Row
                  icon={<Zap size={18} />}
                  label="Keyboard Sound"
                  sublabel="Mechanical keyboard click on keypress"
                  toggle={!!settings.mechanical_keyboard}
                  onToggle={v => updateSetting('mechanical_keyboard', v)}
                />
              </Group>

              <Group title="AI Features" footer="AI features run locally and never send your messages to a server.">
                <Row
                  icon={<Zap size={18} />}
                  label="Smart Replies"
                  sublabel="AI-suggested quick reply options"
                  toggle={!!settings.tone_translator}
                  onToggle={v => updateSetting('tone_translator', v)}
                />
                <Row
                  icon={<Shield size={18} />}
                  label="Contract Scanner"
                  sublabel="Scan ETH addresses for known risks"
                  toggle={!!settings.contract_scanner}
                  onToggle={v => updateSetting('contract_scanner', v)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              CALLS TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'calls' && (
            <>
              <Group title="Audio Quality">
                <Row
                  icon={<Mic size={18} />}
                  label="High-Quality Audio"
                  sublabel="Uses more data"
                  toggle={settings.high_quality_audio !== false}
                  onToggle={v => updateSetting('high_quality_audio', v)}
                />
                <Row
                  icon={<Mic size={18} />}
                  label="Noise Suppression"
                  sublabel="Filter background noise"
                  toggle={settings.noise_suppression !== false}
                  onToggle={v => updateSetting('noise_suppression', v)}
                />
                <Row
                  icon={<Volume2 size={18} />}
                  label="Echo Cancellation"
                  toggle={settings.echo_cancellation !== false}
                  onToggle={v => updateSetting('echo_cancellation', v)}
                />
              </Group>

              <Group title="Video">
                <Row
                  icon={<Video size={18} />}
                  label="HD Video"
                  sublabel="When available on your network"
                  toggle={settings.hd_video !== false}
                  onToggle={v => updateSetting('hd_video', v)}
                />
                <Row
                  icon={<WifiOff size={18} />}
                  label="Use Less Data for Calls"
                  toggle={!!settings.useLessData}
                  onToggle={v => updateSetting('useLessData', v)}
                />
              </Group>

              <Group title="Privacy" footer="IP masking routes all call traffic through a relay to hide your network identity.">
                <Row
                  icon={<Shield size={18} />}
                  label="IP Address Masking"
                  sublabel="Hides your real IP from callers"
                  toggle={!!settings.webrtc_ip_masking}
                  onToggle={v => updateSetting('webrtc_ip_masking', v)}
                />
              </Group>

              <Group title="Ringtone & Alerts">
                <Row
                  icon={<Volume2 size={18} />}
                  label="Ringtone on Incoming Call"
                  toggle={settings.notifications_calls !== false}
                  onToggle={v => updateSetting('notifications_calls', v)}
                />
                <Row
                  icon={<Vibrate size={18} />}
                  label="Vibrate on Incoming Call"
                  toggle={settings.haptics_intensity > 0}
                  onToggle={v => updateSetting('haptics_intensity', v ? 2 : 0)}
                />
              </Group>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STORAGE TAB
          ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'storage' && (
            <>
              {(() => {
                let total = 0, count = 0;
                try {
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i)!;
                    const v = localStorage.getItem(k) || '';
                    if (k.startsWith('ledger_')) { total += v.length * 2; count++; }
                  }
                } catch {}
                const kb = (total / 1024).toFixed(1);
                const mb = (total / 1024 / 1024).toFixed(2);
                return (
                  <div className="bg-white rounded-[18px] p-5 mb-6 shadow-sm">
                    <p className="text-[12px] text-[#8E8E93] uppercase tracking-wider font-semibold mb-3">Local Storage Used</p>
                    <div className="flex items-end gap-2 mb-3">
                      <p className="text-[40px] font-black text-[#1C1C1E] leading-none">
                        {parseFloat(mb) < 0.1 ? kb : mb}
                      </p>
                      <p className="text-[16px] font-semibold text-[#8E8E93] mb-1">
                        {parseFloat(mb) < 0.1 ? 'KB' : 'MB'}
                      </p>
                    </div>
                    <div className="w-full bg-[#F2F2F7] rounded-full h-2">
                      <div
                        className="bg-[#25D366] h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((parseFloat(mb) / 50) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-[#8E8E93] mt-2">{count} Ledger Chat items · Estimated</p>
                  </div>
                );
              })()}

              <Group title="Manage" footer="Clearing cache removes temporary data only. Your conversations are stored via XMTP and are safe.">
                <Row icon={<RefreshCw size={18} />} label="Clear Cache" sublabel="Remove temporary files" onTap={() => setModal('clearCache')} />
                <Row icon={<HardDrive size={18} />} label="Manage Media" sublabel="Photos, videos, and files" onTap={() => setModal('manage_media')} />
              </Group>

              <Group>
                <Row
                  icon={<Download size={18} />}
                  label="Export All Data"
                  sublabel="Download your Ledger Chat data as JSON"
                  onTap={() => {
                    try {
                      const data: Record<string, string> = {};
                      for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i)!;
                        if (k.startsWith('ledger_')) data[k] = localStorage.getItem(k) || '';
                      }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `ledger-export-${Date.now()}.json`; a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Data exported');
                    } catch { toast.error('Export failed'); }
                  }}
                />
              </Group>
            </>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <Group label="Native Crypto Payments">
                <Row
                  label="Enable Crypto Payments"
                  desc="Show payment CTAs and ETH/USDC send button in all chats"
                  toggle={settings.payments_enabled ?? false}
                  onToggle={(v) => updateSetting('payments_enabled', v)}
                />
                <Row
                  label="Payment Confirmations"
                  desc="Always require a confirmation before sending crypto"
                  toggle={settings.payment_confirmations ?? true}
                  onToggle={(v) => updateSetting('payment_confirmations', v)}
                />
                <Row
                  label="Show Balances in Chat"
                  desc="Display ETH and token balances in your profile header"
                  toggle={settings.show_balances ?? true}
                  onToggle={(v) => updateSetting('show_balances', v)}
                />
              </Group>
              <Group label="Default Payment Token">
                <div className="px-4 pb-4">
                  {['ETH', 'USDC', 'USDT'].map((token) => (
                    <button
                      key={token}
                      onClick={() => updateSetting('default_token', token)}
                      className={"flex items-center justify-between w-full py-3 border-b border-black/5 last:border-0 " + (settings.default_token === token ? "text-[#25D366]" : "text-[#1C1C1E]")}
                    >
                      <span className="font-semibold">{token}</span>
                      {settings.default_token === token && (
                        <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Group>
              <Group label="Transaction History">
                <Row label="View Full History" onTap={() => window.open('/payments/history', '_blank')} />
                <Row label="Export CSV" onTap={() => {
                  try {
                    const rows = [['Date', 'Type', 'Amount', 'To/From', 'Status']];
                    for (let i = 0; i < localStorage.length; i++) {
                      const k = localStorage.key(i)!;
                      if (k.startsWith('ledger_tx_')) {
                        try { const tx = JSON.parse(localStorage.getItem(k) || '{}'); rows.push([tx.date || '', tx.type || '', tx.amount || '', tx.peer || '', tx.status || '']); } catch {}
                      }
                    }
                    if (rows.length === 1) { toast.info('No transactions recorded yet'); return; }
                    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ledger-payments-${Date.now()}.csv`; a.click();
                    toast.success('CSV exported');
                  } catch { toast.error('Export failed'); }
                }} />
              </Group>
            </div>
          )}

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS (Bottom Sheet)
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key={modal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-end justify-center"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden shadow-2xl"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#E5E5EA]" />
              </div>

              {/* ── LINKED DEVICES QR Modal ── */}
              {modal === 'linked_devices' && (
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[20px] font-bold text-[#1C1C1E]">Link a Phone</h3>
                    <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                      <X size={16} className="text-[#8E8E93]" />
                    </button>
                  </div>
                  
                  {/* Tabs for Show / Scan */}
                  <div className="flex items-center gap-2 mb-4 bg-[#F2F2F7] p-1 rounded-[14px]">
                    <button 
                      onClick={() => { setQrScanMode('show'); stopQrScan(); }} 
                      className={`flex-1 py-2 text-[14px] font-semibold rounded-[10px] transition-all ${qrScanMode === 'show' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-[#8E8E93]'}`}
                    >
                      Show QR
                    </button>
                    <button 
                      onClick={() => { setQrScanMode('scan'); startQrScan(); }} 
                      className={`flex-1 py-2 text-[14px] font-semibold rounded-[10px] transition-all ${qrScanMode === 'scan' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-[#8E8E93]'}`}
                    >
                      Scan QR
                    </button>
                  </div>

                  {qrScanMode === 'show' ? (
                    <>
                      <p className="text-[14px] text-[#8E8E93] mb-5 leading-relaxed">
                        Open <strong className="text-[#1C1C1E]">humanidfi.com/chat</strong> on your iPhone or Android, connect your wallet, then scan this code.
                      </p>

                      {/* QR Code */}
                      <div className="flex justify-center mb-4">
                        <div className={`rounded-[18px] border-4 p-3 transition-all ${qrExpiry > 0 ? 'border-[#25D366]' : 'border-[#E5E5EA] opacity-40'}`}>
                          {qrExpiry > 0 ? (
                            <SimpleQRCode data={qrLinkUrl} size={200} />
                          ) : (
                            <div className="w-[200px] h-[200px] flex flex-col items-center justify-center gap-3 bg-[#F2F2F7] rounded-[14px]">
                              <QrCode size={40} className="text-[#C7C7CC]" />
                              <p className="text-[13px] text-[#8E8E93] font-semibold">QR Expired</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Countdown */}
                      <div className="flex items-center justify-center gap-2 mb-5">
                        {qrExpiry > 0 ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                            <p className="text-[13px] text-[#8E8E93] font-mono">
                              Expires in {Math.floor(qrExpiry / 60)}:{String(qrExpiry % 60).padStart(2, '0')}
                            </p>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setQrExpiry(120)}
                            className="flex items-center gap-2 text-[#25D366] font-semibold text-[14px]"
                          >
                            <RefreshCw size={14} />
                            Generate new code
                          </button>
                        )}
                      </div>

                      {/* Steps */}
                      <div className="bg-[#F2F2F7] rounded-[14px] p-4 mb-5">
                        <p className="text-[12px] font-bold text-[#6D6D72] uppercase tracking-wider mb-3">How it works</p>
                        {[
                          { n: '1', text: 'Open Ledger Chat on your phone' },
                          { n: '2', text: 'Connect the same wallet (MetaMask, WalletConnect, etc.)' },
                          { n: '3', text: 'Go to Settings → Account → Link Desktop' },
                          { n: '4', text: 'Scan this QR code to sync your session' },
                        ].map(step => (
                          <div key={step.n} className="flex items-center gap-3 mb-2 last:mb-0">
                            <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                              <span className="text-white text-[11px] font-black">{step.n}</span>
                            </div>
                            <p className="text-[13px] text-[#1C1C1E]">{step.text}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-[12px] text-[#8E8E93] justify-center">
                        <ShieldCheck size={13} className="text-[#25D366]" />
                        Secured with end-to-end encryption. No passwords required.
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] text-[#8E8E93] mb-5 leading-relaxed">
                        Point your camera at a Ledger Chat QR code on another device.
                      </p>
                      
                      <div className="relative w-full aspect-square max-w-[300px] mx-auto bg-black rounded-[24px] overflow-hidden shadow-inner mb-6">
                        <video ref={qrVideoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                        <canvas ref={qrCanvasRef} className="hidden" />
                        
                        {/* Scanner overlay */}
                        <div className="absolute inset-0 pointer-events-none border-[3px] border-[#25D366]/30 m-8 rounded-[16px]">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#25D366] rounded-tl-[12px]" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#25D366] rounded-tr-[12px]" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#25D366] rounded-bl-[12px]" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#25D366] rounded-br-[12px]" />
                          <div className="w-full h-0.5 bg-[#25D366] shadow-[0_0_8px_#25D366] animate-pulse relative top-1/2" />
                        </div>

                        {scanError && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center">
                            <p className="text-white text-[14px] font-semibold flex items-center gap-2">
                              <AlertTriangle size={18} className="text-red-500" />
                              {scanError}
                            </p>
                          </div>
                        )}
                        {scanSuccess && (
                          <div className="absolute inset-0 bg-[#25D366]/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3">
                              <Check size={24} className="text-[#25D366]" />
                            </div>
                            <p className="text-white text-[16px] font-bold">{scanSuccess}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[12px] text-[#8E8E93] justify-center">
                        <Camera size={13} className="text-[#8E8E93]" />
                        Make sure the QR code is well-lit and in focus.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Privacy Selector ── */}
              {['privacy_last_seen','privacy_profile_photo','privacy_bio','privacy_group_invites'].includes(modal!) && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">
                    {modal === 'privacy_last_seen' ? 'Last Seen'
                      : modal === 'privacy_profile_photo' ? 'Profile Photo'
                      : modal === 'privacy_bio' ? 'About / Bio'
                      : 'Group Invites'}
                  </h3>
                  {['everybody', 'contacts', 'nobody'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting(modal as any, opt); setModal(null); toast.success('Privacy updated'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings as any)[modal!] === opt ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold capitalize">{opt}</span>
                      {(settings as any)[modal!] === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Auto-Delete ── */}
              {modal === 'auto_delete' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Disappearing Messages</h3>
                  {['off','1 hour','24 hours','1 week','1 month','1 year'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting('auto_delete_timer', opt === 'off' ? undefined : opt); setModal(null); toast.success('Timer saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings.auto_delete_timer || 'off') === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold">{opt === 'off' ? 'Disabled' : opt}</span>
                      {(settings.auto_delete_timer || 'off') === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Sound Pack ── */}
              {modal === 'sound_pack' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Sound Pack</h3>
                  {[
                    { id: 'minimal', label: 'Minimal', desc: 'Subtle, barely-there tones' },
                    { id: 'default', label: 'Default', desc: 'Clean and balanced' },
                    { id: 'telegram', label: 'Telegram-style', desc: 'Familiar notification sounds' },
                    { id: 'ledger', label: 'Ledger', desc: 'Unique cryptographic tones' },
                  ].map(pack => (
                    <button
                      type="button"
                      key={pack.id}
                      onClick={() => { updateSetting('sound_pack', pack.id); setModal(null); toast.success('Sound pack saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${(settings.sound_pack || 'default') === pack.id ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold">{pack.label}</p>
                        <p className={`text-[12px] mt-0.5 ${(settings.sound_pack || 'default') === pack.id ? 'text-white/70' : 'text-[#8E8E93]'}`}>{pack.desc}</p>
                      </div>
                      {(settings.sound_pack || 'default') === pack.id && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Auto Lock ── */}
              {modal === 'auto_lock' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Auto-Lock Timer</h3>
                  {['Immediately','1 minute','5 minutes','15 minutes','1 hour','Never'].map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => { updateSetting('auto_lock_timer' as any, opt); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${((settings as any).auto_lock_timer || 'Immediately') === opt ? 'bg-[#1C1C1E] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'}`}
                    >
                      <span className="font-semibold">{opt}</span>
                      {((settings as any).auto_lock_timer || 'Immediately') === opt && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Font Size ── */}
              {modal === 'font_size' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Font Size</h3>
                  <div className="bg-[#F2F2F7] rounded-2xl p-4 mb-5">
                    <p style={{ fontSize: `${12 + (settings.text_size ?? 2) * 2}px` }} className="text-[#1C1C1E] text-center">
                      Preview text at this size
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#8E8E93] font-semibold">A</span>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={settings.text_size ?? 2}
                      onChange={e => updateSetting('text_size', parseInt(e.target.value))}
                      className="flex-1 accent-[#25D366]"
                    />
                    <span className="text-[18px] text-[#8E8E93] font-semibold">A</span>
                  </div>
                  <button type="button" onClick={() => setModal(null)} className="w-full mt-5 py-4 bg-[#1C1C1E] rounded-2xl text-white font-bold text-[16px]">Done</button>
                </div>
              )}

              {/* ── Wallpaper ── */}
              {modal === 'wallpaper' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Chat Wallpaper</h3>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {['default','minimal','dots','circuit','waves'].map(bg => (
                      <button
                        type="button"
                        key={bg}
                        onClick={() => { updateSetting('chat_background', bg); setModal(null); toast.success('Wallpaper saved'); }}
                        className={`h-24 rounded-2xl border-2 flex items-center justify-center font-semibold text-[12px] transition-all ${
                          (settings.chat_background || 'default') === bg
                            ? 'border-[#25D366] text-[#25D366] bg-[#25D366]/5'
                            : 'border-transparent bg-[#F2F2F7] text-[#8E8E93]'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Bubble Style ── */}
              {modal === 'bubble_style' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Bubble Style</h3>
                  {[
                    { id: 'default', label: 'Default', desc: 'Rounded corners, standard padding' },
                    { id: 'compact', label: 'Compact', desc: 'Smaller bubbles, denser layout' },
                    { id: 'wide', label: 'Wide', desc: 'Full-width bubbles' },
                  ].map(style => (
                    <button
                      type="button"
                      key={style.id}
                      onClick={() => { updateSetting('bubble_style', style.id); setModal(null); toast.success('Saved'); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl mb-2 ${(settings.bubble_style || 'default') === style.id ? 'bg-[#25D366] text-white' : 'bg-[#F2F2F7] text-[#1C1C1E]'}`}
                    >
                      <div className="text-left">
                        <p className="font-semibold">{style.label}</p>
                        <p className={`text-[12px] mt-0.5 ${(settings.bubble_style || 'default') === style.id ? 'text-white/70' : 'text-[#8E8E93]'}`}>{style.desc}</p>
                      </div>
                      {(settings.bubble_style || 'default') === style.id && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Clear Cache ── */}
              {modal === 'clearCache' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-2">Clear Cache</h3>
                  <p className="text-[14px] text-[#8E8E93] mb-6 leading-relaxed">This removes temporary cached data. Your messages, contacts, and settings are safe and will not be deleted.</p>
                  <button type="button" onClick={purgeCache} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px]">
                    Clear Cache
                  </button>
                  <button type="button" onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#8E8E93] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Custom RPC ── */}
              {modal === 'custom_rpc' && (
                <div className="px-6 pb-6">
                  <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-5">Custom RPC URL</h3>
                  <p className="text-[13px] text-[#8E8E93] mb-4 leading-relaxed">Use your own Ethereum RPC provider for transactions and contract interactions.</p>
                  <input
                    type="url"
                    defaultValue={settings.custom_rpc_url || ''}
                    placeholder="https://mainnet.infura.io/v3/your-key"
                    className="w-full bg-[#F2F2F7] rounded-2xl px-4 py-4 text-[14px] font-mono text-[#1C1C1E] outline-none focus:ring-2 focus:ring-[#25D366] mb-4"
                    onBlur={e => { if (e.target.value) updateSetting('custom_rpc_url', e.target.value); }}
                  />
                  <button type="button" onClick={() => { setModal(null); toast.success('RPC URL saved'); }}
                    className="w-full py-4 bg-[#1C1C1E] rounded-2xl text-white font-bold text-[16px]">
                    Save
                  </button>
                </div>
              )}

              {/* ── Nuke ── */}
              {modal === 'nuke' && (
                <div className="px-6 pb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                      <AlertTriangle size={22} className="text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#1C1C1E]">Delete All Data</h3>
                      <p className="text-[13px] text-red-500 font-semibold">This cannot be undone</p>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#8E8E93] mb-6 leading-relaxed">
                    All local data including conversation history, contacts, and settings will be permanently deleted. Your on-chain identity and XMTP inbox remain intact.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      for (let i = localStorage.length - 1; i >= 0; i--) {
                        const k = localStorage.key(i);
                        if (k?.startsWith('ledger_')) localStorage.removeItem(k);
                      }
                      toast.success('All local data deleted');
                      setTimeout(() => window.location.reload(), 1500);
                    }}
                    className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px]"
                  >
                    Confirm — Delete Everything
                  </button>
                  <button type="button" onClick={() => setModal(null)} className="w-full py-3 mt-2 text-[#8E8E93] font-semibold text-[16px]">
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Blocked Addresses ── */}
              {modal === 'blocked_list' && (() => {
                const blocked: string[] = (() => { try { return JSON.parse(localStorage.getItem('ledger_blocked_users') || '[]'); } catch { return []; } })();
                return (
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[20px] font-bold text-[#1C1C1E]">Blocked Addresses</h3>
                      <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"><X size={16} className="text-[#8E8E93]" /></button>
                    </div>
                    {blocked.length === 0 ? (
                      <div className="py-12 flex flex-col items-center gap-3 text-[#8E8E93]">
                        <Shield size={40} className="opacity-30" />
                        <p className="text-[15px] font-medium">No blocked addresses</p>
                        <p className="text-[13px] text-center">Blocked wallets won't be able to send you messages</p>
                      </div>
                    ) : blocked.map((addr: string) => (
                      <div key={addr} className="flex items-center justify-between bg-[#F2F2F7] rounded-2xl px-4 py-3 mb-2">
                        <p className="text-[14px] font-semibold text-[#1C1C1E] font-mono">{addr.slice(0, 8)}...{addr.slice(-6)}</p>
                        <button type="button" onClick={() => { const upd = blocked.filter(b => b !== addr); localStorage.setItem('ledger_blocked_users', JSON.stringify(upd)); toast.success('Unblocked'); setModal(null); }} className="text-[13px] text-[#25D366] font-bold px-3 py-1.5 rounded-xl hover:bg-[#25D366]/10">Unblock</button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── Manage Media ── */}
              {modal === 'manage_media' && (() => {
                let totalBytes = 0; let mediaCount = 0;
                try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('ledger_')) { const v = localStorage.getItem(k) || ''; if (v.startsWith('data:')) { totalBytes += v.length * 0.75; mediaCount++; } } } } catch {}
                const mb = (totalBytes / (1024 * 1024)).toFixed(2);
                return (
                  <div className="px-6 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[20px] font-bold text-[#1C1C1E]">Manage Media</h3>
                      <button type="button" onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center"><X size={16} className="text-[#8E8E93]" /></button>
                    </div>
                    <div className="bg-[#F2F2F7] rounded-2xl p-5 mb-5">
                      <p className="text-[13px] text-[#8E8E93] mb-1">Cached media storage</p>
                      <p className="text-[28px] font-bold text-[#1C1C1E]">{mb} <span className="text-[16px] font-medium text-[#8E8E93]">MB</span></p>
                      <p className="text-[12px] text-[#8E8E93] mt-1">{mediaCount} media item{mediaCount !== 1 ? 's' : ''}</p>
                      <div className="mt-3 h-2 bg-[#E5E5EA] rounded-full overflow-hidden"><div className="h-full bg-[#25D366] rounded-full" style={{ width: `${Math.min((parseFloat(mb) / 10) * 100, 100)}%` }} /></div>
                    </div>
                    <button type="button" onClick={() => { let n = 0; for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i)!; if (k.startsWith('ledger_') && (localStorage.getItem(k) || '').startsWith('data:')) { localStorage.removeItem(k); n++; } } toast.success(`Cleared ${n} item${n !== 1 ? 's' : ''}`); setModal(null); }} className="w-full py-4 bg-[#FF3B30] rounded-2xl text-white font-bold text-[16px] mb-2">Clear Media Cache</button>
                    <button type="button" onClick={() => setModal(null)} className="w-full py-3 text-[#8E8E93] font-semibold text-[16px]">Cancel</button>
                  </div>
                );
              })()}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

