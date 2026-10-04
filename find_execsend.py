#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find where executeSend is DEFINED (the async function)
idx = src.find('const executeSend')
print("=== executeSend definition ===")
print(src[idx:idx+4000])
