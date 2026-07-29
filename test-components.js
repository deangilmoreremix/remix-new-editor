// Test script to validate video personalization components
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Video Personalization Components...\n');

// Check if files exist
const filesToCheck = [
  'components/VideoPersonalizationHub.jsx',
  'components/VideoUploader.jsx',
  'components/VideoPersonalizer.jsx',
  'components/TokenEditor.jsx',
  'components/modals/ContactImporterModal.jsx',
  'pages/personalize.jsx',
  'styles/video-personalization.css',
  'VIDEO_PERSONALIZATION_README.md',
  'sample-contacts.csv'
];

let allFilesExist = true;

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - EXISTS`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n📊 Test Results:');
if (allFilesExist) {
  console.log('✅ All component files are present');

  // Check file sizes to ensure they're not empty
  const hubSize = fs.statSync('components/VideoPersonalizationHub.jsx').size;
  console.log(`📏 Main Hub Component: ${hubSize} bytes`);

  if (hubSize > 1000) {
    console.log('✅ Main component has substantial content');
  } else {
    console.log('⚠️  Main component seems small, check content');
  }

} else {
  console.log('❌ Some files are missing');
}

console.log('\n🎯 Next Steps:');
console.log('1. Start the development server: npm run dev');
console.log('2. Navigate to http://localhost:3000/personalize');
console.log('3. Test the complete workflow: Upload → Contacts → Tokens → Generate');
console.log('4. Verify UI responsiveness and error handling');