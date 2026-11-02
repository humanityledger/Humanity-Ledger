const fs = require('fs');
let code = fs.readFileSync('components/bsv/InstitutionalPortfolioView.tsx', 'utf8');

code = code.replace(/onCreate=\{[^}]*\}/, `onCreate={() => setView('BUY')}`);
code = code.replace(/onShield=\{[^}]*\}/, ``);
code = code.replace(/onSecurity=\{[^}]*\}/, ``);
code = code.replace(/onSmartAccount=\{[^}]*\}/, ``);
code = code.replace(/onDeploy=\{[^}]*\}/, ``);
code = code.replace(/onOmnichain=\{[^}]*\}/, ``);
code = code.replace(/onMempool=\{[^}]*\}/, ``);

fs.writeFileSync('components/bsv/InstitutionalPortfolioView.tsx', code);
console.log('Removed Coming Soon placeholders');
