require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const sellerRoutes = require('./routes/sellers');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');

// Initialize app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Status: ${res.statusCode} (${duration}ms)`);
  });
  if (req.body && Object.keys(req.body).length > 0) {
    const debugBody = { ...req.body };
    if (debugBody.password) debugBody.password = '********';
    console.log('   Payload:', debugBody);
  }
  next();
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: global.useMockDB ? 'InMemoryMock' : 'MongoDB' });
});

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Self-seeding database helper
const seedDatabase = async () => {
  const User = require('./models/user');
  const SellerProfile = require('./models/sellerProfile');
  const Product = require('./models/product');
  const bcrypt = require('bcryptjs');

  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('🌱 Database already has users. Skipping self-seeding.');
      return;
    }

    console.log('🌱 Database is empty. Running self-seeding process...');

    // 1. Create Hashed Password
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);

    // 2. Create Admin
    const admin = await User.create({
      email: 'admin@artify.com',
      password,
      role: 'admin',
      isVerified: true,
    });
    console.log('👥 Admin user created: admin@artify.com');

    // 3. Create Sellers
    const ramuUser = await User.create({
      email: 'ramu@artify.com',
      password,
      role: 'seller',
      isVerified: true,
    });
    const ramuProfile = await SellerProfile.create({
      user: ramuUser._id,
      shopName: 'Ramu Clay Creations',
      location: 'Khurja, Uttar Pradesh',
      craftType: 'Terracotta & Clay Cookware',
      story: 'Ramu has been practicing clay pottery for over 35 years. Carrying forward his father\'s legacy, Ramu gathers natural clay from regional river beds, refines it manually, and bakes it in traditional wood-fired kilns. Each piece tells the story of earth, smoke, and sweat.',
      profileImage: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=400',
      bankDetails: { upiId: 'ramu@paytm', accountNo: '1234567890', bankName: 'SBI', ifscCode: 'SBIN0001234' },
      isApproved: true,
    });

    const sitaUser = await User.create({
      email: 'sita@artify.com',
      password,
      role: 'seller',
      isVerified: true,
    });
    const sitaProfile = await SellerProfile.create({
      user: sitaUser._id,
      shopName: 'Sita Handloom Weaves',
      location: 'Chanderi, Madhya Pradesh',
      craftType: 'Chanderi Silk & Cotton Weaving',
      story: 'Sita belongs to a community of weavers who have kept the intricate art of Chanderi alive for generations. Working on a traditional wooden handloom, she spins fine threads of gold zari and cotton into fabrics that feel like second skin. She seeks to support her family and preserve the loom.',
      profileImage: 'https://images.unsplash.com/photo-1601887389937-0b02c26b6c3c?auto=format&fit=crop&q=80&w=400',
      bankDetails: { upiId: 'sita@ybl', accountNo: '9876543210', bankName: 'HDFC', ifscCode: 'HDFC0004567' },
      isApproved: true,
    });

    // 4. Create Products
    await Product.create({
      name: 'Wood-Fired Clay Biryani Pot',
      description: 'Earthy, chemical-free terracotta pot ideal for slow cooking biryani, curries, and stews. Naturally alkalizes food and retains heat.',
      story: 'Handcrafted by Ramu over 3 days, this pot is polished using natural river stones to give it a glossy finish before being fired in a firewood kiln at 900°C. The wood ash creates a unique smoke-blackened texture on each piece.',
      price: 499,
      stock: 12,
      images: [
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&q=80&w=600'
      ],
      category: 'Pottery',
      seller: ramuUser._id,
      averageRating: 4.8,
      reviewsCount: 5,
    });

    await Product.create({
      name: 'Handcrafted Terracotta Chai Cups (Set of 6)',
      description: 'Traditional reusable clay kulhads for serving tea, coffee, or lassi. Experience the authentic earthy aroma of clay with every sip.',
      story: 'Wheel-thrown in Ramu\'s backyard under the shade of an old neem tree. Ramu turns out over a hundred of these daily, ensuring exact proportions and rustic lightweight comfort.',
      price: 249,
      stock: 35,
      images: ['https://images.unsplash.com/photo-1576016770956-debb63d900ad?auto=format&fit=crop&q=80&w=600'],
      category: 'Pottery',
      seller: ramuUser._id,
      averageRating: 4.5,
      reviewsCount: 2,
    });

    await Product.create({
      name: 'Chanderi Gold Border Cotton Silk Saree',
      description: 'Elegant cream-colored lightweight saree featuring traditional gold zari borders and motifs. Perfect for celebrations and formal wear.',
      story: 'Sita took 8 days of continuous loom working to finish this saree. The geometric motifs are inspired by historical monuments in Chanderi, hand-woven thread by thread using pure gold-wrapped silver wires.',
      price: 3499,
      stock: 4,
      images: ['https://images.unsplash.com/photo-1584992236310-6edddc085ff6?auto=format&fit=crop&q=80&w=600'],
      category: 'Textiles',
      seller: sitaUser._id,
      averageRating: 4.9,
      reviewsCount: 3,
    });

    // 5. Create Customer
    await User.create({
      email: 'customer@artify.com',
      password,
      role: 'customer',
      isVerified: true,
    });
    console.log('👥 Customer user created: customer@artify.com');

    console.log('✨ Database self-seeding complete! Default credentials:');
    console.log('👉 Admin: admin@artify.com / password123');
    console.log('👉 Seller (Ramu): ramu@artify.com / password123');
    console.log('👉 Seller (Sita): sita@artify.com / password123');
    console.log('👉 Customer: customer@artify.com / password123');

  } catch (error) {
    console.error('Seeding Error:', error);
  }
};

// Start Server
const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  await seedDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Artify Server running on http://localhost:${PORT}`);
  });
});
