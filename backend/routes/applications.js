const express = require("express");
const auth = require("../middleware/auth");
const { requireOfficer } = require("../middleware/roleCheck");

const router = express.Router();

const { createApplication } = require("../controllers/application/createApplicationController");
const { getAllApplications } = require("../controllers/application/getApplicationsController");
const { getApplicationById } = require("../controllers/application/getApplicationByIdController");
const { assignApplication } = require("../controllers/application/assignApplicationController");
const { getDashboardStats } = require("../controllers/application/dashboardStatsController");
const { processApplication } = require('../controllers/application/commissionerApplicationController');

// Officer/Commissioner: Dashboard statistics
router.get("/stats/dashboard", auth, requireOfficer, getDashboardStats);

// Citizen: Create new application
router.post("/", createApplication);

// Officer: Get all applications
router.get("/", auth, requireOfficer, getAllApplications);

// Officer: Get single application
router.get("/:id", auth, requireOfficer, getApplicationById);

// Officer: Assign application
router.put("/:id/assign", auth, requireOfficer, assignApplication);

// Commissioner approves/rejects an application
router.put('/:id/process', auth,requireOfficer, processApplication);



module.exports = router;