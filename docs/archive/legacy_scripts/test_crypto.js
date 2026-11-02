const assert = require('assert');

function simulatePaymentBubbleRender(content, isMe) {
    const raw = content.replace('__PAYMENT__::', '');
    let amount = '?', recipient = '', token = 'QDs', txHash = '';
    let hasError = false;
    try {
        const parsed = JSON.parse(raw);
        amount = parsed.amount ?? parsed; 
        token = parsed.token || 'QDs'; 
        txHash = parsed.txHash || '';
        recipient = parsed.to ? \\...\\ : '';
    } catch(e) { 
        amount = raw; 
        hasError = true;
    }
    
    return {
        amount, token, recipient, txHash, hasError,
        renderString: \\ \ to \ (Tx: \)\
    };
}

console.log('Running 500 simulated offline crypto transfer tests...');
let successCount = 0;
let errors = 0;

for(let i=0; i<500; i++) {
    const amount = (Math.random() * 100).toFixed(4);
    const tokens = ['ETH', 'USDC', 'USDT', 'QDs'];
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const to = '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
    
    const payload = JSON.stringify({ amount, token, txHash, to });
    const content = \__PAYMENT__::\\;
    
    try {
        const result = simulatePaymentBubbleRender(content, true);
        assert.strictEqual(result.hasError, false);
        assert.strictEqual(result.amount, amount);
        assert.strictEqual(result.token, token);
        assert.strictEqual(result.txHash, txHash);
        assert.strictEqual(result.recipient, \\...\\);
        successCount++;
    } catch(e) {
        errors++;
        console.error('Test failed at iteration', i, e);
    }
}

console.log(\\n[RESULT] 500 Offline Crypto Tests Completed.\);
console.log(\? SUCCESS: \\);
console.log(\? ERRORS: \\);
