const fs = require('fs');
let route = fs.readFileSync('app/api/auth/verify-session/route.ts', 'utf8');

const oldAddress = `const address = (payload.sub || payload.address) as string;`;
const newAddress = `const address = (payload.walletAddress || payload.address || payload.sub) as string;`;

route = route.replace(oldAddress, newAddress);

const oldHumanity = `                                humanityIdentity = {
                                    address: (humanityPayload.sub as string).toLowerCase(),
                                    sessionId: humanityPayload.sid as string,
                                };`;
const newHumanity = `                                humanityIdentity = {
                                    address: ((humanityPayload.walletAddress || humanityPayload.address || humanityPayload.sub) as string).toLowerCase(),
                                    sessionId: humanityPayload.sessionId || humanityPayload.sid || '',
                                };`;

route = route.replace(oldHumanity, newHumanity);
fs.writeFileSync('app/api/auth/verify-session/route.ts', route);
console.log('Fixed JWT payload extraction in verify-session');
