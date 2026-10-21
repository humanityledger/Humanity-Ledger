const fs = require('fs');
let sessionTs = fs.readFileSync('lib/session.ts', 'utf8');

const regex = /const siweUserId = payload\.address \|\| payload\.sub;/;
if (regex.test(sessionTs)) {
  sessionTs = sessionTs.replace(regex, 'const siweUserId = payload.walletAddress || payload.address || payload.sub;');
  fs.writeFileSync('lib/session.ts', sessionTs);
  console.log('Regex replace success!');
} else {
  console.log('Regex pattern not found!');
}
