#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

idx = src.find('while (!cancelled)')
# Now look at the activeXmtpDmIdRef.peerInboxId assignment
print(src[idx+24500:idx+27000])
