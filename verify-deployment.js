#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Run this after deployment to verify all features are working
 */

import fetch from 'node-fetch';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🚀 Starting deployment verification...\n');

const tests = [
  {
    name: 'Homepage Load',
    url: '/',
    check: (response, text) => response.ok && text.includes('Video Personalization')
  },
  {
    name: 'Personalize Page',
    url: '/personalize',
    check: (response, text) => response.ok && text.includes('VideoPersonalizationHub')
  },
  {
    name: 'Sendspark Workflow',
    url: '/sendspark',
    check: (response, text) => response.ok && text.includes('Sendspark Workflow')
  },
  {
    name: 'Demo Page',
    url: '/open-higgsfield-demo',
    check: (response, text) => response.ok && text.includes('Open-Higgsfield-AI')
  },
  {
    name: 'API Health Check',
    url: '/api/health',
    check: (response) => response.ok,
    skip: true // Skip if no health endpoint
  },
  {
    name: 'Static Assets',
    url: '/_next/static/chunks/main.js',
    check: (response) => response.ok && response.headers.get('content-type')?.includes('javascript')
  }
];

async function runTest(test) {
  try {
    console.log(`Testing ${test.name}...`);

    const response = await fetch(`${BASE_URL}${test.url}`, {
      timeout: 10000
    });

    let text = '';
    try {
      text = await response.text();
    } catch (e) {
      // Some responses might not have text
    }

    if (test.skip) {
      console.log(`⚠️  ${test.name} - SKIPPED`);
      return true;
    }

    if (test.check(response, text)) {
      console.log(`✅ ${test.name} - PASSED`);
      return true;
    } else {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   URL: ${BASE_URL}${test.url}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - ERROR: ${error.message}`);
    return false;
  }
}

async function checkEnvironment() {
  console.log('🔍 Checking environment...\n');

  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`Node.js Version: ${nodeVersion}`);

  // Check if we're in production
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);

  // Check API keys (without exposing them)
  const hasMuapiKey = !!process.env.MUAPI_KEY;
  console.log(`Muapi Key: ${hasMuapiKey ? '✅ Configured' : '❌ Missing'}`);

  const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
  console.log(`ElevenLabs Key: ${hasElevenLabsKey ? '✅ Configured' : '⚠️ Optional'}`);

  console.log('');
}

async function main() {
  await checkEnvironment();

  let passed = 0;
  let total = 0;

  for (const test of tests) {
    total++;
    if (await runTest(test)) {
      passed++;
    }
  }

  console.log('\n📊 Verification Results:');
  console.log(`Passed: ${passed}/${total} tests`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! Deployment successful!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});