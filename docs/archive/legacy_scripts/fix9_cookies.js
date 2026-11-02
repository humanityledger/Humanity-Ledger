const fs = require('fs');

// Fix 1: Make getSession check humanity_session
let sessionTs = fs.readFileSync('lib/session.ts', 'utf8');
const oldPriority1 = `//  Priority 1: SIWE system session 
      const ledgerSession = cookieStore.get('ledger_session')?.value;
      const humanSession = cookieStore.get('human_session')?.value;
      const siweToken = ledgerSession || humanSession;`;

const newPriority1 = `//  Priority 1: SIWE system session 
      const ledgerSession = cookieStore.get('ledger_session')?.value;
      const humanSession = cookieStore.get('human_session')?.value;
      const humanitySession = cookieStore.get('humanity_session')?.value;
      const siweSession = cookieStore.get('siwe_session')?.value;
      const siweToken = ledgerSession || humanSession || humanitySession || siweSession;`;

sessionTs = sessionTs.replace(oldPriority1, newPriority1);
fs.writeFileSync('lib/session.ts', sessionTs);
console.log('Fixed lib/session.ts to include humanity_session and siwe_session');

// Fix 2: Make SIWE verify set the correct cookies that ClientRootRouter looks for
let verifyRoute = fs.readFileSync('app/api/auth/siwe/verify/route.ts', 'utf8');

const oldCookieSet = `    cookieStore.set({
      name: 'humanity_session',
      value: jwt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_CONFIG.SESSION_ACCESS_TTL,
    });`;

const newCookieSet = `    cookieStore.set({
      name: 'humanity_session',
      value: jwt,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_CONFIG.SESSION_ACCESS_TTL,
    });
    
    // Also set a non-httpOnly cookie for the client router to detect auth state
    cookieStore.set({
      name: 'siwe_session',
      value: 'active',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_CONFIG.SESSION_ACCESS_TTL,
    });`;

verifyRoute = verifyRoute.replace(oldCookieSet, newCookieSet);
fs.writeFileSync('app/api/auth/siwe/verify/route.ts', verifyRoute);
console.log('Fixed SIWE verify to also set siwe_session');
