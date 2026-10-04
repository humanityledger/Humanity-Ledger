#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# Check the history load: the rawMappedMsgs maps m.senderInboxId = m.senderInboxId 
# Then in the combined loop, pending server messages have senderInboxId = activePeer (ETH address!)
# This means pending messages will ALWAYS have isMe = False (since activePeer eth addr != clientInboxId)
# However that is correct for incoming pending messages

# Let's trace the actual issue: when the stream sends a message from peer,
# the resolvedPeerAddr needs to match currentActivePeer.
# The key question: when peer sends a message, does the stream correctly resolve their address?

# Check if there is a dedup problem - the stream is running but messages are not appearing
# Could be a subscribeSelf issue - maybe we are deduplicating our OWN echoes

# Find the optimisticContentMap logic
idx = src.find('optimisticContentMap')
print(src[idx:idx+500])
print()
# Find if there's anything comparing optimistic message content with wrong key
idx2 = src.find('optimisticContentMap.current.get')
print(src[idx2:idx2+300])
