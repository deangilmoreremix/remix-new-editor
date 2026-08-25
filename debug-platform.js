// Debug script to test all core functionality
import fs from 'fs';
import { getMuapiClient } from './lib/muapi.js';
import { SendsparkPersonalizationEngine } from './lib/sendsparkEngine.js';
import GRAPESJS_TEMPLATES from './lib/grapesjs-templates.js';

console.log('🚀 Starting comprehensive debug of video personalization platform...\n');

// Test 1: Muapi Client Initialization
console.log('1️⃣ Testing Muapi Client...');
try {
  const muapi = getMuapiClient('test-api-key');
  console.log('✅ Muapi client initialized successfully');
} catch (error) {
  console.error('❌ Muapi client initialization failed:', error.message);
}

// Test 2: Sendspark Engine Initialization
console.log('\n2️⃣ Testing Sendspark Engine...');
try {
  const engine = new SendsparkPersonalizationEngine({
    apiKey: 'test-api-key',
    userVideo: { url: 'test-video.mp4', duration: 30 },
    contacts: [{ email: 'test@example.com', firstName: 'John' }],
    script: 'Hi {{firstName}}!'
  });
  console.log('✅ Sendspark engine initialized successfully');
} catch (error) {
  console.error('❌ Sendspark engine initialization failed:', error.message);
}

// Test 3: Template Validation
console.log('\n3️⃣ Testing Templates...');
try {
  console.log(`✅ Templates loaded: ${Object.keys(GRAPESJS_TEMPLATES).length} templates`);
  console.log(`   Available templates: ${Object.keys(GRAPESJS_TEMPLATES).join(', ')}`);
} catch (error) {
  console.error('❌ Template loading failed:', error.message);
}

// Test 4: Component File Validation
console.log('\n4️⃣ Testing Component Files...');
const componentsToTest = [
  './components/VideoRecorder.jsx',
  './components/SendsparkWorkflow.jsx',
  './components/GrapesJSEditor.jsx',
  './components/VideoPersonalizationHub.jsx'
];

componentsToTest.forEach(component => {
  try {
    const content = fs.readFileSync(component, 'utf8');
    if (content.includes('import React') && content.includes('export default')) {
      console.log(`✅ ${component} - valid React component`);
    } else {
      console.log(`⚠️ ${component} - missing React structure`);
    }
  } catch (error) {
    console.error(`❌ ${component} - file read failed:`, error.message);
  }
});

// Test 5: API Endpoints
console.log('\n5️⃣ Testing API Endpoints...');
const endpointsToTest = [
  { url: 'https://pageshot.site/v1/screenshot?url=https://example.com&width=800&height=600', description: 'PageShot API' }
];

for (const endpoint of endpointsToTest) {
  try {
    console.log(`Testing ${endpoint.description}...`);
    const response = await fetch(endpoint.url);
    if (response.ok) {
      console.log(`✅ ${endpoint.description} - accessible`);
    } else {
      console.log(`⚠️ ${endpoint.description} - returned ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️ ${endpoint.description} - network error:`, error.message);
  }
}

// Test 6: Package Dependencies
console.log('\n6️⃣ Testing Package Dependencies...');
const requiredPackages = [
  'grapesjs',
  'html2canvas',
  'react',
  'next'
];

requiredPackages.forEach(pkg => {
  try {
    // Check if package.json has the package
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    if (packageJson.dependencies && packageJson.dependencies[pkg]) {
      console.log(`✅ ${pkg} - package declared in package.json`);
    } else {
      console.log(`⚠️ ${pkg} - not found in package.json`);
    }
  } catch (error) {
    console.error(`❌ ${pkg} - package check failed:`, error.message);
  }
});

// Test 7: File Structure Validation
console.log('\n7️⃣ Testing File Structure...');
const requiredFiles = [
  './lib/muapi.js',
  './lib/sendsparkEngine.js',
  './lib/grapesjs-templates.js',
  './components/VideoRecorder.jsx',
  './components/SendsparkWorkflow.jsx',
  './components/GrapesJSEditor.jsx',
  './pages/v/[id].js'
];

requiredFiles.forEach(file => {
  try {
    fs.accessSync(file);
    console.log(`✅ ${file} - file exists`);
  } catch (error) {
    console.error(`❌ ${file} - file missing`);
  }
});

console.log('\n🎯 Debug complete! Check results above for any issues.');