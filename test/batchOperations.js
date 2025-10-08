const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CredentialRegistry Batch Operations", function () {
  let registry, owner, issuer;

  beforeEach(async function () {
    [owner, issuer] = await ethers.getSigners();
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    registry = await CredentialRegistry.deploy(owner.address);
    await registry.deployed();
    await registry.addIssuer(issuer.address);
  });

  it("Should batch issue credentials", async function () {
    const ids = ["vc:001", "vc:002"];
    const hashes = ids.map(id => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(id)));
    const cids = ["QmCID1", "QmCID2"];
    const issuerDIDs = ["did:mcp:comm001","did:mcp:comm001"];
    const holderDIDs = ["did:mcp:user001","did:mcp:user002"];
    const expiries = [0, 0];
    const schemas = ["Schema1","Schema2"];

    await registry.connect(issuer).batchIssue(ids, hashes, cids, issuerDIDs, holderDIDs, expiries, schemas);

    const stored1 = await registry.getCertificate("vc:001");
    const stored2 = await registry.getCertificate("vc:002");

    expect(stored1.ipfsCID).to.equal("QmCID1");
    expect(stored2.ipfsCID).to.equal("QmCID2");
  });

  it("Should batch revoke credentials", async function () {
    const ids = ["vc:001","vc:002"];
    const hashes = ids.map(id => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(id)));
    const cids = ["QmCID1", "QmCID2"];
    const issuerDIDs = ["did:mcp:comm001","did:mcp:comm001"];
    const holderDIDs = ["did:mcp:user001","did:mcp:user002"];
    const expiries = [0,0];
    const schemas = ["Schema1","Schema2"];

    await registry.connect(issuer).batchIssue(ids, hashes, cids, issuerDIDs, holderDIDs, expiries, schemas);

    const reasons = ["Violation1","Violation2"];
    await registry.connect(issuer).batchRevoke(ids, reasons);

    const stored1 = await registry.getCertificate("vc:001");
    const stored2 = await registry.getCertificate("vc:002");

    expect(stored1.revoked).to.be.true;
    expect(stored2.revoked).to.be.true;
  });
});