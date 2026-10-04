#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find where executeSend is DEFINED as an async function (not just the ref)
idx = src.find('const executeSend = async')
if idx == -1:
    idx = src.find('const executeSend = useCallback')
if idx == -1:
    # search for its body
    idx = src.find('executeSend = async')
print(f"Found at idx={idx}")
print(src[idx:idx+5000])
