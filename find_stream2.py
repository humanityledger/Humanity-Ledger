#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find the stream loop in LedgerChatV2.tsx
idx = src.find('while (!cancelled)')
# Get MORE context - where the message is finally rendered
print(src[idx+5000:idx+10000])
