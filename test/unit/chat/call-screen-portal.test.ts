import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const chat = fs.readFileSync(path.join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');

describe('the call screen shows wherever the call was answered', () => {
  it('the active call screen is rendered on document.body, not inside the chat area', () => {
    // The chat area is display:none below 1024 px while the list shows, and in Communities.
    // Minimised or off /chat it draws nothing here (the live-activity layer has it); otherwise a portal.
    expect(chat).toMatch(/(?:\) :|\? null :) createPortal\(\s*\/\/[\s\S]{0,600}<div data-testid="call-screen" className=\{`fixed inset-0/);
    expect(chat).toMatch(/<\/div>,\s*document\.body\s*\)\s*\)\}\s*<\/div> \{\/\* Close Chat Area \*\/\}/);
  });
  it('answering opens the caller chat and brings the chats view forward', () => {
    expect(chat).toMatch(/setActivePeer\(caller\);\s*\/\/[^\n]*\n\s*if \(caller\) \{ setSidebarTab\('chats'\); setShowList\(false\); \}/);
  });
});
