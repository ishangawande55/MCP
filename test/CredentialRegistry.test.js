const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry", function () {
  let registry;
  let owner, issuer, verifier;

  beforeEach(async function () {
    [owner, issuer, verifier] = await ethers.getSigners();

    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy();
    await registry.deployed();
    registry = await CredentialRegistry.deploy();

    // Add issuer as authorized
    await registry.addIssuer(issuer.address);
  });

  it("Should deploy with owner as authorized issuer", async function () {
    expect(await registry.authorizedIssuers(owner.address)).to.be.true;
  });

  it("Should issue a new credential", async function () {
    const credentialId = "BIRTH-2024-001";
    const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("document-content"));
    const ipfsCID = "QmXyz123...";
    const expiry = 0;

    await registry.connect(issuer).issueCertificate(credentialId, credentialHash, ipfsCID, expiry);

    const cred = await registry.getCertificate(credentialId);
    expect(cred.ipfsCID).to.equal(ipfsCID);
    expect(cred.issuer).to.equal(issuer.address);
  });

  it("Should verify a valid credential", async function () {
    const credentialId = "TRADE-2024-001";
    const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("trade-license-content"));
    const ipfsCID = "QmAbc456...";

    await registry.connect(issuer).issueCertificate(credentialId, credentialHash, ipfsCID, 0);

    const isValid = await registry.verifyCertificate(credentialId, credentialHash);
    expect(isValid).to.be.true;
  });

  it("Should detect tampered document", async function () {
    const credentialId = "DEATH-2024-001";
    const originalHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("original-content"));
    const tamperedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("tampered-content"));

    await registry.connect(issuer).issueCertificate(credentialId, originalHash, "QmXyz789...", 0);

    const isValid = await registry.verifyCertificate(credentialId, tamperedHash);
    expect(isValid).to.be.false;
  });
});