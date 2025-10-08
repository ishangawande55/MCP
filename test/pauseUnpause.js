const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Pausing", function () {
  let registry, owner, pauser, issuer;

  beforeEach(async function () {
    [owner, pauser, issuer] = await ethers.getSigners();
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();
    await registry.addIssuer(issuer.address);
    await registry.grantRole(await registry.PAUSER_ROLE(), pauser.address);
  });

  it("Should pause and prevent issuance", async function () {
    await registry.connect(pauser).pause();

    await expect(
      registry.connect(issuer).issueCertificate(
        "vc:001",
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("doc")),
        "QmCID",
        "did:mcp:comm001",
        "did:mcp:user001",
        0,
        "Schema"
      )
    ).to.be.revertedWith("Pausable: paused");

    await registry.connect(pauser).unpause();

    await registry.connect(issuer).issueCertificate(
      "vc:001",
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("doc")),
      "QmCID",
      "did:mcp:comm001",
      "did:mcp:user001",
      0,
      "Schema"
    );

    const stored = await registry.getCertificate("vc:001");
    expect(stored.exists).to.be.true;
  });
});