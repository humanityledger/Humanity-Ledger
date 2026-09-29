#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

idx = src.find('while (!cancelled)')
# Find the actual message insertion point — the setMessages call AFTER all the interceptors
# Search for setMessages that creates new message with content
idx2 = src.find('// 🟢 REAL MESSAGE', idx)
if idx2 == -1:
    idx2 = src.find('setMessages(prev => [', idx)
if idx2 == -1:
    idx2 = src.find('isMyMessage', idx)
print(f"Found insert at idx={idx2}, stream starts at {idx}")
print(src[idx+10000:idx+14000])
