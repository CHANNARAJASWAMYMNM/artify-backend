const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Review = require('../models/review');
const User = require('../models/user');
const SellerProfile = require('../models/sellerProfile');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Get products (with filters, search, pagination)
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, search, rating, seller } = req.query;
  const query = {};

  try {
    if (category) {
      query.category = category;
    }
    
    if (seller) {
      query.seller = seller;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (rating) {
      query.averageRating = { $gte: Number(rating) };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { story: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query).populate('seller').sort({ createdAt: -1 });

    // Populate seller profile shop name for each product manually since populate('seller') only gets the User
    const productsWithShop = await Promise.all(
      products.map(async (product) => {
        const prodDoc = JSON.parse(JSON.stringify(product));
        const sellerId = product.seller._id || product.seller;
        const profile = await SellerProfile.findOne({ user: sellerId });
        return {
          ...prodDoc,
          shopName: profile ? profile.shopName : 'Artisan Shop',
          location: profile ? profile.location : 'Unknown',
        };
      })
    );

    res.json({ success: true, products: productsWithShop });
  } catch (error) {
    console.error('Fetch Products Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving products' });
  }
});

// @desc    Get single product details with reviews
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('seller');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Get seller profile details
    const sellerId = product.seller._id || product.seller;
    const profile = await SellerProfile.findOne({ user: sellerId });

    // Get product reviews
    const reviews = await Review.find({ product: req.params.id }).populate('customer');

    res.json({
      success: true,
      product: {
        ...JSON.parse(JSON.stringify(product)),
        shopName: profile ? profile.shopName : 'Artisan Shop',
        sellerStory: profile ? profile.story : '',
        location: profile ? profile.location : '',
      },
      reviews,
    });
  } catch (error) {
    console.error('Fetch Product Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving product details' });
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private (Seller only)
router.post('/', protect, authorize('seller'), async (req, res) => {
  const { name, description, story, price, stock, images, category } = req.body;

  try {
    // Check if seller is approved by admin
    const profile = await SellerProfile.findOne({ user: req.user._id });
    if (!profile || !profile.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your seller profile must be approved by an Admin before uploading products',
      });
    }

    const product = await Product.create({
      name,
      description,
      story,
      price: Number(price),
      stock: Number(stock),
      images: images || [],
      category,
      seller: req.user._id,
    });

    res.status(201).json({ success: true, message: 'Product uploaded successfully', product });
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading product' });
  }
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (Seller/Admin)
router.put('/:id', protect, async (req, res) => {
  const { name, description, story, price, stock, images, category } = req.body;

  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check ownership or admin role
    if (product.seller !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this product' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (story) updates.story = story;
    if (price !== undefined) updates.price = Number(price);
    if (stock !== undefined) updates.stock = Number(stock);
    if (images) updates.images = images;
    if (category) updates.category = category;

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

    res.json({ success: true, message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating product' });
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private (Seller/Admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check ownership or admin role
    if (product.seller !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    await Product.findByIdAndDelete(req.params.id);
    // Delete associated reviews
    await Review.deleteOne({ product: req.params.id });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting product' });
  }
});

// @desc    Add review for a product
// @route   POST /api/products/:id/reviews
// @access  Private (Customer only)
router.post('/:id/reviews', protect, authorize('customer'), async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    return res.status(400).json({ success: false, message: 'Please provide a rating (1-5) and a comment' });
  }

  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if customer already reviewed this product
    const alreadyReviewed = await Review.findOne({
      product: req.params.id,
      customer: req.user._id,
    });

    if (alreadyReviewed) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }

    const review = await Review.create({
      product: req.params.id,
      customer: req.user._id,
      rating: Number(rating),
      comment,
    });

    // Recalculate average rating
    const reviews = await Review.find({ product: req.params.id });
    const reviewsCount = reviews.length;
    const averageRating = reviews.reduce((acc, item) => item.rating + acc, 0) / reviewsCount;

    await Product.findByIdAndUpdate(req.params.id, {
      $set: {
        averageRating: Number(averageRating.toFixed(1)),
        reviewsCount,
      },
    });

    res.status(201).json({ success: true, message: 'Review added successfully', review });
  } catch (error) {
    console.error('Add Review Error:', error);
    res.status(500).json({ success: false, message: 'Server error adding review' });
  }
});

module.exports = router;
