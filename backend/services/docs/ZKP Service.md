# ZKP Service Documentation

## 📋 Overview

The ZKPService provides Zero-Knowledge Proof generation and verification capabilities for municipal credential applications. It enables selective disclosure of application fields while maintaining privacy and ensuring data integrity through cryptographic proofs.

## 🏗️ Service Architecture

![ZKP Architecture](diagrams/ZKP%20Architecture.png)

## 🎯 Key Features

- **🔐 Zero-Knowledge Proofs**: Prove statements without revealing underlying data
- **🕵️ Selective Disclosure**: Choose which fields to reveal in proofs
- **🔒 Privacy Preservation**: Keep sensitive application data private
- **📊 Multiple Application Types**: Support for Birth, Death, Trade License, and NOC
- **⚡ Groth16 Efficiency**: Optimal proof size and verification time
- **🔧 Circuit Compatibility**: Works with ApplicationZKP Circom circuit

## 📁 Circuit Assets & Configuration

### File Structure
```
backend/
├── zkp/
│   ├── build/
│   │   └── ApplicationZKP/
│   │       └── ApplicationZKP_js/
│   │           └── ApplicationZKP.wasm      # Circuit WASM
│   │       └── ApplicationZKP.zkey          # Proving key
│   ├── setup/
│   │   └── verification_key.json            # Verification key
│   └── circuits/
│       └── ApplicationZKP.circom            # Circuit source
```

### Circuit Configuration
```javascript
constructor() {
  // Circuit asset paths
  this.wasmFile = path.resolve(__dirname, "../zkp/build/ApplicationZKP/ApplicationZKP_js/ApplicationZKP.wasm");
  this.zkeyFile = path.resolve(__dirname, "../zkp/build/ApplicationZKP/ApplicationZKP.zkey");
  this.verificationKeyFile = path.resolve(__dirname, "../zkp/setup/verification_key.json");

  // Circuit configuration - MUST match ApplicationZKP.circom
  this.nFields = 4; // Number of fields per application type
}
```

## 🔧 Core Methods

### 1. Data Type Conversion

![Data Type Conversion](diagrams/Data%20Type%20Conversion.png)

**Method**: `toBigInt(value)`
```javascript
/**
 * Safely converts input to BigInt for circuit compatibility
 * Handles various data types with graceful fallbacks
 * @param {any} value - Input value to convert
 * @returns {BigInt} Circuit-compatible BigInt
 */
toBigInt(value) {
  if (value === undefined || value === null) return BigInt(0);
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && !isNaN(value)) return BigInt(value);
  if (value instanceof Date) return BigInt(value.getTime());
  if (typeof value === "string" && value.trim() !== "") {
    try {
      // Convert string to hex representation for consistent hashing
      return BigInt("0x" + Buffer.from(value, "utf8").toString("hex"));
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}
```

### 2. Application Type Mapping

**Method**: `_getApplicationTypeId(type)`
```javascript
/**
 * Maps application type string to numeric ID for circuit
 * @param {string} type - Application type
 * @returns {number} Numeric type ID
 */
_getApplicationTypeId(type) {
  switch (type?.toUpperCase()) {
    case "BIRTH": return 1;      // Birth certificate applications
    case "DEATH": return 2;      // Death certificate applications  
    case "TRADE_LICENSE": return 3; // Business license applications
    case "NOC": return 4;        // No Objection Certificate applications
    default: return 0;           // Unknown/unsupported type
  }
}
```

### 3. Main Proof Generation

![Main Proof Generation](diagrams/Main%20Proof%20Generation.png)

**Method**: `generateProofFromApplication(applicationData)`
```javascript
/**
 * Generate ZKP proof from raw application data
 * Handles selective disclosure and ensures nFields alignment
 * @param {Object} applicationData - Full application record
 * @returns {Promise<Object>} Proof package with Merkle root
 */
async generateProofFromApplication(applicationData) {
  try {
    // Validate circuit files exist
    if (!fs.existsSync(this.wasmFile)) throw new Error(`WASM file not found: ${this.wasmFile}`);
    if (!fs.existsSync(this.zkeyFile)) throw new Error(`ZKey file not found: ${this.zkeyFile}`);

    // Determine field structure based on application type
    let details = {};
    let fieldOrder = [];
    
    switch (applicationData.type?.toUpperCase()) {
      case "BIRTH":
        details = applicationData.birthDetails || {};
        fieldOrder = ["childName", "dateOfBirth", "gender", "fatherName"];
        break;
      case "DEATH":
        details = applicationData.deathDetails || {};
        fieldOrder = ["fullName", "dateOfDeath", "causeOfDeath", "fatherName"];
        break;
      case "TRADE_LICENSE":
        details = applicationData.tradeDetails || {};
        fieldOrder = ["businessName", "registrationNumber", "ownerName", "licenseType"];
        break;
      case "NOC":
        details = applicationData.nocDetails || {};
        fieldOrder = ["applicantName", "documentType", "issuedBy", "validTill"];
        break;
      default:
        throw new Error("Unsupported application type for ZKP");
    }

    // Process selective disclosure
    const disclosedFields = applicationData.disclosedFields || [];
    const inputFields = [];
    const disclosedFlags = [];

    for (let i = 0; i < this.nFields; i++) {
      const fieldName = fieldOrder[i];
      const value = details[fieldName] !== undefined ? details[fieldName] : 0;
      inputFields.push(this.toBigInt(value));
      disclosedFlags.push(disclosedFields.includes(fieldName) ? BigInt(1) : BigInt(0));
    }

    // Compute Merkle tree for selective disclosure
    const poseidon = await circomlibjs.buildPoseidon();
    const F = poseidon.F;

    // Generate leaf hashes (zero for undisclosed fields)
    const leafHashes = [];
    for (let i = 0; i < inputFields.length; i++) {
      const leafVal = disclosedFlags[i] === BigInt(1) ? inputFields[i] : BigInt(0);
      const leafHash = leafVal === BigInt(0) ? BigInt(0) : F.toObject(poseidon([leafVal]));
      leafHashes.push(leafHash);
    }

    // Compute Merkle root
    const rootHasher = F.toObject(poseidon(leafHashes));

    // Build circuit inputs
    const circuitInput = {
      fields: inputFields,
      disclosed: disclosedFlags,
      applicationType: BigInt(this._getApplicationTypeId(applicationData.type)),
      merkleRoot: BigInt(rootHasher),
    };

    // Generate proof using Groth16
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      this.wasmFile,
      this.zkeyFile
    );

    return {
      proof,
      publicSignals,
      merkleRoot: BigInt(rootHasher),
    };
  } catch (error) {
    console.error("ZKPService.generateProofFromApplication Error:", error);
    throw new Error(`Zero-Knowledge Proof generation error: ${error.message}`);
  }
}
```

### 4. Proof Verification

**Method**: `verifyProof(proof, publicSignals)`
```javascript
/**
 * Verify proof against stored verification key
 * @param {Object} proof - Groth16 proof object
 * @param {Array} publicSignals - Public signals from proof generation
 * @returns {Promise<boolean>} Verification result
 */
async verifyProof(proof, publicSignals) {
  try {
    if (!fs.existsSync(this.verificationKeyFile))
      throw new Error(`Verification key not found: ${this.verificationKeyFile}`);
    
    const vKey = JSON.parse(fs.readFileSync(this.verificationKeyFile, "utf-8"));
    return await snarkjs.groth16.verify(vKey, publicSignals, proof);
  } catch (error) {
    console.error("ZKPService.verifyProof Error:", error);
    return false;
  }
}
```

## 📊 Application Type Schemas

### Birth Certificate Fields
```javascript
{
  fieldOrder: ["childName", "dateOfBirth", "gender", "fatherName"],
  description: "Birth registration details",
  fields: {
    childName: "Full name of the child",
    dateOfBirth: "Date of birth (timestamp)",
    gender: "Gender information", 
    fatherName: "Father's full name"
  }
}
```

### Death Certificate Fields
```javascript
{
  fieldOrder: ["fullName", "dateOfDeath", "causeOfDeath", "fatherName"],
  description: "Death registration details", 
  fields: {
    fullName: "Deceased person's full name",
    dateOfDeath: "Date of death (timestamp)",
    causeOfDeath: "Cause of death information",
    fatherName: "Father's name for identification"
  }
}
```

### Trade License Fields
```javascript
{
  fieldOrder: ["businessName", "registrationNumber", "ownerName", "licenseType"],
  description: "Business license information",
  fields: {
    businessName: "Registered business name",
    registrationNumber: "Official registration number",
    ownerName: "Business owner's name",
    licenseType: "Type of business license"
  }
}
```

### NOC Fields
```javascript
{
  fieldOrder: ["applicantName", "documentType", "issuedBy", "validTill"],
  description: "No Objection Certificate details",
  fields: {
    applicantName: "Applicant's full name",
    documentType: "Type of NOC document",
    issuedBy: "Issuing authority",
    validTill: "Certificate validity end date"
  }
}
```

## 💡 Usage Examples

### Complete Proof Generation Flow

```javascript
const ZKPService = require('./ZKPService');

async function createSelectiveDisclosureProof() {
  // Example birth certificate application
  const birthApplication = {
    type: "BIRTH",
    disclosedFields: ["childName", "dateOfBirth"], // Only reveal name and DOB
    birthDetails: {
      childName: "Aarav Kumar",
      dateOfBirth: new Date("2023-05-15"),
      gender: "Male",                    // Will be hidden
      fatherName: "Rajesh Kumar"         // Will be hidden
    }
  };

  try {
    // Generate ZKP proof
    const proofPackage = await ZKPService.generateProofFromApplication(birthApplication);
    
    console.log("Proof generated successfully:");
    console.log("- Merkle Root:", proofPackage.merkleRoot.toString());
    console.log("- Public Signals:", proofPackage.publicSignals.length);
    console.log("- Proof Components:", Object.keys(proofPackage.proof));

    // Verify the proof
    const isValid = await ZKPService.verifyProof(
      proofPackage.proof, 
      proofPackage.publicSignals
    );
    
    console.log("Proof verification:", isValid ? "✅ Valid" : "❌ Invalid");

    return {
      proof: proofPackage.proof,
      publicSignals: proofPackage.publicSignals,
      merkleRoot: proofPackage.merkleRoot,
      verified: isValid
    };

  } catch (error) {
    console.error("Proof generation failed:", error);
    throw error;
  }
}
```

### Integration with Credential Issuance

```javascript
async function issueZKPCredential(applicationData, commissioner) {
  try {
    // 1. Generate ZKP proof for selective disclosure
    const zkpProof = await ZKPService.generateProofFromApplication(applicationData);
    
    // 2. Create Verifiable Credential with ZKP
    const vcPayload = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.org/gov/zkp/v1"
      ],
      type: ["VerifiableCredential", "ZKPSealedCredential"],
      issuer: commissioner.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: applicationData.applicantDID,
        // Only include disclosed fields in the VC
        ...getDisclosedFields(applicationData),
        // ZKP-specific fields
        zkpProof: {
          merkleRoot: zkpProof.merkleRoot.toString(),
          proof: zkpProof.proof,
          publicSignals: zkpProof.publicSignals,
          circuitId: "ApplicationZKP",
          disclosedFields: applicationData.disclosedFields
        }
      }
    };

    // 3. Sign VC (using Vault or other signing service)
    const signedVC = await vaultService.signDataWithZKP(
      commissioner.vaultToken,
      commissioner.keyName,
      vcPayload
    );

    return {
      signedVC,
      zkpProof: zkpProof,
      verificationResult: await ZKPService.verifyProof(zkpProof.proof, zkpProof.publicSignals)
    };

  } catch (error) {
    console.error("ZKP credential issuance failed:", error);
    throw error;
  }
}

// Helper to extract only disclosed fields
function getDisclosedFields(applicationData) {
  const disclosed = {};
  const details = getApplicationDetails(applicationData);
  
  applicationData.disclosedFields.forEach(field => {
    if (details[field] !== undefined) {
      disclosed[field] = details[field];
    }
  });
  
  return disclosed;
}
```

### Verification-Only Service

```javascript
class ZKPVerificationService {
  async verifyCredentialWithZKP(verifiableCredential) {
    const zkpProof = verifiableCredential.credentialSubject.zkpProof;
    
    if (!zkpProof) {
      throw new Error("Credential does not contain ZKP proof");
    }

    // Verify the ZKP proof
    const zkpValid = await ZKPService.verifyProof(
      zkpProof.proof,
      zkpProof.publicSignals
    );

    // Verify the VC signature (using appropriate service)
    const vcValid = await verifyVCSignature(verifiableCredential);

    return {
      zkpValid,
      vcValid,
      overallValid: zkpValid && vcValid,
      disclosedFields: zkpProof.disclosedFields,
      merkleRoot: zkpProof.merkleRoot
    };
  }

  async verifySelectiveClaim(credential, claimPredicate) {
    // For advanced use cases: verify specific claims without full disclosure
    // This would involve additional circuit-specific verification logic
    console.log("Selective claim verification requires custom circuit predicates");
    return false;
  }
}
```

## 🛡️ Security Considerations

### Circuit Trust Setup
```javascript
// The service relies on trusted setup parameters
// Ensure zkey file is generated from trusted ceremony
async function validateCircuitSetup() {
  const requiredFiles = [
    this.wasmFile,
    this.zkeyFile, 
    this.verificationKeyFile
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required circuit file: ${file}`);
    }
  }
  
  console.log("✅ All circuit files present and validated");
}
```

### Input Validation
```javascript
function validateApplicationData(applicationData) {
  const validTypes = ["BIRTH", "DEATH", "TRADE_LICENSE", "NOC"];
  
  if (!validTypes.includes(applicationData.type?.toUpperCase())) {
    throw new Error(`Invalid application type: ${applicationData.type}`);
  }
  
  if (!Array.isArray(applicationData.disclosedFields)) {
    throw new Error("disclosedFields must be an array");
  }
  
  // Validate field existence based on type
  const details = getApplicationDetails(applicationData);
  applicationData.disclosedFields.forEach(field => {
    if (!(field in details)) {
      throw new Error(`Disclosed field '${field}' not found in application data`);
    }
  });
}
```

## 📈 Performance Optimization

### Poseidon Hash Pre-computation
```javascript
// Cache Poseidon instance for better performance
class OptimizedZKPService extends ZKPService {
  constructor() {
    super();
    this.poseidonPromise = null;
  }

  async getPoseidon() {
    if (!this.poseidonPromise) {
      this.poseidonPromise = circomlibjs.buildPoseidon();
    }
    return await this.poseidonPromise;
  }

  async generateProofFromApplication(applicationData) {
    const poseidon = await this.getPoseidon();
    // ... rest of implementation using cached poseidon
  }
}
```

### Proof Caching Strategy
```javascript
// For applications with identical disclosed fields, consider proof caching
const proofCache = new Map();

function getProofCacheKey(applicationData) {
  return JSON.stringify({
    type: applicationData.type,
    disclosedFields: applicationData.disclosedFields.sort(),
    // Hash of the actual field values
    dataHash: crypto.createHash('sha256')
      .update(JSON.stringify(getApplicationDetails(applicationData)))
      .digest('hex')
  });
}
```

---

**Author**: Ishan Gawande  
**Version**: 1.0.0  
**Cryptography**: Groth16 zk-SNARKs, Poseidon Hash  
**Circuit**: ApplicationZKP.circom  
**Dependencies**: snarkjs, circomlibjs, path, fs  
**Compatibility**: Node.js 14+, Circom 2.0+  
**License**: MIT