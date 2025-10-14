/**
 * @file zkpIssueTest.js
 * @author
 * Ishan Gawande
 * @description
 * ---------------------------------------------------------------------------
 * End-to-End Test Script: Credential Issuance Flow
 * ---------------------------------------------------------------------------
 *  Simulates:
 *   - Application creation (BIRTH type)
 *   - ZKP proof & Merkle root generation
 *   - Vault signing of Verifiable Credential (VC)
 *   - IPFS upload of VC JWT
 *   - Blockchain anchoring
 *   - MongoDB persistence of issued credential
 *
 * Prerequisites:
 *  - MongoDB running locally (MCP backend connected)
 *  - Vault dev server running (vaultServer.js)
 *  - IPFS node or web3.storage configured in ipfsService.js
 *  - Blockchain local node (Hardhat/Ganache) or testnet
 * ---------------------------------------------------------------------------
 */

require('dotenv').config();
require('../config/database'); // Mongo connection
const { processApplication } = require('../controllers/application/commissionerApplicationController');
const Application = require('../models/Application');
const User = require('../models/User');
const { APPLICATION_STATUS } = require('../utils/constants');

(async () => {
  console.log('=== Starting Credential Issuance End-to-End Test ===');

  try {
    // -----------------------------------------------------------------------
    // 1. Setup mock applicant and commissioner
    // -----------------------------------------------------------------------
    console.log('[Setup Log] Creating mock users...');

    const applicant = await User.create({
      name: 'Test Applicant',
      email: 'applicant@test.com',
      role: 'APPLICANT',
      did: 'did:example:applicant123',
      department: 'HEALTHCARE',
    });

    const commissioner = await User.create({
      name: 'Dr. Ishan Gawande',
      email: 'commissioner@test.com',
      role: 'COMMISSIONER',
      did: 'did:example:commissioner789',
      department: 'HEALTHCARE',
      vault: {
        keyName: 'transit/keys/commissioner-key-test',
        token: process.env.VAULT_SCOPED_TOKEN,
      },
      blockchainAddress: '0x1234567890abcdef1234567890abcdef12345678',
    });

    // -----------------------------------------------------------------------
    // 2. Create mock application
    // -----------------------------------------------------------------------
    console.log('[Setup Log] Creating test application (BIRTH)...');

    const mockApp = await Application.create({
      applicationId: `APP-${Date.now()}`,
      type: 'BIRTH',
      department: 'HEALTHCARE',
      applicant,
      forwardedCommissioner: commissioner._id,
      status: APPLICATION_STATUS.FORWARDED_TO_COMMISSIONER,
      birthDetails: {
        childName: 'WAS',
        gender: 'Male',
        dob: '2020-12-12',
        placeOfBirth: 'Akola Hospital',
        fatherName: 'Rajeshwar',
        motherName: 'Kavita',
      },
      disclosedFields: ['childName', 'dob', 'gender'],
    });

    console.log(`[Setup Log] Application Created: ${mockApp.applicationId}`);

    // -----------------------------------------------------------------------
    // 3. Simulate request and response
    // -----------------------------------------------------------------------
    const req = {
      params: { id: mockApp.applicationId },
      body: { action: 'APPROVE', reviewComments: 'ZKP issuance test run' },
      user: commissioner,
    };

    const res = {
      status: (code) => ({
        json: (data) => {
          console.log('\n=== Response ===');
          console.log('Status:', code);
          console.log(JSON.stringify(data, null, 2));
          return data;
        },
      }),
      json: (data) => {
        console.log('\n=== Response ===');
        console.log(JSON.stringify(data, null, 2));
        return data;
      },
    };

    // -----------------------------------------------------------------------
    // 4. Execute issuance controller
    // -----------------------------------------------------------------------
    console.log('\n[Issuance Test Log] Executing controller...');
    const result = await processApplication(req, res);

    // -----------------------------------------------------------------------
    // 5. Verify persisted credential
    // -----------------------------------------------------------------------
    if (result?.success) {
      console.log('\n[Verification Log] Fetching issued credential...');
      const issuedCred = await require('../models/Credential').findOne({
        applicationId: mockApp.applicationId,
      });

      if (!issuedCred) {
        console.error('[Verification Log] ❌ No credential found in DB!');
      } else {
        console.log('[Verification Log] ✅ Credential stored successfully!');
        console.log(JSON.stringify(issuedCred.toObject(), null, 2));
      }
    } else {
      console.error('[Issuance Test Log] ❌ Issuance failed.');
    }

    console.log('\n=== End-to-End Issuance Test Completed ===');
  } catch (err) {
    console.error('=== Test Error ===');
    console.error(err);
  } finally {
    process.exit(0);
  }
})();