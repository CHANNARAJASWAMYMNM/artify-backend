const { defineModel } = require('./modelHelper');

const paymentSchemaObj = {
  order: {
    type: String,
    required: true,
    ref: 'Order',
  },
  transactionId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  sellerPayoutStatus: {
    type: String,
    enum: ['Pending', 'Disbursed', 'Refunded'],
    default: 'Pending',
  },
};

module.exports = defineModel('Payment', paymentSchemaObj);
