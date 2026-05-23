const express = require('express');
const router = express.Router();
const User = require('../models/user');
const SellerProfile = require('../models/sellerProfile');
const Product = require('../models/product');
const Order = require('../models/order');
const Notification = require('../models/notification');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all pending seller profiles for approval
// @route   GET /api/admin/sellers/pending
// @access  Private (Admin only)
router.get('/sellers/pending', protect, authorize('admin'), async (req, res) => {
  try {
    const pendingSellers = await SellerProfile.find({ isApproved: false }).populate('user');
    res.json({ success: true, sellers: pendingSellers });
  } catch (error) {
    console.error('Fetch Pending Sellers Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving pending sellers' });
  }
});

// @desc    Approve or reject a seller profile
// @route   PUT /api/admin/sellers/:id/approve
// @access  Private (Admin only)
router.put('/sellers/:id/approve', protect, authorize('admin'), async (req, res) => {
  const { approve } = req.body; // Boolean: true to approve, false to reject/keep pending

  try {
    const profile = await SellerProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const updatedProfile = await SellerProfile.findByIdAndUpdate(profile._id, {
      $set: { isApproved: !!approve }
    }, { new: true });

    // Notify seller
    await Notification.create({
      user: profile.user,
      title: approve ? 'Seller Profile Approved!' : 'Seller Profile Suspended',
      message: approve 
        ? 'Congratulations! Your seller profile has been approved. You can now start uploading crafts.' 
        : 'Your seller profile is currently pending review or has been suspended. Contact support.',
      type: 'seller_approval',
    });

    res.json({
      success: true,
      message: approve ? 'Seller profile approved successfully' : 'Seller profile status updated',
      sellerProfile: updatedProfile,
    });
  } catch (error) {
    console.error('Approve Seller Error:', error);
    res.status(500).json({ success: false, message: 'Server error during seller approval' });
  }
});

// @desc    Get platform-wide analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
router.get('/analytics', protect, authorize('admin'), async (req, res) => {
  try {
    // 1. Core Counts
    const countUsers = await User.countDocuments();
    const countSellers = await User.countDocuments({ role: 'seller' });
    const countProducts = await Product.countDocuments();
    const countOrders = await Order.countDocuments();

    // 2. Financial metrics
    const orders = await Order.find();
    let totalRevenue = 0;
    let totalCommissions = 0;
    let totalPayouts = 0;

    orders.forEach(order => {
      if (order.paymentStatus === 'Paid') {
        totalRevenue += order.totalAmount;
        totalCommissions += order.commissionAmount;
        totalPayouts += order.sellerPayoutAmount;
      }
    });

    // 3. Recent Orders
    const recentOrders = await Order.find()
      .populate('customer')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      analytics: {
        counts: {
          users: countUsers,
          sellers: countSellers,
          products: countProducts,
          orders: countOrders
        },
        financials: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalCommissions: Number(totalCommissions.toFixed(2)),
          totalPayouts: Number(totalPayouts.toFixed(2))
        },
        recentOrders
      }
    });
  } catch (error) {
    console.error('Fetch Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving analytics' });
  }
});

// @desc    Get all users list
// @route   GET /api/admin/users
// @access  Private (Admin only)
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const uDoc = JSON.parse(JSON.stringify(user));
        delete uDoc.password; // Secure API

        if (user.role === 'seller') {
          const profile = await SellerProfile.findOne({ user: user._id });
          uDoc.sellerProfile = profile;
        }
        return uDoc;
      })
    );

    res.json({ success: true, users: usersWithProfiles });
  } catch (error) {
    console.error('Fetch Users List Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving users' });
  }
});

// @desc    Update a user's role (make admin, etc.)
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
router.put('/users/:id/role', protect, authorize('admin'), async (req, res) => {
  const { role } = req.body;

  if (!role || !['admin', 'seller', 'customer'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent demoting oneself
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    targetUser.role = role;
    await targetUser.save();

    // Create a notification for the updated user
    await Notification.create({
      user: targetUser._id,
      title: 'Role Updated',
      message: `Your platform role has been changed to: ${role.toUpperCase()}.`,
      type: 'general',
    });

    res.json({
      success: true,
      message: `User role successfully updated to ${role}`,
      user: {
        _id: targetUser._id,
        email: targetUser.email,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('Update Role Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating user role' });
  }
});

module.exports = router;
