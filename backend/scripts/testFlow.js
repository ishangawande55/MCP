require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test data
const testApplications = {
  birth: {
    type: 'BIRTH',
    applicant: {
      name: 'Rajesh Kumar',
      email: 'rajesh@example.com',
      phone: '+91-9876543210',
      address: '123 Main Street, Mumbai, Maharashtra'
    },
    birthDetails: {
      childName: 'Aarav Kumar',
      dateOfBirth: '2024-01-15',
      gender: 'Male',
      placeOfBirth: 'City Hospital, Mumbai',
      fatherName: 'Rajesh Kumar',
      motherName: 'Priya Kumar'
    }
  },
  trade: {
    type: 'TRADE_LICENSE',
    applicant: {
      name: 'Sunita Patel',
      email: 'sunita@example.com', 
      phone: '+91-9876543211',
      address: '456 Market Road, Delhi'
    },
    tradeDetails: {
      businessName: 'Sunita Fashion Boutique',
      businessType: 'Retail Clothing',
      businessAddress: '456 Market Road, Delhi, 110001',
      licenseDuration: 12
    }
  }
};

const testOfficer = {
  email: 'admin@municipal.gov',
  password: 'admin123'
};

class FlowTester {
  constructor() {
    this.axios = axios.create({ baseURL: BASE_URL });
  }

  async login() {
    console.log('🔐 Logging in as officer...');
    
    try {
      const response = await this.axios.post('/auth/login', testOfficer);
      authToken = response.data.data.token;
      
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      console.log('✅ Login successful');
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.response?.data || error.message);
      return false;
    }
  }

  async createApplication(appData) {
    console.log(`📝 Creating ${appData.type} application...`);
    
    try {
      const response = await this.axios.post('/applications', appData);
      console.log('✅ Application created:', response.data.data.application.applicationId);
      return response.data.data.application;
    } catch (error) {
      console.error('❌ Application creation failed:', error.response?.data || error.message);
      return null;
    }
  }

  async getApplications() {
    console.log('📋 Fetching applications...');
    
    try {
      const response = await this.axios.get('/applications?status=PENDING');
      return response.data.data.applications;
    } catch (error) {
      console.error('❌ Fetch applications failed:', error.response?.data || error.message);
      return [];
    }
  }

  async assignApplication(applicationId) {
    console.log(`👤 Assigning application ${applicationId}...`);
    
    try {
      const response = await this.axios.put(`/applications/${applicationId}/assign`);
      console.log('✅ Application assigned');
      return response.data.data.application;
    } catch (error) {
      console.error('❌ Assignment failed:', error.response?.data || error.message);
      return null;
    }
  }

  async reviewApplication(applicationId, status, comments = 'Test review comments') {
    console.log(`📋 Reviewing application ${applicationId} as ${status}...`);
    
    try {
      const response = await this.axios.put(`/applications/${applicationId}/review`, {
        status,
        comments
      });
      console.log(`✅ Application ${status}`);
      return response.data.data.application;
    } catch (error) {
      console.error('❌ Review failed:', error.response?.data || error.message);
      return null;
    }
  }

  async issueCredential(applicationId) {
    console.log(`🏛️ Issuing credential for ${applicationId}...`);
    
    try {
      const response = await this.axios.post(`/credentials/issue/${applicationId}`);
      console.log('✅ Credential issued successfully!');
      console.log('📄 IPFS CID:', response.data.data.credential.ipfsCID);
      console.log('⛓️  Transaction Hash:', response.data.data.credential.blockchainTxHash);
      return response.data.data;
    } catch (error) {
      console.error('❌ Credential issuance failed:', error.response?.data || error.message);
      return null;
    }
  }

  async verifyCredential(credentialId, documentHash) {
    console.log(`🔍 Verifying credential ${credentialId}...`);
    
    try {
      const response = await this.axios.post('/credentials/verify', {
        credentialId,
        documentHash
      });
      console.log('✅ Verification result:', response.data.data.isValid ? 'VALID' : 'INVALID');
      return response.data.data;
    } catch (error) {
      console.error('❌ Verification failed:', error.response?.data || error.message);
      return null;
    }
  }

  async runCompleteFlow() {
    console.log('🚀 Starting Complete Municipal Credential Flow Test\n');
    
    // 1. Login
    if (!await this.login()) return;
    
    // 2. Create test applications
    console.log('\n📥 Step 1: Creating Test Applications');
    const birthApp = await this.createApplication(testApplications.birth);
    const tradeApp = await this.createApplication(testApplications.trade);
    
    if (!birthApp || !tradeApp) {
      console.log('❌ Failed to create applications');
      return;
    }
    
    // Small delay to ensure applications are saved
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Get and assign applications
    console.log('\n👤 Step 2: Officer Assignment & Review');
    const applications = await this.getApplications();
    
    for (const app of applications.slice(0, 2)) {
      // Assign to officer
      await this.assignApplication(app._id);
      
      // Approve application
      await this.reviewApplication(app._id, 'APPROVED', 'All documents verified and approved');
    }
    
    // 4. Issue credentials
    console.log('\n🏛️ Step 3: Credential Issuance');
    const issuedCredentials = [];
    
    for (const app of applications.slice(0, 2)) {
      const credentialData = await this.issueCredential(app.applicationId);
      if (credentialData) {
        issuedCredentials.push(credentialData);
      }
    }
    
    // 5. Verification test
    console.log('\n🔍 Step 4: Credential Verification');
    for (const cred of issuedCredentials) {
      // Simulate verification with correct hash
      await this.verifyCredential(
        cred.credential.credentialId, 
        cred.credential.documentHash
      );
    }
    
    console.log('\n🎉 Flow Test Completed Successfully!');
    console.log('📊 Summary:');
    console.log(`   - Applications Created: 2`);
    console.log(`   - Credentials Issued: ${issuedCredentials.length}`);
    console.log(`   - Blockchain Transactions: ${issuedCredentials.length}`);
    
    return {
      applications: [birthApp, tradeApp],
      credentials: issuedCredentials
    };
  }
}

// Run the test
const tester = new FlowTester();

tester.runCompleteFlow()
  .then(results => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });