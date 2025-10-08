const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Issue Certificate", function () {
  let registry, owner, issuer;

  beforeEach(async function () {
    [owner, issuer] = await ethers.getSigners();
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();

    await registry.addIssuer(issuer.address);
  });

  it("Should allow ISSUER_ROLE to issue a credential", async function () {
    const credentialId = "vc:trade-license:0001";
    const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("my-document"));
    const ipfsCID = "QmTestCID";
    const issuerDID = "did:mcp:comm001";
    const holderDID = "did:mcp:user001";
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const schema = "TradeLicenseCredential";

    await registry.connect(issuer).issueCertificate(
      credentialId,
      credentialHash,
      ipfsCID,
      issuerDID,
      holderDID,
      expiry,
      schema
    );

    const stored = await registry.getCertificate(credentialId);
    expect(stored.credentialHash).to.equal(credentialHash);
    expect(stored.ipfsCID).to.equal(ipfsCID);
    expect(stored.issuerDID).to.equal(issuerDID);
    expect(stored.holderDID).to.equal(holderDID);
  });

  it("Should not allow non-issuer to issue", async function () {
    const credentialId = "vc:trade-license:0002";
    await expect(
      registry.connect(owner).issueCertificate(
        credentialId,
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("doc")),
        "QmCID",
        "did:mcp:comm001",
        "did:mcp:user002",
        0,
        "TestSchema"
      )
    ).to.be.revertedWith("AccessControl: account");
  });
});