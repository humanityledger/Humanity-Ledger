import os

file_path = r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken logo
content = content.replace(
    '<img src="/ledgerchaticon.jpg" alt="Ledger Chat Logo" className="w-full h-full object-cover" />',
    '<img src="/ledgerchaticon.jpg" alt="Ledger Chat" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = \"none\" }} />'
)

# Fix the mojibake text in the "Select a conversation" placeholder
content = content.replace(\"'Y\\\"?'\", \"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='3' y='11' width='18' height='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>\")
content = content.replace(\"'YO?'\", \"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><line x1='2' y1='12' x2='22' y2='12'/><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/></svg>\")
content = content.replace(\"'Y\\\"'\", \"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'/></svg>\")
content = content.replace(\"'Y\\'Z'\", \"<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><path d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/><line x1='12' y1='6' x2='12' y2='8'/><line x1='12' y1='16' x2='12' y2='18'/></svg>\")

import re

# Fix all the random replacement chars scattered in the file
content = content.replace('', '')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed LedgerChatV2.tsx')
