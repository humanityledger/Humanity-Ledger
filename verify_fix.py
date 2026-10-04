#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open(r'C:\projects\Humanity-Ledger-main\components\terminal\LedgerChatV2.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

checks = [
    ('Logo onError fix', 'onError={(e) => { (e.currentTarget as HTMLImageElement).style.display' in src),
    ('SVG icon grid', 'End-to-End Encrypted' in src),
    ('No audiX corruption', 'audiX' not in src),
    ('No NXSaved', 'NXSaved' not in src),
    ('audio tag intact', 'ref={ringAudioRef}' in src or '<audio' in src),
    ('video tag intact', '<video' in src),
]
for name, ok in checks:
    print(f'  [{"OK" if ok else "FAIL"}] {name}')
