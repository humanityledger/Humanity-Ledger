const fs = require('fs');
let route = fs.readFileSync('app/api/auth/verify-session/route.ts', 'utf8');

const oldCheck = `        const ledgerSession = request.cookies.get('ledger_session')?.value;
        const humanSession = request.cookies.get('human_session')?.value;
        const handshake    = request.cookies.get('system_handshake')?.value;
        const primaryJwt   = ledgerSession || humanSession;`;

const newCheck = `        const ledgerSession = request.cookies.get('ledger_session')?.value;
        const humanSession = request.cookies.get('human_session')?.value;
        const humanitySession = request.cookies.get('humanity_session')?.value;
        const handshake    = request.cookies.get('system_handshake')?.value;
        const primaryJwt   = ledgerSession || humanSession || humanitySession;`;

route = route.replace(oldCheck, newCheck);

const oldPurge = `            const secure = isProd ? '; Secure' : '';
            for (const name of ['ledger_session', 'human_session']) {
                res.headers.append('Set-Cookie', \`\${name}=; Path=/; Expires=\${expiredDate}; HttpOnly\${secure}; SameSite=Strict\`);
                res.headers.append('Set-Cookie', \`\${name}=; Path=/; Expires=\${expiredDate}; HttpOnly\${secure}; SameSite=Lax\`);
            }`;

const newPurge = `            const secure = isProd ? '; Secure' : '';
            for (const name of ['ledger_session', 'human_session', 'humanity_session', 'siwe_session']) {
                res.headers.append('Set-Cookie', \`\${name}=; Path=/; Expires=\${expiredDate}; HttpOnly\${secure}; SameSite=Strict\`);
                res.headers.append('Set-Cookie', \`\${name}=; Path=/; Expires=\${expiredDate}; HttpOnly\${secure}; SameSite=Lax\`);
            }`;

route = route.replace(oldPurge, newPurge);
fs.writeFileSync('app/api/auth/verify-session/route.ts', route);
console.log('Fixed verify-session route to support humanity_session');
