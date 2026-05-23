const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    global.useMockDB = true;
    console.log('🧪 Test Environment: Switched to In-Memory Mock Database.');
    return;
  }

  try {
    // Set a 3-second connection timeout so we don't hang if MongoDB isn't running
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/artify', {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    global.useMockDB = false;
    console.log('🍁 Connected to MongoDB successfully.');
  } catch (error) {
    console.warn('\n⚠️  WARNING: Could not connect to MongoDB. Fallback to In-Memory Mock Database is ENABLED.');
    console.warn('⚠️  Reason:', error.message);
    console.warn('💡 Artify will run in-memory. Data will be reset on server restart.\n');
    global.useMockDB = true;
  }
};

module.exports = { connectDB, isConnected: () => isConnected };
