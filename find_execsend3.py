#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Find where executeSend is DEFINED as an async function (not just the ref)
idx = src.find('const executeSend = async')
# Get more of the function (5000-10000 chars)
print(src[idx+4800:idx+9000])
