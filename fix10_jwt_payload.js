const fs = require('fs');

let sessionTs = fs.readFileSync('lib/session.ts', 'utf8');

const oldPayloadNormalize = `              // Normalize SIWE payload  SessionPayload shape
              const siweUserId = payload.address || payload.sub;`;

const newPayloadNormalize = `              // Normalize SIWE payload  SessionPayload shape
              const siweUserId = payload.walletAddress || payload.address || payload.sub;`;

sessionTs = sessionTs.replace(oldPayloadNormalize, newPayloadNormalize);
fs.writeFileSync('lib/session.ts', sessionTs);
console.log('Fixed lib/session.ts to use payload.walletAddress');
