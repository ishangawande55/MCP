# ApplicationZKP Circuit Documentation

## 📋 Overview

The ApplicationZKP circuit is a Zero-Knowledge Proof circuit written in Circom 2.0+ that enables selective disclosure of municipal application data. It uses Poseidon hashing to create commitment schemes that allow proving facts about application data without revealing the underlying sensitive information.

## 🏗️ Circuit Architecture

![Circuit Architecture](diagrams/Circuit%20Architecture.png)

## 🎯 Key Features

- **🔐 Selective Disclosure**: Prove specific fields while keeping others private
- **🔒 Privacy-Preserving**: Zero-knowledge proofs reveal only what's necessary
- **📊 Multi-Application Support**: Handles Birth, Death, Trade License, and NOC applications
- **⚡ Efficient Hashing**: Poseidon hash optimized for ZKP circuits
- **🛡️ Circuit Security**: Static component declarations prevent template bugs
- **📈 Scalable Design**: Fixed 4-field structure for predictable performance

## 🔧 Circuit Components

### 1. FieldHash Template

![FieldHash Template](diagrams/FieldHash%20Template.png)

**Purpose:** Creates a Poseidon hash of a single field value for cryptographic commitments.

### 2. DisclosureLeaf Template

![DisclosedLeaf Template](diagrams/DisclosedLeaf%20Template.png)

**Circuit Code:**
```circom
template DisclosureLeaf() {
    signal input fieldValue;  // Private field value
    signal input disclosed;   // 1 = disclosed, 0 = hidden
    signal output hash;       // Leaf hash output

    component f = FieldHash();
    f.in <== fieldValue;

    // If not disclosed, zero out the hash
    hash <== disclosed * f.out;
}
```

**Purpose:** Manages selective disclosure by zeroing out hashes of undisclosed fields while preserving hashes of disclosed fields.

### 3. Main ApplicationZKP Template

![Main ApplicationZKP Template](diagrams/Main%20ApplicationZKP.png)

**Circuit Code:**
```circom
template ApplicationZKP(nFields) {
    // ---------- Public Inputs ----------
    signal input merkleRoot;        // Merkle root stored on-chain
    signal input applicationType;   // Type identifier (e.g., 1=BIRTH, 2=DEATH)

    // ---------- Private Inputs ----------
    signal input fields[nFields];    // Private field values
    signal input disclosed[nFields]; // Disclosure flags (1 or 0)

    // ---------- Hash Each Field ----------
    signal fieldHashes[nFields];
    component leaf[nFields];  // ✅ Declare components statically
    for (var i = 0; i < nFields; i++) {
        leaf[i] = DisclosureLeaf();
        leaf[i].fieldValue <== fields[i];
        leaf[i].disclosed <== disclosed[i];
        fieldHashes[i] <== leaf[i].hash;
    }

    // ---------- Aggregate Into Root ----------
    component rootHasher = Poseidon(nFields);
    for (var i = 0; i < nFields; i++) {
        rootHasher.inputs[i] <== fieldHashes[i];
    }

    // ---------- Enforce Equality ----------
    rootHasher.out === merkleRoot;
}
```

## 📊 Signal Definitions

![Signal Definations](diagrams/Signal%20Definatation.png)

## 🔐 Cryptographic Security

### Poseidon Hash Benefits
```circom
include "poseidon.circom";

// Poseidon is ZKP-friendly because:
// - Minimal constraints in arithmetic circuits
// - Optimized for finite fields used in SNARKs
// - Resistance to side-channel attacks
// - Efficient in circuit operations
```

### Selective Disclosure Mechanism
```circom
// For each field:
hash <== disclosed * f.out;

// This means:
// - If disclosed = 1: hash = actual_field_hash
// - If disclosed = 0: hash = 0 (no information leaked)
// - The Merkle root changes based on disclosure pattern
// - Same private data can generate multiple valid roots
```

## 💡 Usage Examples

### Circuit Input Generation

```javascript
// Example: Birth Certificate with selective disclosure
const circuitInputs = {
    // Public inputs (known to verifier)
    merkleRoot: "192873918273918273918273981273981", // Expected root
    applicationType: 1, // 1 = Birth certificate
    
    // Private inputs (known only to prover)
    fields: [
        toBigInt("Aarav Kumar"),    // childName
        toBigInt(1684123200000),    // dateOfBirth (timestamp)
        toBigInt("Male"),           // gender
        toBigInt("Rajesh Kumar")    // fatherName
    ],
    disclosed: [
        1, // childName - disclosed
        1, // dateOfBirth - disclosed  
        0, // gender - hidden
        0  // fatherName - hidden
    ]
};
```

### Different Disclosure Patterns

```javascript
// Pattern 1: Full disclosure
const fullDisclosure = {
    fields: [nameHash, dobHash, genderHash, fatherHash],
    disclosed: [1, 1, 1, 1]
};

// Pattern 2: Name only disclosure  
const nameOnly = {
    fields: [nameHash, dobHash, genderHash, fatherHash],
    disclosed: [1, 0, 0, 0]
};

// Pattern 3: Age verification (name + DOB)
const ageVerification = {
    fields: [nameHash, dobHash, genderHash, fatherHash],
    disclosed: [1, 1, 0, 0]
};
```

### Application Type Mapping
```javascript
const APPLICATION_TYPES = {
    BIRTH: 1,          // Birth certificate applications
    DEATH: 2,          // Death certificate applications
    TRADE_LICENSE: 3,  // Business license applications  
    NOC: 4             // No Objection Certificate applications
};
```

## 🛡️ Security Considerations

### Circuit Constraints
```circom
// The main security constraint:
rootHasher.out === merkleRoot;

// This ensures:
// 1. Prover knows the original field values that hash to the committed root
// 2. Disclosure pattern matches the expected Merkle root
// 3. Application type is consistent with the proof context
```

### Input Validation
```javascript
// Pre-circuit input validation
function validateCircuitInputs(inputs) {
    // Check array lengths
    if (inputs.fields.length !== 4) throw new Error("Must provide exactly 4 fields");
    if (inputs.disclosed.length !== 4) throw new Error("Must provide exactly 4 disclosure flags");
    
    // Validate disclosure flags are 0 or 1
    inputs.disclosed.forEach(flag => {
        if (flag !== 0 && flag !== 1) throw new Error("Disclosure flags must be 0 or 1");
    });
    
    // Validate application type range
    if (inputs.applicationType < 1 || inputs.applicationType > 4) {
        throw new Error("Application type must be between 1 and 4");
    }
}
```

## 📈 Performance Characteristics

### Constraint Count

![Constraint Count](diagrams/Constraint%20Count.png)

### Memory Usage
- **Fixed component allocation**: Prevents dynamic memory issues
- **Predictable sizing**: 4 fields ensure consistent performance
- **Efficient hashing**: Poseidon optimized for circuit constraints

## 🔧 Compilation & Setup

### Circuit Compilation
```bash
# Compile circuit
circom ApplicationZKP.circom --r1cs --wasm --sym

# Perform trusted setup
snarkjs groth16 setup ApplicationZKP.r1cs pot12_final.ptau ApplicationZKP.zkey

# Export verification key
snarkjs zkey export verificationkey ApplicationZKP.zkey verification_key.json
```

### File Structure
```
circuits/
├── ApplicationZKP.circom          # Main circuit file
├── poseidon.circom               # Hash function dependency
├── build/
│   ├── ApplicationZKP.r1cs       # Rank-1 Constraint System
│   ├── ApplicationZKP.wasm       # WebAssembly circuit
│   └── ApplicationZKP.zkey       # Proving key
└── setup/
    └── verification_key.json     # Verification key
```

## 💎 Circuit Properties

### Completeness
- ✅ **For valid inputs**: Always generates valid proofs
- ✅ **Deterministic**: Same inputs → same Merkle root
- ✅ **Consistent**: Multiple disclosure patterns supported

### Soundness  
- ✅ **Cryptographic security**: Based on Poseidon hash security
- ✅ **Binding**: Cannot find collisions for Merkle root
- ✅ **Zero-knowledge**: Reveals only disclosed information

### Practicality
- ✅ **Fixed size**: Predictable performance for 4 fields
- ✅ **Standardized**: Compatible with common ZKP backends
- ✅ **Auditable**: Clear, minimal circuit logic

---

**Author**: Ishan Gawande  
**Version**: 2.0.0  
**Circom Version**: 2.0.0+  
**License**: MIT  
**Security**: Zero-knowledge proofs with selective disclosure  
**Compatibility**: SnarkJS, Circomlib, Poseidon hash