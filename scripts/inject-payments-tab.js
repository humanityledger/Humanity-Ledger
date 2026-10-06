const fs = require('fs');
const file = 'd:/Projects/Wallet Human Polymarket ID/components/chat/LedgerSettingsFull.tsx';
let content = fs.readFileSync(file, 'utf8');

const PAYMENTS_TAB = `
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
                <Row label="Export CSV" onTap={() => toast.success('Export feature coming soon')} />
              </Group>
            </div>
          )}
`;

if (!content.includes("activeTab === 'payments'")) {
  // Insert Payments tab before the closing div of tab content area
  // Find "activeTab === 'storage'" and its block end
  const storageIdx = content.lastIndexOf("activeTab === 'storage'");
  let depth = 0;
  let i = content.indexOf('(', storageIdx);
  let endIdx = i;
  for (; i < content.length; i++) {
    if (content[i] === '(') depth++;
    if (content[i] === ')') {
      depth--;
      if (depth === 0) { endIdx = i + 1; break; }
    }
  }
  content = content.substring(0, endIdx) + '\n' + PAYMENTS_TAB + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Payments tab injected successfully at position', endIdx);
} else {
  console.log('Payments tab already exists');
}
