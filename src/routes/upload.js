const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Curated stock photos for street artisan products
const stockImages = {
  Pottery: [
    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1565192647048-f997ded87958?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&q=80&w=600',
  ],
  'Clay Art': [
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1528642463367-8d7efcd1fce6?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1576016770956-debb63d900ad?auto=format&fit=crop&q=80&w=600',
  ],
  Woodwork: [
    'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=600',
  ],
  Textiles: [
    'https://images.unsplash.com/photo-1584992236310-6edddc085ff6?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1601887389937-0b02c26b6c3c?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=600',
  ],
  Other: [
    'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=600',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=600',
  ]
};

// @desc    Upload product image (base64 simulation or random category stock selector)
// @route   POST /api/upload
// @access  Private (Sellers/Admins)
router.post('/', protect, async (req, res) => {
  const { imageBase64, category } = req.body;

  try {
    // If client sent a base64 image, we can just echo it back.
    // In a real application this is uploaded to Cloudinary.
    if (imageBase64 && imageBase64.startsWith('data:image')) {
      return res.status(200).json({
        success: true,
        url: imageBase64,
        message: 'Base64 image processed successfully (mock cloud upload)'
      });
    }

    // Otherwise, select a beautiful topic-specific stock photo
    const cat = category && stockImages[category] ? category : 'Other';
    const list = stockImages[cat];
    const randomIndex = Math.floor(Math.random() * list.length);
    const selectedUrl = list[randomIndex];

    res.status(200).json({
      success: true,
      url: selectedUrl,
      message: `Stock photo generated successfully for category ${cat}`
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error processing image' });
  }
});

module.exports = router;
