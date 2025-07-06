#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Check if server is running
function checkServer() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET',
            timeout: 3000
        }, (res) => {
            resolve(true);
        });
        
        req.on('error', () => resolve(false));
        req.on('timeout', () => resolve(false));
        req.end();
    });
}

async function main() {
    console.log('🔍 Checking if server is running on http://localhost:3000...');
    
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log('\n❌ Server is not running!');
        console.log('Please start the server first:');
        console.log('  npm start');
        console.log('');
        console.log('Then run the tests again:');
        console.log('  node run-tests.js');
        process.exit(1);
    }
    
    console.log('✅ Server is running!');
    console.log('\n🚀 Starting comprehensive test suite...\n');
    
    // Run the test suite
    const testSuite = require('./test-suite.js');
    await testSuite.runAllTests();
}

main().catch(console.error); 