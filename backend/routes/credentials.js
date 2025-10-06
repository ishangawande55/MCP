const express = require("express");
const auth = require("../middleware/auth");
const { requireOfficer } = require("../middleware/roleCheck");

const {
  issueCredential,
} = require("../controllers/credentials/issueCredentialController");

const {
  downloadCredential,
} = require("../controllers/credentials/downloadCredentialController");

const {
  verifyCredential,
} = require("../controllers/credentials/verifyCredentialController");

const {
  getCredentialByQR,
} = require("../controllers/credentials/getCredentialByQRController");

const {
  getAllCredentials,
} = require("../controllers/credentials/getAllCredentialsController");

const {
  revokeCredential,
} = require("../controllers/credentials/revokeCredentialController");

const router = express.Router();

// Routes
router.post("/issue/:applicationId", auth, requireOfficer, issueCredential);
router.get("/download/:credentialId", downloadCredential);
router.post("/verify", verifyCredential);
router.get("/qr/:credentialId", getCredentialByQR);
router.get("/", auth, requireOfficer, getAllCredentials);
router.put("/revoke/:credentialId", auth, requireOfficer, revokeCredential);

module.exports = router;
