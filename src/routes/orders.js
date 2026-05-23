const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Product = require('../models/product');
const Payment = require('../models/payment');
const Notification = require('../models/notification');
const { protect, authorize } = require('../middleware/authMiddleware');

// @desc    Create a new order (Checkout)
// @route   POST /api/orders
// @access  Private (Customer only)
router.post('/', protect, authorize('customer'), async (req, res) => {
  const { items, shippingAddress, paymentMethod, paymentDetails } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items in order' });
  }

  try {
    let totalAmount = 0;
    const orderItems = [];
    const commissionRate = Number(process.env.COMMISSION_RATE || 0.10);

    // Validate stock and construct items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.product} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for product: ${product.name}` });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product: product._id.toString(),
        quantity: item.quantity,
        price: product.price,
        seller: product.seller.toString(),
      });

      // Deduct stock
      await Product.findByIdAndUpdate(product._id, {
        $set: { stock: product.stock - item.quantity },
      });
    }

    const commissionAmount = totalAmount * commissionRate;
    const sellerPayoutAmount = totalAmount - commissionAmount;

    // Create the Order
    const order = await Order.create({
      customer: req.user._id,
      items: orderItems,
      totalAmount,
      commissionAmount: Number(commissionAmount.toFixed(2)),
      sellerPayoutAmount: Number(sellerPayoutAmount.toFixed(2)),
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid', // Pre-approve online mock payments
      shippingAddress,
      shippingStatus: 'Processing',
    });

    // Create Simulated Payment
    const paymentId = 'PAY-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    await Payment.create({
      order: order._id,
      transactionId: paymentDetails?.transactionId || paymentId,
      amount: totalAmount,
      paymentMethod,
      status: order.paymentStatus,
      sellerPayoutStatus: 'Pending',
    });

    // Notify Customer
    await Notification.create({
      user: req.user._id,
      title: 'Order Placed!',
      message: `Your order ${order.trackingNumber} has been successfully placed. Status: Processing.`,
      type: 'order_update',
    });

    // Notify Sellers
    const uniqueSellers = [...new Set(orderItems.map(item => item.seller))];
    for (const sellerId of uniqueSellers) {
      await Notification.create({
        user: sellerId,
        title: 'New Order Received',
        message: `You have received a new order ${order.trackingNumber} for your craft.`,
        type: 'new_order',
      });
    }

    res.status(201).json({ success: true, message: 'Order created successfully', order });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ success: false, message: 'Server error creating order' });
  }
});

// @desc    Get customer order history
// @route   GET /api/orders/customer
// @access  Private (Customer only)
router.get('/customer', protect, authorize('customer'), async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id }).populate('items.product').sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Fetch Customer Orders Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving orders' });
  }
});

// @desc    Get orders received by seller
// @route   GET /api/orders/seller
// @access  Private (Seller only)
router.get('/seller', protect, authorize('seller'), async (req, res) => {
  try {
    // Find all orders that contain items belonging to this seller
    const allOrders = await Order.find().populate('items.product').sort({ createdAt: -1 });
    const sellerOrders = allOrders.filter(order =>
      order.items.some(item => item.seller === req.user._id.toString())
    );

    // Format orders to only show items belonging to this seller for security/clarity
    const formattedOrders = sellerOrders.map(order => {
      const doc = JSON.parse(JSON.stringify(order));
      doc.items = doc.items.filter(item => item.seller === req.user._id.toString());
      
      // Recalculate seller-specific values for dashboard convenience
      const sellerSubtotal = doc.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const commissionRate = Number(process.env.COMMISSION_RATE || 0.10);
      doc.sellerSubtotal = sellerSubtotal;
      doc.sellerCommission = sellerSubtotal * commissionRate;
      doc.sellerPayout = sellerSubtotal - doc.sellerCommission;

      return doc;
    });

    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error('Fetch Seller Orders Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving orders' });
  }
});

// @desc    Get order details
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product').populate('customer');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check authorization: customer who placed it, seller of items, or admin
    const isCustomer = order.customer._id.toString() === req.user._id.toString() || order.customer === req.user._id.toString();
    const isSeller = order.items.some(item => item.seller === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isSeller && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Fetch Order Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving order details' });
  }
});

// @desc    Update shipping status
// @route   PUT /api/orders/:id/status
// @access  Private (Seller/Admin)
router.put('/:id/status', protect, async (req, res) => {
  const { shippingStatus } = req.body;

  if (!shippingStatus || !['Processing', 'Shipped', 'Delivered'].includes(shippingStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid shipping status' });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Auth check: Admin or Seller who owns the items in the order
    const isSeller = order.items.some(item => item.seller === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isSeller && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this order shipping status' });
    }

    // Update shipping status
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {
      $set: { shippingStatus },
    }, { new: true });

    // Notify customer
    await Notification.create({
      user: order.customer,
      title: 'Order Status Updated',
      message: `Your order ${order.trackingNumber} has been updated to: ${shippingStatus}.`,
      type: 'order_update',
    });

    res.json({ success: true, message: `Shipping status updated to ${shippingStatus}`, order: updatedOrder });
  } catch (error) {
    console.error('Update Order Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating order status' });
  }
});

// @desc    Update payment status
// @route   PUT /api/orders/:id/payment
// @access  Private (Admin only)
router.put('/:id/payment', protect, authorize('admin'), async (req, res) => {
  const { paymentStatus } = req.body;

  if (!paymentStatus || !['Pending', 'Paid', 'Failed', 'Refunded'].includes(paymentStatus)) {
    return res.status(400).json({ success: false, message: 'Invalid payment status' });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order payment status
    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {
      $set: { paymentStatus },
    }, { new: true });

    // Update payment record status
    await Payment.findOneAndUpdate(
      { order: order._id },
      { $set: { status: paymentStatus } }
    );

    // Notify customer
    await Notification.create({
      user: order.customer,
      title: 'Payment Status Updated',
      message: `Your payment for order ${order.trackingNumber} is now: ${paymentStatus}.`,
      type: 'order_update',
    });

    res.json({ success: true, message: `Payment status updated to ${paymentStatus}`, order: updatedOrder });
  } catch (error) {
    console.error('Update Order Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error updating order payment status' });
  }
});

module.exports = router;
