/**
 * @file ZKPService.js
 * @author
 * Ishan Rajeshwar Gawande
 * @description
 * -----------------------------------------------------------------------------
 * Zero-Knowledge Proof (ZKP) Service Layer
 * -----------------------------------------------------------------------------
 * Responsibilities:
 *  - Witness generation for ApplicationZKP circuit
 *  - Proof generation using Groth16 protocol
 *  - Verification key management
 *  - Safe BigInt conversion for heterogeneous data types
 *  - Selective disclosure commitment computation via Poseidon hashing
 *
 * Circuit Assets:
 *   - WASM File:        backend/zkp/build/ApplicationZKP/ApplicationZKP_js/ApplicationZKP.wasm
 *   - ZKey File:        backend/zkp/build/ApplicationZKP/ApplicationZKP.zkey
 *   - Verification Key: backend/zkp/setup/verification_key.json
 */

const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");

class ZKPService {
    constructor() {
        // -----------------------------
        // Circuit asset paths
        // -----------------------------
        this.wasmFile = path.resolve(
            __dirname,
            "../zkp/build/ApplicationZKP/ApplicationZKP_js/ApplicationZKP.wasm"
        );
        this.zkeyFile = path.resolve(
            __dirname,
            "../zkp/build/ApplicationZKP/ApplicationZKP.zkey"
        );
        this.verificationKeyFile = path.resolve(
            __dirname,
            "../zkp/setup/verification_key.json"
        );

        // Circuit configuration
        this.nFields = 4; // Must match ApplicationZKP.circom
    }

    /**
     * Safely converts input to BigInt
     */
    toBigInt(value) {
        if (value === undefined || value === null) return BigInt(0);
        if (typeof value === "bigint") return value;
        if (typeof value === "number" && !isNaN(value)) return BigInt(value);
        if (value instanceof Date) return BigInt(value.getTime());
        if (typeof value === "string" && value.trim() !== "") {
            try {
                return BigInt("0x" + Buffer.from(value, "utf8").toString("hex"));
            } catch {
                return BigInt(0);
            }
        }
        return BigInt(0);
    }

    /**
     * Maps application type string to numeric ID
     */
    _getApplicationTypeId(type) {
        switch (type?.toUpperCase()) {
            case "BIRTH": return 1;
            case "DEATH": return 2;
            case "TRADE_LICENSE": return 3;
            case "NOC": return 4;
            default: return 0;
        }
    }

    /**
     * Generate ZKP proof from raw application data
     * Handles selective disclosure and ensures nFields alignment
     * @param {Object} applicationData - Full application record
     */
    async generateProofFromApplication(applicationData) {
        try {
            // -----------------------------
            // Validate circuit files
            // -----------------------------
            if (!fs.existsSync(this.wasmFile)) throw new Error(`WASM file not found: ${this.wasmFile}`);
            if (!fs.existsSync(this.zkeyFile)) throw new Error(`ZKey file not found: ${this.zkeyFile}`);

            // -----------------------------
            // Determine field order
            // -----------------------------
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

            const disclosedFields = applicationData.disclosedFields || [];
            const inputFields = [];
            const disclosedFlags = [];

            for (let i = 0; i < this.nFields; i++) {
                const fieldName = fieldOrder[i];
                const value = details[fieldName] !== undefined ? details[fieldName] : 0;
                inputFields.push(this.toBigInt(value));
                disclosedFlags.push(disclosedFields.includes(fieldName) ? BigInt(1) : BigInt(0));
            }

            // -----------------------------
            // Compute leaf hashes and root (matches Circom)
            // -----------------------------
            const poseidon = await circomlibjs.buildPoseidon();
            const F = poseidon.F;

            // Leaf hashes
            const leafHashes = [];
            for (let i = 0; i < inputFields.length; i++) {
                const leafVal = disclosedFlags[i] === BigInt(1) ? inputFields[i] : BigInt(0);
                const leafHash = leafVal === BigInt(0) ? BigInt(0) : F.toObject(poseidon([leafVal]));
                leafHashes.push(leafHash);
            }

            // Root hash
            const rootHasher = F.toObject(poseidon(leafHashes));

            const circuitInput = {
                fields: inputFields,
                disclosed: disclosedFlags,
                applicationType: BigInt(this._getApplicationTypeId(applicationData.type)),
                merkleRoot: BigInt(rootHasher),
            };

            // -----------------------------
            // Generate proof using snarkjs
            // -----------------------------
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

    /**
     * Verify proof against stored verification key
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
}

module.exports = new ZKPService();