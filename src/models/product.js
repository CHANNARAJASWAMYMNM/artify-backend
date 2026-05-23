const { defineModel } = require('./modelHelper');

const productSchemaObj = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  story: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 10,
  },
  images: {
    type: [String],
    default: ['https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=600'],
  },
  category: {
    type: String,
    required: true,
    enum: ['Pottery', 'Clay Art', 'Woodwork', 'Textiles', 'Other'],
    default: 'Other',
  },
  seller: {
    type: String,
    required: true,
    ref: 'User',
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  reviewsCount: {
    type: Number,
    default: 0,
  },
};

module.exports = defineModel('Product', productSchemaObj);
