#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

FILE = r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# ============================================================
# FIX 1: Broken logo – add onError fallback so broken img
#         doesn't show a broken icon on every device
# ============================================================
src = src.replace(
    '<img src="/ledgerchaticon.jpg" alt="Ledger Chat Logo" className="w-full h-full object-cover" />',
    '<img src="/ledgerchaticon.jpg" alt="Ledger Chat" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />'
)

# ============================================================
# FIX 2: Replace mojibake emoji strings in the 
#         "Select a conversation" feature grid with SVG icons
# ============================================================
old_grid = """                {[
                    { icon: '\\U0001f512', label: 'End-to-End Encrypted' },
                    { icon: '\\U0001f310', label: 'Decentralized Network' },
                    { icon: '\\U0001f525', label: 'Burn on Read' },
                    { icon: '\\U0001fa99', label: 'Send QD Tokens' }
                  ].map((f) => ("""

# Find the feature grid block and replace with SVG-based version
grid_search = re.search(
    r'\{/\* Feature grid \*/\}.*?\.map\(\(f\)',
    src, re.DOTALL
)

# The exact icon list (with various unicode corruption states)
# Replace the icon array directly with a safer SVG approach
ICON_GRID_OLD = r"""\{\[
\s*\{[^}]*'End-to-End Encrypted'[^}]*\},
\s*\{[^}]*'Decentralized Network'[^}]*\},
\s*\{[^}]*'Burn on Read'[^}]*\},
\s*\{[^}]*'Send QD Tokens'[^}]*\}
\s*\]\.map"""

ICON_GRID_NEW = """              {[
                    { 
                      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>), 
                      label: 'End-to-End Encrypted',
                      color: 'text-blue-500 bg-blue-50'
                    },
                    { 
                      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>), 
                      label: 'Decentralized Network',
                      color: 'text-purple-500 bg-purple-50'
                    },
                    { 
                      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>), 
                      label: 'Burn on Read',
                      color: 'text-orange-500 bg-orange-50'
                    },
                    { 
                      icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/></svg>), 
                      label: 'Send QD Tokens',
                      color: 'text-emerald-500 bg-emerald-50'
                    }
                  ].map"""

m = re.search(ICON_GRID_OLD, src, re.DOTALL)
if m:
    src = src[:m.start()] + ICON_GRID_NEW + src[m.end():]
    print('[FIX 2] Replaced feature icon grid with SVGs')
else:
    # Try to find the grid by text content
    idx = src.find("'End-to-End Encrypted' },")
    if idx == -1:
        idx = src.find('End-to-End Encrypted')
    print(f'[FIX 2] Could not regex-replace, icon block found at idx={idx}')
    # Fallback: show the context
    if idx != -1:
        print(repr(src[idx-300:idx+400]))

# Also fix the icon rendering - the map renders f.icon as text, make it JSX-safe
# Check if it renders {f.icon} properly
old_card_text = """className={`w-10 h-10 rounded-xl flex items-center justify-center`}>
                      <span className="text-2xl">{f.icon}</span>"""
new_card_text = """className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color || 'text-blue-500 bg-blue-50'}`}>
                      {f.icon}"""
if old_card_text in src:
    src = src.replace(old_card_text, new_card_text)
    print('[FIX 2b] Updated icon card rendering')

# ============================================================
# FIX 3: Sticker list - replace mojibake emojis with real ones
# ============================================================
# The stickers array is likely corrupted - fix any corrupted emoji arrays
src = re.sub(
    r"\['[^']*', '[^']*', '[^']*', '[^']*', '[^']*', '[^']*', '[^']*', '[^']*'\]\.map\(emoji",
    "['👍', '🔥', '🚀', '😂', '💯', '🙏', '👀', '✨'].map(emoji",
    src
)

# ============================================================
# FIX 4: Fix the broken `audio` element tag that the
#         script previously corrupted (audiX -> audio, VideX -> Video)
# ============================================================
src = src.replace('<audiXref=', '<audio ref=')
src = src.replace('</audiX>', '</audio>')
src = src.replace('<videX', '<video')
src = src.replace('</videX>', '</video>')
src = src.replace('<VideXsize=', '<Video size=')

# ============================================================
# FIX 5: Fix other word-corruption artifacts from the bad script
# ============================================================
src = src.replace('NXSaved Contacts', 'No Saved Contacts')
src = src.replace('tXsave a contact', 'to save a contact')
src = src.replace('tXsovereign', 'to sovereign')
src = src.replace('tXallow', 'to allow')
src = src.replace('tXavoid', 'to avoid')
src = src.replace('font-monXmb-4', 'font-mono mb-4')
src = src.replace('AudiXCall', 'Audio Call')
src = src.replace('VideXCall', 'Video Call')
src = src.replace('HitX4:', 'Hito 4:')
src = src.replace('WebRTC Ringtone AudiXElement', 'WebRTC Ringtone Audio Element')
# Protect "contact" and "to" in normal words
src = src.replace('audiXon iOS', 'audio on iOS')

print(f'[DONE] src length: {len(src)} (original: {len(original)})')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(src)
print('[SAVED] LedgerChatV2.tsx written')
