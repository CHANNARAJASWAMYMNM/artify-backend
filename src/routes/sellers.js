const express = require('express');
const router = express.Router();
const SellerProfile = require('../models/sellerProfile');
const Product = require('../models/product');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get all approved seller profiles
// @route   GET /api/sellers
// @access  Public
router.get('/', async (req, res) => {
  try {
    const sellers = await SellerProfile.find({ isApproved: true }).populate('user');
    res.json({ success: true, sellers });
  } catch (error) {
    console.error('Fetch Sellers Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving sellers' });
  }
});

// @desc    Get seller profile by user ID or profile ID
// @route   GET /api/sellers/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    let seller = await SellerProfile.findById(req.params.id).populate('user');
    
    // Fallback: search by user ID
    if (!seller) {
      seller = await SellerProfile.findOne({ user: req.params.id }).populate('user');
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    res.json({ success: true, seller });
  } catch (error) {
    console.error('Fetch Seller Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving seller details' });
  }
});

// @desc    Get all products of a specific seller
// @route   GET /api/sellers/:id/products
// @access  Public
router.get('/:id/products', async (req, res) => {
  try {
    let sellerId = req.params.id;
    // Resolve user ID if seller profile ID was passed
    const profile = await SellerProfile.findById(sellerId);
    const userId = profile ? profile.user : sellerId;

    const products = await Product.find({ seller: userId });
    res.json({ success: true, products });
  } catch (error) {
    console.error('Fetch Seller Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving seller products' });
  }
});

// @desc    Update seller profile (for logged in seller)
// @route   PUT /api/sellers/profile
// @access  Private (Seller only)
router.put('/profile', protect, authorize('seller'), async (req, res) => {
  const { shopName, location, story, craftType, profileImage, bankDetails } = req.body;

  try {
    let profile = await SellerProfile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const updates = {};
    if (shopName) updates.shopName = shopName;
    if (location) updates.location = location;
    if (story) updates.story = story;
    if (craftType) updates.craftType = craftType;
    if (profileImage) updates.profileImage = profileImage;
    if (bankDetails) {
      updates.bankDetails = {
        ...profile.bankDetails,
        ...bankDetails
      };
    }

    const updatedProfile = await SellerProfile.findByIdAndUpdate(profile._id, { $set: updates }, { new: true });

    res.json({
      success: true,
      message: 'Seller profile updated successfully',
      sellerProfile: updatedProfile,
    });
  } catch (error) {
    console.error('Update Seller Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

module.exports = router;
