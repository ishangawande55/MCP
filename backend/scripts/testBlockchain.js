require('dotenv').config();
const blockchainService = require('../services/blockchainService');

async function testBlockchain() {
  console.log('⛓️ Testing Blockchain Connection...');
  
  try {
    // Test credential issuance
    const testCredentialId = `TEST-${Date.now()}`;
    const testHash = blockchainService.generateHash({ test: 'data' });
    const testCID = `QmTest${Date.now()}`;
    
    console.log('📝 Testing credential issuance...');
    const result = await blockchainService.issueCredential(testCredentialId, testHash, testCID, 0);
    console.log('✅ Blockchain transaction successful!');
    console.log('   Transaction Hash:', result.transactionHash);
    console.log('   Block Number:', result.blockNumber);
    
    // Test verification
    console.log('🔍 Testing verification...');
    const isValid = await blockchainService.verifyCredential(testCredentialId, testHash);
    console.log('✅ Verification result:', isValid ? 'VALID' : 'INVALID');
    
    // Test getting credential
    console.log('📋 Testing credential retrieval...');
    const credential = await blockchainService.getCredential(testCredentialId);
    console.log('✅ Credential retrieved from blockchain');
    console.log('   Issuer:', credential.issuer);
    console.log('   IPFS CID:', credential.ipfsCID);
    
  } catch (error) {
    console.error('❌ Blockchain test failed:', error.message);
  }
}

testBlockchain();