
import fetch from "node-fetch";

async function testApis() {
    console.log("Running API tests...");
    let passed = 0;
    let failed = 0;

    const endpoints = [
        { name: "Link Preview", url: "http://localhost:3000/api/link-preview?url=https://google.com" },
        { name: "Communities List", url: "http://localhost:3000/api/communities" },
        { name: "Community Posts", url: "http://localhost:3000/api/chat/communities/posts?communityId=123" }
    ];

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep.url);
            console.log(`[${res.status}] ${ep.name} - ${res.ok ? "PASS" : "FAIL"}`);
            if (res.ok) passed++; else failed++;
        } catch (e) {
            console.log(`[ERROR] ${ep.name} - FAIL (${e.message})`);
            failed++;
        }
    }
    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
}

testApis();

