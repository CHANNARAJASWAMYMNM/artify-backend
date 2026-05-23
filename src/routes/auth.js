const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const SellerProfile = require('../models/sellerProfile');
const { protect } = require('../middleware/authMiddleware');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'artify_secret_key_earthy_colors_2026', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { email, password, role, shopName, location, craftType, story } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      role: role || 'customer',
      isVerified: false,
    });

    let sellerProfile = null;

    // If role is seller, create profile
    if (user.role === 'seller') {
      if (!shopName || !location || !craftType || !story) {
        // Delete user if seller details are missing to keep DB clean
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({
          success: false,
          message: 'Sellers must provide shopName, location, craftType, and story',
        });
      }

      sellerProfile = await SellerProfile.create({
        user: user._id,
        shopName,
        location,
        craftType,
        story,
        isApproved: false, // Must be approved by admin
      });
    }

    // Auto-create initial admin user if the registered email contains "admin@artify.com"
    if (email === 'admin@artify.com') {
      user.role = 'admin';
      user.isVerified = true;
      await user.save();
    }

    res.status(201).json({
      success: true,
      token: signToken(user._id),
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      sellerProfile,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    let sellerProfile = null;
    if (user.role === 'seller') {
      sellerProfile = await SellerProfile.findOne({ user: user._id });
    }

    res.json({
      success: true,
      token: signToken(user._id),
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      sellerProfile,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let sellerProfile = null;
    if (req.user.role === 'seller') {
      sellerProfile = await SellerProfile.findOne({ user: req.user._id });
    }

    res.json({
      success: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        isVerified: req.user.isVerified,
      },
      sellerProfile,
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
});

// @desc    Verify user email (mock action)
// @route   POST /api/auth/verify-email
// @access  Private
router.post('/verify-email', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isVerified = true;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Verify Email Error:', error);
    res.status(500).json({ success: false, message: 'Server error during email verification' });
  }
});

module.exports = router;
