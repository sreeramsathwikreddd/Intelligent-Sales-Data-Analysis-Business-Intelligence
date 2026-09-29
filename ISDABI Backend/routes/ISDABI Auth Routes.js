const express = require("express");
const {
  register,
  login,
  googleLogin,
  deleteAccount,
  me
} = require("../controllers/ISDABI Auth Controller");
const { protect } = require("../middleware/ISDABI Auth Middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", protect, me);
router.delete("/account", protect, deleteAccount);

module.exports = router;
