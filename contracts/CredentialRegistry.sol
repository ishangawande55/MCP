// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title CredentialRegistry
/// @notice Anchors credential hashes + IPFS CIDs + ZKP Merkle roots with DID-aware metadata, issuance, revocation, and verification helpers.
/// @dev Extends existing OpenZeppelin AccessControl + Pausable + ReentrancyGuard safety.
///      CredentialId is supplied as string, internally keyed by keccak256 for gas efficiency.
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CredentialRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @dev Status codes used by verifyCertificate()
    uint8 public constant STATUS_VALID = 0;
    uint8 public constant STATUS_NOT_FOUND = 1;
    uint8 public constant STATUS_REVOKED = 2;
    uint8 public constant STATUS_EXPIRED = 3;
    uint8 public constant STATUS_HASH_MISMATCH = 4;

    /// @notice Struct to store credential metadata
    struct Credential {
        bytes32 credentialHash;   // SHA-256 hash of canonical credential bytes
        string ipfsCID;           // IPFS CID (or other content-address)
        bytes32 merkleRoot;       // Merkle root from ZKP selective disclosure
        address issuerAddress;    // on-chain account who issued (municipal commissioner)
        string issuerDID;         // issuer DID 
        string holderDID;         // holder DID 
        uint256 timestamp;        // issuance block timestamp
        uint256 expiry;           // expiry timestamp, 0 = never expires
        bool revoked;             // revocation flag
        string revokedReason;     // optional human-readable revocation reason
        uint256 revokedAt;        // timestamp of revocation
        bool exists;              // sentinel to check existence
        string schema;            // optional credential schema/type (e.g., "TradeLicenseCredential")
    }

    /// @dev internal mapping keyed by keccak256(bytes(credentialId))
    mapping(bytes32 => Credential) private credentials;

    /// Events
    event CredentialIssued(
        string indexed credentialId,
        bytes32 indexed idHash,
        address indexed issuerAddress,
        string issuerDID,
        string holderDID,
        string ipfsCID,
        bytes32 merkleRoot,
        uint256 timestamp,
        uint256 expiry,
        string schema
    );

    event CredentialRevoked(
        string indexed credentialId,
        bytes32 indexed idHash,
        address indexed revoker,
        string reason,
        uint256 revokedAt
    );

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    /// @param admin initial admin (DEFAULT_ADMIN_ROLE), typically deployer
    constructor(address admin) {
        // set up roles
        _setupRole(DEFAULT_ADMIN_ROLE, admin == address(0) ? msg.sender : admin);
        _setupRole(ISSUER_ROLE, admin == address(0) ? msg.sender : admin);
        _setupRole(PAUSER_ROLE, admin == address(0) ? msg.sender : admin);
    }

    /**
     * @notice Issue a new credential with optional ZKP Merkle root
     * @dev Only accounts with ISSUER_ROLE can call this.
     * @param _credentialId Human-readable ID (e.g., "vc:trade-license:0001")
     * @param _credentialHash SHA-256 hash of canonical credential bytes
     * @param _ipfsCID IPFS CID where full VC/ PDF is stored
     * @param _merkleRoot Merkle root from selective disclosure (bytes32)
     * @param _issuerDID DID string of issuer (e.g., did:mcp:comm001)
     * @param _holderDID DID string of holder (e.g., did:mcp:ishan123)
     * @param _expiry expiry timestamp (0 = never)
     * @param _schema optional schema/type string
     */
    function issueCertificate(
        string calldata _credentialId,
        bytes32 _credentialHash,
        string calldata _ipfsCID,
        bytes32 _merkleRoot,
        string calldata _issuerDID,
        string calldata _holderDID,
        uint256 _expiry,
        string calldata _schema
    ) external whenNotPaused nonReentrant onlyRole(ISSUER_ROLE) {
        bytes32 idHash = keccak256(bytes(_credentialId));
        require(!credentials[idHash].exists, "Credential ID already exists");

        credentials[idHash] = Credential({
            credentialHash: _credentialHash,
            ipfsCID: _ipfsCID,
            merkleRoot: _merkleRoot,
            issuerAddress: msg.sender,
            issuerDID: _issuerDID,
            holderDID: _holderDID,
            timestamp: block.timestamp,
            expiry: _expiry,
            revoked: false,
            revokedReason: "",
            revokedAt: 0,
            exists: true,
            schema: _schema
        });

        emit CredentialIssued(
            _credentialId,
            idHash,
            msg.sender,
            _issuerDID,
            _holderDID,
            _ipfsCID,
            _merkleRoot,
            block.timestamp,
            _expiry,
            _schema
        );
    }

    /**
     * @notice Revoke an existing credential
     * @dev Only accounts with ISSUER_ROLE may revoke. Revocation metadata stored.
     */
    function revokeCertificate(string calldata _credentialId, string calldata _reason)
        external
        whenNotPaused
        nonReentrant
        onlyRole(ISSUER_ROLE)
    {
        bytes32 idHash = keccak256(bytes(_credentialId));
        require(credentials[idHash].exists, "Credential does not exist");
        require(!credentials[idHash].revoked, "Credential already revoked");

        credentials[idHash].revoked = true;
        credentials[idHash].revokedReason = _reason;
        credentials[idHash].revokedAt = block.timestamp;

        emit CredentialRevoked(_credentialId, idHash, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice Verify credential integrity and status, returns status code
     * @param _credentialId human credential id
     * @param _documentHash SHA-256 hash (bytes32) provided by verifier (canonicalized credential bytes)
     * @return isValid true when credential is valid + hash matches
     * @return statusCode one of STATUS_* constants (0 = valid)
     */
    function verifyCertificate(string calldata _credentialId, bytes32 _documentHash)
        external
        view
        returns (bool isValid, uint8 statusCode)
    {
        bytes32 idHash = keccak256(bytes(_credentialId));
        Credential memory cred = credentials[idHash];

        if (!cred.exists) {
            return (false, STATUS_NOT_FOUND);
        }

        if (cred.revoked) {
            return (false, STATUS_REVOKED);
        }

        if (cred.expiry > 0 && block.timestamp > cred.expiry) {
            return (false, STATUS_EXPIRED);
        }

        if (cred.credentialHash != _documentHash) {
            return (false, STATUS_HASH_MISMATCH);
        }

        return (true, STATUS_VALID);
    }

    /**
     * @notice Get full credential metadata including ZKP Merkle root
     */
    function getCertificate(string calldata _credentialId)
        external
        view
        returns (
            bytes32 credentialHash,
            string memory ipfsCID,
            bytes32 merkleRoot,
            address issuerAddress,
            string memory issuerDID,
            string memory holderDID,
            uint256 timestamp,
            uint256 expiry,
            bool revoked,
            string memory revokedReason,
            uint256 revokedAt,
            string memory schema
        )
    {
        bytes32 idHash = keccak256(bytes(_credentialId));
        Credential memory cred = credentials[idHash];
        require(cred.exists, "Credential does not exist");

        return (
            cred.credentialHash,
            cred.ipfsCID,
            cred.merkleRoot,
            cred.issuerAddress,
            cred.issuerDID,
            cred.holderDID,
            cred.timestamp,
            cred.expiry,
            cred.revoked,
            cred.revokedReason,
            cred.revokedAt,
            cred.schema
        );
    }

    /* ---------------------------
     * Management: Issuers & Pausing
     * --------------------------- */

    function addIssuer(address _issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ISSUER_ROLE, _issuer);
        emit IssuerAdded(_issuer);
    }

    function removeIssuer(address _issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ISSUER_ROLE, _issuer);
        emit IssuerRemoved(_issuer);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /* ---------------------------
     * Batch helpers
     * --------------------------- */

    function batchIssue(
        string[] calldata _credentialIds,
        bytes32[] calldata _credentialHashes,
        string[] calldata _ipfsCIDs,
        bytes32[] calldata _merkleRoots,
        string[] calldata _issuerDIDs,
        string[] calldata _holderDIDs,
        uint256[] calldata _expiries,
        string[] calldata _schemas
    ) external whenNotPaused nonReentrant onlyRole(ISSUER_ROLE) {
        uint256 len = _credentialIds.length;
        require(
            len == _credentialHashes.length &&
            len == _ipfsCIDs.length &&
            len == _merkleRoots.length &&
            len == _issuerDIDs.length &&
            len == _holderDIDs.length &&
            len == _expiries.length &&
            len == _schemas.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < len; i++) {
            bytes32 idHash = keccak256(bytes(_credentialIds[i]));
            require(!credentials[idHash].exists, "Credential ID already exists");
            credentials[idHash] = Credential({
                credentialHash: _credentialHashes[i],
                ipfsCID: _ipfsCIDs[i],
                merkleRoot: _merkleRoots[i],
                issuerAddress: msg.sender,
                issuerDID: _issuerDIDs[i],
                holderDID: _holderDIDs[i],
                timestamp: block.timestamp,
                expiry: _expiries[i],
                revoked: false,
                revokedReason: "",
                revokedAt: 0,
                exists: true,
                schema: _schemas[i]
            });

            emit CredentialIssued(
                _credentialIds[i],
                idHash,
                msg.sender,
                _issuerDIDs[i],
                _holderDIDs[i],
                _ipfsCIDs[i],
                _merkleRoots[i],
                block.timestamp,
                _expiries[i],
                _schemas[i]
            );
        }
    }

    function batchRevoke(string[] calldata _credentialIds, string[] calldata _reasons)
        external
        whenNotPaused
        nonReentrant
        onlyRole(ISSUER_ROLE)
    {
        require(_credentialIds.length == _reasons.length, "Array length mismatch");
        for (uint256 i = 0; i < _credentialIds.length; i++) {
            bytes32 idHash = keccak256(bytes(_credentialIds[i]));
            require(credentials[idHash].exists, "Credential does not exist");
            require(!credentials[idHash].revoked, "Already revoked");

            credentials[idHash].revoked = true;
            credentials[idHash].revokedReason = _reasons[i];
            credentials[idHash].revokedAt = block.timestamp;

            emit CredentialRevoked(_credentialIds[i], idHash, msg.sender, _reasons[i], block.timestamp);
        }
    }

    /// @notice Returns stored credential hash for an idHash
    function getCredentialHashByIdHash(bytes32 idHash) external view returns (bytes32) {
        require(credentials[idHash].exists, "Credential does not exist");
        return credentials[idHash].credentialHash;
    }
}