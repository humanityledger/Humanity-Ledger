
const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const tsPlugin = require('acorn-typescript');
// acorn-typescript handles TS but might not handle TSX perfectly.
// Let's use swc locally! Next.js has SWC. We can require it from next/dist/build/swc
const swc = require('next/dist/build/swc');

async function check() {
  try {
    const code = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
    // We don't need to parse, we can just ask SWC to transform it to check for syntax errors
    await swc.transform(code, {
      jsc: { parser: { syntax: 'typescript', tsx: true } }
    });
    console.log('SWC Parsed successfully!');
  } catch (e) {
    console.error('SWC Parse Error:', e);
  }
}
check();

