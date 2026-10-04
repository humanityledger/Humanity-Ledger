#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# NOW look at the stream loop's dedup: does it mark ALL messages including incoming from peer?
# The key line: confirmedMsgIds.current.add(realId) happens BEFORE the stream routes the message
# So if loadHistory seeds confirmedMsgIds with message IDs from history,
# those messages will pass the dedup check (alreadyInState === true since they are in prev state)

# Let me check: are INCOMING STREAM messages being dropped because their IDs are in confirmedMsgIds?
# The dedup says: if confirmedMsgIds.has(realId) AND alreadyInState -> skip
# If confirmedMsgIds.has(realId) but NOT alreadyInState -> re-insert

# What if history didn't load yet when stream message arrives?
# OR: the stream restarts and replays messages that ARE already in confirmedMsgIds AND in state

# Let me look at the QD balance gate - could messages be silently blocked by balance check?
idx = src.find('balance < 0.0001')
print("QD balance gate:")
print(src[idx-300:idx+500])
