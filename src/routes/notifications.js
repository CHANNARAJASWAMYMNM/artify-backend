const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id.toString() }).sort({ createdAt: -1 });
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Fetch Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications' });
  }
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.user !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await Notification.findByIdAndUpdate(req.params.id, {
      $set: { isRead: true }
    }, { new: true });

    res.json({ success: true, notification: updated });
  } catch (error) {
    console.error('Mark Notification Read Error:', error);
    res.status(500).json({ success: false, message: 'Server error marking notification as read' });
  }
});

module.exports = router;
