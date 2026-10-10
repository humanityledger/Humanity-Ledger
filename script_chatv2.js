const fs = require('fs');
let code = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

// The standard reply in normal flow
code = code.replace(
  /finalContent = \`__REPLY__\$\{replyingTo\.id\}__::\$\{content\}\`;/,
  `const snippet = (replyingTo.content || '').replace(/__/g, '').slice(0, 80);\n      finalContent = \`__REPLY__\${replyingTo.id}__SNIPPET__\${snippet}__::\${content}\`;`
);

// The reply inside queue offline flow
code = code.replace(
  /txt = \`__REPLY__\$\{replyingTo\.id\}__::\$\{txt\}\`;/,
  `const snippet = (replyingTo.content || '').replace(/__/g, '').slice(0, 80);\n      txt = \`__REPLY__\${replyingTo.id}__SNIPPET__\${snippet}__::\${txt}\`;`
);

fs.writeFileSync('components/terminal/LedgerChatV2.tsx', code);
console.log('LedgerChatV2 updated successfully');
