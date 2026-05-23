const { defineModel } = require('./modelHelper');

const sellerProfileSchemaObj = {
  user: {
    type: String,
    required: true,
    ref: 'User',
  },
  shopName: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: String,
    required: true,
  },
  story: {
    type: String,
    required: true,
  },
  craftType: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    default: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=400',
  },
  bankDetails: {
    upiId: { type: String, default: '' },
    accountNo: { type: String, default: '' },
    bankName: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
};

module.exports = defineModel('SellerProfile', sellerProfileSchemaObj);
