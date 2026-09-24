import re
with open('components/terminal/LedgerChat.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Instead of regex, we'll use simple string replace on the exact mojibake lines.
# Emojis in the source file are encoded differently, let's just find the exact block text using search.

lines = content.split('\n')
for i, line in enumerate(lines):
    if 'End-to-End Encrypted' in line and 'icon:' in line and '{' in line:
        lines[i] = "                  { icon: '🔒', label: 'End-to-End Encrypted' },"
    if 'Decentralized Network' in line and 'icon:' in line and '{' in line:
        lines[i] = "                  { icon: '🌐', label: 'Decentralized Network' },"
    if 'Burn on Read' in line and 'icon:' in line and '{' in line:
        lines[i] = "                  { icon: '🔥', label: 'Burn on Read' },"
    if 'Send QD Tokens' in line and 'icon:' in line and '{' in line:
        lines[i] = "                  { icon: '💎', label: 'Send QD Tokens' }"
    
    if 'Ledger Chat' in line and 'End-to-end encrypted' in line:
        lines[i] = re.sub(r'Ledger Chat [^a-zA-Z]+ End-to-end encrypted', 'Ledger Chat • End-to-end encrypted', lines[i])

with open('components/terminal/LedgerChat.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
