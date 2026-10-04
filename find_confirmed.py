#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Look for the history message loading - specifically how the confirmedMsgIds is seeded
# So we don't drop incoming messages as "already confirmed"
idx = src.find('confirmedMsgIds.current.add')
while idx != -1:
    print(f"At idx={idx}:")
    print(src[max(0,idx-100):idx+300])
    print("---")
    idx = src.find('confirmedMsgIds.current.add', idx+1)
