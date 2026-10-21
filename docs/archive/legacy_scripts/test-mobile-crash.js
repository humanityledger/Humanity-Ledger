const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

(async () => {
    console.log('Starting Next.js server...');
    const server = spawn('npm', ['start'], { stdio: 'pipe', shell: true });
    
    server.stdout.on('data', (data) => {
        const msg = data.toString();
        // console.log(`[SERVER] ${msg}`);
        if (msg.includes('Ready') || msg.includes('started server on')) {
            runTest();
        }
    });

    server.stderr.on('data', (data) => {
        console.error(`[SERVER ERROR] ${data}`);
    });

    async function runTest() {
        console.log('Server is up. Launching browser...');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        page.on('pageerror', error => {
            console.log('\n\n=== UNCAUGHT EXCEPTION ===');
            console.log(error.message);
            console.log(error.stack);
            console.log('===========================\n\n');
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('\n\n=== CONSOLE ERROR ===');
                console.log(msg.text());
                msg.location && console.log(msg.location());
                console.log('=====================\n\n');
            }
        });

        try {
            console.log('Navigating to http://localhost:8080/studio/provenance ...');
            await page.goto('http://localhost:8080/studio/provenance', { waitUntil: 'networkidle0' });
            console.log('Page loaded successfully. Checking for errors...');
            // Wait a bit to ensure React mounts
            await new Promise(r => setTimeout(r, 2000));
            
            const bodyText = await page.evaluate(() => document.body.innerText);
            if (bodyText.includes('Module decoupling error')) {
                console.log('CRASH CONFIRMED IN DOM: Module decoupling error found!');
                console.log(bodyText.substring(0, 1000));
            } else {
                console.log('No error found in DOM. App loaded successfully.');
            }
        } catch (e) {
            console.log('Navigation failed:', e);
        } finally {
            await browser.close();
            server.kill();
            process.exit(0);
        }
    }
})();
