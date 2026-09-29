const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadAndAnalyze,
  getCalls,
  getCall,
  deleteCall
} = require('../controllers/callController');

const router = express.Router();

router.use(protect);

router.post('/', upload.single('audio'), uploadAndAnalyze);
router.get('/', getCalls);
router.get('/:id', getCall);
router.delete('/:id', deleteCall);

module.exports = router;
