import { Fr } from '@aztec-labs/aztec.js/fields';

const key = Fr.random().toString();
console.log('\n========================================');
console.log('AZTEC_RELAYER_SECRET_KEY=' + key);
console.log('========================================\n');
console.log('Copy the line above into Railway → Variables');
