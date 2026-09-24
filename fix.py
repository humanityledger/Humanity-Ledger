import re

with open('components/terminal/LedgerChat.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace mojibake with proper emojis. The block we are looking for is inside:
# <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
pattern = r'\{\s*\[.*?label:\s*.End-to-End Encrypted.*?\].map\(\(f\)\s*=>'
replacement = '''{[
                  { icon: '🔒', label: 'End-to-End Encrypted' },
                  { icon: '🌐', label: 'Decentralized Network' },
                  { icon: '🔥', label: 'Burn on Read' },
                  { icon: '💎', label: 'Send QD Tokens' }
                ].map((f) =>'''

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('components/terminal/LedgerChat.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Changed:", content != new_content)
