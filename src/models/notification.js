const { defineModel } = require('./modelHelper');

const notificationSchemaObj = {
  user: {
    type: String,
    required: true,
    ref: 'User',
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['order_update', 'new_order', 'seller_approval', 'general'],
    default: 'general',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
};

module.exports = defineModel('Notification', notificationSchemaObj);
