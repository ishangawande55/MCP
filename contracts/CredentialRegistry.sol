// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CredentialRegistry
 * @dev Blockchain anchoring for municipal credentials
 * - Stores hash + IPFS CID for tamper-proof verification
 * - Supports issuance, revocation, verification
 */
contract CredentialRegistry {
    
    // Struct to store credential metadata
    struct Credential {
        bytes32 credentialHash;  // SHA-256 hash of the document
        string ipfsCID;          // IPFS Content Identifier
        address issuer;          // Municipal officer who issued
        uint256 timestamp;       // Block timestamp of issuance
        uint256 expiry;          // 0 = never expires
        bool revoked;            // Revocation status
    }
    
    // Mapping from credentialID => Credential
    mapping(string => Credential) public credentials;
    
    // Role management: authorized issuers (municipal officers)
    mapping(address => bool) public authorizedIssuers;
    
    // Events for transparency
    event CredentialIssued(
        string indexed credentialId,
        address indexed issuer,
        string ipfsCID,
        uint256 timestamp
    );
    
    event CredentialRevoked(string indexed credentialId, address indexed revoker);
    
    // Modifier: Only authorized municipal officers
    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized to issue credentials");
        _;
    }
    
    // Constructor: Deployer becomes first authorized issuer
    constructor() {
        authorizedIssuers[msg.sender] = true;
    }
    
    /**
     * @dev Issue a new credential (called by municipal officer)
     * @param _credentialId Unique ID for the credential
     * @param _credentialHash SHA-256 hash of the document
     * @param _ipfsCID IPFS Content ID where document is stored
     * @param _expiry Expiry timestamp (0 for never)
     */
    function issueCertificate(
        string memory _credentialId,
        bytes32 _credentialHash,
        string memory _ipfsCID,
        uint256 _expiry
    ) public onlyIssuer {
        require(credentials[_credentialId].issuer == address(0), "Credential ID already exists");
        
        credentials[_credentialId] = Credential({
            credentialHash: _credentialHash,
            ipfsCID: _ipfsCID,
            issuer: msg.sender,
            timestamp: block.timestamp,
            expiry: _expiry,
            revoked: false
        });
        
        emit CredentialIssued(_credentialId, msg.sender, _ipfsCID, block.timestamp);
    }
    
    /**
     * @dev Revoke a credential (for expiry or legal reasons)
     * @param _credentialId ID of credential to revoke
     */
    function revokeCertificate(string memory _credentialId) public onlyIssuer {
        require(credentials[_credentialId].issuer != address(0), "Credential does not exist");
        require(!credentials[_credentialId].revoked, "Credential already revoked");
        
        credentials[_credentialId].revoked = true;
        
        emit CredentialRevoked(_credentialId, msg.sender);
    }
    
    /**
     * @dev Verify a credential's validity and integrity
     * @param _credentialId ID to verify
     * @param _documentHash Hash to compare against stored hash
     * @return isValid Whether credential is valid and untampered
     */
    function verifyCertificate(
        string memory _credentialId, 
        bytes32 _documentHash
    ) public view returns (bool isValid) {
        Credential memory cred = credentials[_credentialId];
        
        // Check if credential exists
        if (cred.issuer == address(0)) {
            return false;
        }
        
        // Check if revoked
        if (cred.revoked) {
            return false;
        }
        
        // Check if expired
        if (cred.expiry > 0 && block.timestamp > cred.expiry) {
            return false;
        }
        
        // Check hash integrity
        if (cred.credentialHash != _documentHash) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Get full credential details
     * @param _credentialId ID to lookup
     */
    function getCertificate(string memory _credentialId) public view returns (
        bytes32 credentialHash,
        string memory ipfsCID,
        address issuer,
        uint256 timestamp,
        uint256 expiry,
        bool revoked
    ) {
        Credential memory cred = credentials[_credentialId];
        require(cred.issuer != address(0), "Credential does not exist");
        
        return (
            cred.credentialHash,
            cred.ipfsCID,
            cred.issuer,
            cred.timestamp,
            cred.expiry,
            cred.revoked
        );
    }
    
    /**
     * @dev Add new authorized issuer (municipal officer)
     * @param _issuer Address to authorize
     */
    function addIssuer(address _issuer) public onlyIssuer {
        authorizedIssuers[_issuer] = true;
    }
    
    /**
     * @dev Remove authorized issuer
     * @param _issuer Address to deauthorize
     */
    function removeIssuer(address _issuer) public onlyIssuer {
        authorizedIssuers[_issuer] = false;
    }
}