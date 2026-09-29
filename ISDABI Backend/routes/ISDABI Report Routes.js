const express = require("express");
const {
  protect
} = require("../middleware/ISDABI Auth Middleware");

const {
  getReports,
  getRoleBasedReports,
  getReport
} = require("../controllers/ISDABI Report Controller");

const router = express.Router();

router.use(protect);

router.get(
  "/role-based",
  getRoleBasedReports
);

router.get(
  "/",
  getReports
);

router.get(
  "/:id",
  getReport
);

module.exports = router;