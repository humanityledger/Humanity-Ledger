
const fs = require("fs");
let code = fs.readFileSync("components/terminal/LedgerChatV2.tsx", "utf8");

const target = "const senderAddr = await resolveSenderAddress(msg.senderInboxId, client);";
const replacement = `let senderAddr = await resolveSenderAddress(msg.senderInboxId, client);
                  if (!senderAddr && client) {
                    try { await client.conversations.sync(); } catch {}
                    senderAddr = await resolveSenderAddress(msg.senderInboxId, client);
                  }`;

code = code.replace(target, replacement);
fs.writeFileSync("components/terminal/LedgerChatV2.tsx", code);
console.log("Replaced");

