#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Look at the isMe check to understand how sender is determined
idx_isMe = src.find('isMe')
# find the one in the message rendering part
print("Searching for isMe =...")
idx = src.find('const isMe =')
if idx == -1:
    idx = src.find('isMe =')
print(f"Found at {idx}")
print(src[idx:idx+800])
print()
# Also find how message.senderInboxId is compared to the client's own inboxId
idx2 = src.find('client?.inboxId || client?.inboxId')
if idx2 == -1:
    idx2 = src.find('client?.inboxId')
print(f"client.inboxId reference at {idx2}")
print(src[idx2:idx2+300])
