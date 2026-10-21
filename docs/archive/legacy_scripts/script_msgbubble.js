const fs = require('fs');
let code = fs.readFileSync('components/chat/MessageBubble.tsx', 'utf8');

const regex = /let replyMsg: \{ id: string; content: string \} \| null = null;\s+if \(content\.startsWith\('__REPLY__'\)\) \{\s+const p = content\.split\('__::'\);\s+if \(p\.length >= 2\) \{\s+const replyToId = p\[0\]\.replace\('__REPLY__', ''\);\s+content = p\.slice\(1\)\.join\('__::'\);\s+replyMsg = \{ id: replyToId, content: 'Replied Message' \};\s+\}\s+\}/;

const replacement = `let replyMsg: { id: string; content: string } | null = null;
  if (content.startsWith('__REPLY__')) {
    const p = content.split('__::');
    if (p.length >= 2) {
      const metadata = p[0].replace('__REPLY__', '');
      let replyToId = metadata;
      let replyText = 'Replied Message';
      if (metadata.includes('__SNIPPET__')) {
        const parts = metadata.split('__SNIPPET__');
        replyToId = parts[0];
        replyText = parts[1];
      }
      content = p.slice(1).join('__::');
      replyMsg = { id: replyToId, content: replyText };
    }
  }`;

if(regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('components/chat/MessageBubble.tsx', code);
    console.log('MessageBubble regex updated successfully');
} else {
    console.log('Regex did not match');
}
