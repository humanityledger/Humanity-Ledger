#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find the MessageBubble component or where messages are rendered in the JSX
idx = src.find('MessageBubble')
print(f"MessageBubble at {idx}")
print(src[idx:idx+600])

print()
# Find all combined message rendering to understand the isMe determination in history load
idx2 = src.find('fromPeer = msg.senderInboxId !== selfInboxId')
print(f"fromPeer assignment at {idx2}")
print(src[idx2:idx2+200])

# This is the key: the stream checks msg.senderInboxId !== selfInboxId
# The history loading also needs to distinguish between sender/receiver

# Find how history maps to isMe — look for senderInboxId === client
idx3 = src.find('senderInboxId === client')
if idx3 == -1:
    idx3 = src.find('senderInboxId: client')
print(f"senderInboxId === client at {idx3}")
print(src[idx3:idx3+300])
