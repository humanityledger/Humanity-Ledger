#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find where isMe is determined before MessageBubble
# We know it's at 220070 for the first MessageBubble call
# Look backwards from that for `const isMe`
idx_bubble = 220070
chunk = src[idx_bubble-3000:idx_bubble]
print(chunk)
