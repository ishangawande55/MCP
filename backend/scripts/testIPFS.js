require('dotenv').config();
const ipfsService = require('../services/ipfsService');
const fs = require('fs');

async function testIPFS() {
  console.log('🧪 Testing IPFS Connection...');
  
  // Test connection
  const isConnected = await ipfsService.checkConnection();
  if (!isConnected) {
    console.log('⚠️  IPFS node not available. Using fallback mode.');
  }
  
  // Create test file
  const testData = {
    message: 'Test municipal credential data',
    timestamp: new Date().toISOString(),
    type: 'TEST_CERTIFICATE'
  };
  
  const testFilePath = './test-file.json';
  fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
  
  console.log('📤 Testing file upload...');
  try {
    const cid = await ipfsService.uploadFile(testFilePath);
    console.log(`✅ File uploaded successfully! CID: ${cid}`);
    
    console.log('🔗 IPFS Gateway URL:', ipfsService.getIPFSGatewayURL(cid));
    
    // Clean up
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    console.error('❌ IPFS test failed:', error.message);
  }
}

testIPFS();