const express = require("express");
const auth = require("../middleware/auth");
const { requireRole, requireOfficer } = require("../middleware/roleCheck");

const router = express.Router();

const { createApplication } = require("../controllers/application/createApplicationController");
const { getAllApplications } = require("../controllers/application/getApplicationsController");
const { getApplicationById } = require("../controllers/application/getApplicationByIdController");
const { assignApplication } = require("../controllers/application/assignApplicationController");
const { getDashboardStats } = require("../controllers/application/dashboardStatsController");
const { processApplication } = require('../controllers/application/commissionerApplicationController');

// =========================
// Routes
// =========================

// -------------------------
// Dashboard statistics (OFFICER or COMMISSIONER)
router.get(
  "/stats/dashboard",
  auth,
  requireRole('OFFICER', 'COMMISSIONER'),
  getDashboardStats
);

// -------------------------
// Citizen: Create new application (APPLICANT only)
router.post(
  "/",
  auth,
  requireRole('APPLICANT'),
  createApplication
);

// -------------------------
// Officer: Get all applications
router.get(
  "/",
  auth,
  requireOfficer, // OFFICER / ADMIN / COMMISSIONER
  getAllApplications
);

// -------------------------
// Officer: Get single application
router.get(
  "/:id",
  auth,
  requireOfficer,
  getApplicationById
);

// -------------------------
// Officer: Assign application to commissioner
router.put(
  "/:id/assign",
  auth,
  requireOfficer,
  assignApplication
);

// -------------------------
// Commissioner: Approve/Reject application
router.put(
  "/:id/process",
  auth,
  requireRole('COMMISSIONER'),
  processApplication
);

module.exports = router;