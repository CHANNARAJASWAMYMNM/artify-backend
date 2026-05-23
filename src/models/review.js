const { defineModel } = require('./modelHelper');

const reviewSchemaObj = {
  product: {
    type: String,
    required: true,
    ref: 'Product',
  },
  customer: {
    type: String,
    required: true,
    ref: 'User',
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
  },
};

module.exports = defineModel('Review', reviewSchemaObj);
