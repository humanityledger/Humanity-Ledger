import re
with open('components/terminal/LedgerChat.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'Ledger Chat [^a-zA-Z]+ End-to-end encrypted', 'Ledger Chat • End-to-end encrypted', content)

with open('components/terminal/LedgerChat.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
