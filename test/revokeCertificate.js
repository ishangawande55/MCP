const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Revoke Certificate", function () {
  let registry, owner, issuer;

  beforeEach(async function () {
    [owner, issuer] = await ethers.getSigners();
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();
    await registry.addIssuer(issuer.address);

    // Issue a credential first
    await registry.connect(issuer).issueCertificate(
      "vc:0001",
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("doc")),
      "QmCID",
      "did:mcp:comm001",
      "did:mcp:user001",
      0,
      "TestSchema"
    );
  });

  it("Should allow issuer to revoke credential", async function () {
    await registry.connect(issuer).revokeCertificate("vc:0001", "Violation");

    const stored = await registry.getCertificate("vc:0001");
    expect(stored.revoked).to.be.true;
    expect(stored.revokedReason).to.equal("Violation");
  });

  it("Should not allow non-issuer to revoke", async function () {
    await expect(
      registry.connect(owner).revokeCertificate("vc:0001", "Reason")
    ).to.be.revertedWith("AccessControl: account");
  });
});