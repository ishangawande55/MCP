const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Deployment & Roles", function () {
  let CredentialRegistry, registry, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();
  });

  it("Should assign DEFAULT_ADMIN_ROLE, ISSUER_ROLE, PAUSER_ROLE to deployer/admin", async function () {
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
    const ISSUER_ROLE = await registry.ISSUER_ROLE();
    const PAUSER_ROLE = await registry.PAUSER_ROLE();

    expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    expect(await registry.hasRole(ISSUER_ROLE, owner.address)).to.be.true;
    expect(await registry.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
  });

  it("Should allow admin to add and remove issuer", async function () {
    await registry.addIssuer(addr1.address);
    const ISSUER_ROLE = await registry.ISSUER_ROLE();
    expect(await registry.hasRole(ISSUER_ROLE, addr1.address)).to.be.true;

    await registry.removeIssuer(addr1.address);
    expect(await registry.hasRole(ISSUER_ROLE, addr1.address)).to.be.false;
  });
});