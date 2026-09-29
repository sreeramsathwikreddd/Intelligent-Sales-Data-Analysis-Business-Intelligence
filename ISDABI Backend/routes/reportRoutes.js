const express = require('express');
const { protect } = require('../middleware/auth');
const { getReports, getReport } = require('../controllers/reportController');

const router = express.Router();
router.use(protect);
router.get('/', getReports);
router.get('/:id', getReport);

module.exports = router;
