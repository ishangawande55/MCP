const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Verify Certificate", function () {
  let registry, owner, issuer;

  beforeEach(async function () {
    [owner, issuer] = await ethers.getSigners();
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();
    await registry.addIssuer(issuer.address);

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

  it("Should return valid for correct hash", async function () {
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("doc"));
    const [isValid, status] = await registry.verifyCertificate("vc:0001", hash);
    expect(isValid).to.be.true;
    expect(status).to.equal(0); // STATUS_VALID
  });

  it("Should return hash mismatch for wrong document", async function () {
    const wrongHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wrong"));
    const [isValid, status] = await registry.verifyCertificate("vc:0001", wrongHash);
    expect(isValid).to.be.false;
    expect(status).to.equal(4); // STATUS_HASH_MISMATCH
  });
});