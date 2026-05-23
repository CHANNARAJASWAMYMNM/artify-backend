const { defineModel } = require('./modelHelper');

const orderSchemaObj = {
  customer: {
    type: String,
    required: true,
    ref: 'User',
  },
  items: [
    {
      product: {
        type: String,
        required: true,
        ref: 'Product',
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
      },
      seller: {
        type: String,
        required: true,
        ref: 'User',
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  commissionAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  sellerPayoutAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Online'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  shippingAddress: {
    name: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    phone: { type: String, required: true },
  },
  shippingStatus: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered'],
    default: 'Processing',
  },
  trackingNumber: {
    type: String,
    default: function() {
      return 'ART-' + Math.floor(100000 + Math.random() * 900000);
    },
  },
};

module.exports = defineModel('Order', orderSchemaObj);
