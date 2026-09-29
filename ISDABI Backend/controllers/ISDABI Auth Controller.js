const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/ISDABI User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createToken = (id) =>
  jwt.sign(
    { id: id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt
});

const validRole = (role) =>
  ["analyst", "sales_representative"].includes(String(role || "").trim());

exports.register = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "").trim();

    if (!name || !email || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Name, valid email and password of at least 8 characters are required."
      });
    }

    if (!validRole(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role."
      });
    }

    if (email === "isdabiheadanalyst@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "This account is reserved for the ISDABI Head Analyst."
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      authProvider: "local",
      isActive: true
    });

    return res.status(201).json({
      success: true,
      token: createToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error("[register]", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email });

    if (
      !user ||
      !user.isActive ||
      user.authProvider !== "local" ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials."
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      success: true,
      token: createToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error("[login]", error);
    return res.status(500).json({
      success: false,
      message: "Login failed."
    });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const credential = String(req.body.credential || "").trim();
    const requestedRole = String(req.body.role || "").trim();

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required."
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured."
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Google account information could not be verified."
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google email verification is required."
      });
    }

    const email = String(payload.email).trim().toLowerCase();
    const googleId = String(payload.sub);
    const name = String(payload.name || email.split("@")[0]).trim();

    if (email === "isdabiheadanalyst@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "This account is reserved for the ISDABI Head Analyst."
      });
    }

    let user = await User.findOne({
      $or: [
        { googleId },
        { email }
      ]
    });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "This account is inactive."
        });
      }

      if (user.authProvider === "local") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists. Please sign in with your email and password."
        });
      }

      if (!user.googleId) {
        user.googleId = googleId;
      }

      user.lastLoginAt = new Date();
      await user.save();

      return res.json({
        success: true,
        existingUser: true,
        token: createToken(user._id),
        user: publicUser(user)
      });
    }

    if (!validRole(requestedRole)) {
      return res.json({
        success: true,
        requiresRole: true,
        googleUser: {
          name,
          email,
          googleId
        }
      });
    }

    user = await User.create({
      name,
      email,
      googleId,
      role: requestedRole,
      authProvider: "google",
      isActive: true,
      lastLoginAt: new Date()
    });

    return res.status(201).json({
      success: true,
      existingUser: false,
      token: createToken(user._id),
      user: publicUser(user)
    });
  } catch (error) {
    console.error("[googleLogin]", error);
    return res.status(401).json({
      success: false,
      message: "Google authentication failed."
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    if (user.email === "isdabiheadanalyst@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "The ISDABI Head Analyst account cannot be deleted."
      });
    }

    await User.findByIdAndDelete(user._id);

    return res.json({
      success: true,
      message: "Your ISDABI account has been permanently deleted."
    });
  } catch (error) {
    console.error("[deleteAccount]", error);
    return res.status(500).json({
      success: false,
      message: "Account deletion failed."
    });
  }
};

exports.me = async (req, res) =>
  res.json({
    success: true,
    user: publicUser(req.user)
  });
