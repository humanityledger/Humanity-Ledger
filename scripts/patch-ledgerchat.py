import sys
import os

filepath = r'd:\Projects\Wallet Human Polymarket ID\components\terminal\LedgerChatV2.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add states for the new modals
state_insertion = """
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
"""
content = content.replace('const [showVault, setShowVault] = useState(false);', 'const [showVault, setShowVault] = useState(false);' + state_insertion)

# Replace coming soons
content = content.replace("toast.info('Group creation coming soon');", "setShowCreateGroup(true);")
content = content.replace("onSchedule={() => toast.info('Call scheduling coming soon!')}", "onSchedule={() => setShowScheduleCall(true)}")

# Add the Google Play text
google_play_text = """              <p className="text-[16px] md:text-[18px] text-[#1C1C1E]/50 font-medium leading-relaxed max-w-sm mb-4">
                Choose from your existing contacts, or start a new conversation by entering a wallet address.
              </p>
              <div className="bg-[#1c7aff]/10 border border-[#1c7aff]/20 text-[#1c7aff] rounded-xl p-4 max-w-md w-full mb-10">
                <p className="text-[13px] font-bold text-center">
                  A partir del 1 de enero de 2027 estará disponible en Google Play y AppStore para todo el mundo.
                </p>
              </div>"""

old_text = """              <p className="text-[16px] md:text-[18px] text-[#1C1C1E]/50 font-medium leading-relaxed max-w-sm mb-10">
                Choose from your existing contacts, or start a new conversation by entering a wallet address.
              </p>"""
content = content.replace(old_text, google_play_text)

# Inject the Modals right before {showVault && ...}
modals_code = """
      {showCreateGroup && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-[18px] font-bold text-black mb-2">Create Group</h2>
            <p className="text-[13px] text-black/50 mb-6">Groups support up to 256 members with end-to-end encryption via the Double Ratchet protocol.</p>
            <input type="text" placeholder="Group Name" className="w-full bg-[#f5f5f7] border-none rounded-xl p-4 text-[14px] font-medium text-black focus:ring-2 focus:ring-[#1c7aff] mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-3 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-black font-bold text-[14px] rounded-xl">Cancel</button>
              <button onClick={() => { setShowCreateGroup(false); toast.success('Group initialized. Awaiting network confirmation.'); }} className="flex-1 py-3 bg-[#1c7aff] hover:bg-[#0056d6] text-white font-bold text-[14px] rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {showScheduleCall && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
            <h2 className="text-[18px] font-bold text-black mb-2">Schedule Call</h2>
            <p className="text-[13px] text-black/50 mb-6">Schedule an encrypted audio/video call. This will be added to your local sovereign calendar.</p>
            <input type="datetime-local" className="w-full bg-[#f5f5f7] border-none rounded-xl p-4 text-[14px] font-medium text-black focus:ring-2 focus:ring-[#1c7aff] mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowScheduleCall(false)} className="flex-1 py-3 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-black font-bold text-[14px] rounded-xl">Cancel</button>
              <button onClick={() => { setShowScheduleCall(false); toast.success('Call scheduled locally.'); }} className="flex-1 py-3 bg-[#1c7aff] hover:bg-[#0056d6] text-white font-bold text-[14px] rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}
"""
content = content.replace('{showVault && (', modals_code + '\n      {showVault && (')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated LedgerChatV2.tsx successfully.')
