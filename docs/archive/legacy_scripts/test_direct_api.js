const http = require('http');

const postData = JSON.stringify({
  recipient: '0x2eeb630dc3e350b0e664151c928da732f12e70ad', // Some fake peer
  content: 'Hello World from Test'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat/direct',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'x-web3-address': '0x0fe5267dbdfa61b28e103db99a5cf7b57555c894' // My fake address
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('POST Response:', res.statusCode, data));
});
req.on('error', e => console.error(e));
req.write(postData);
req.end();
