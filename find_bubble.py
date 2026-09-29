#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find where MessageBubble is called in the JSX to understand how isMe is computed
# from the stored senderInboxId
idx = src.find('<MessageBubble')
print(f"<MessageBubble rendered at {idx}")
print(src[idx:idx+1500])
