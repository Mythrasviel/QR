const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

// PUT /api/admin/update
router.put('/update', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { name, password } = req.body;
  const update = {};
  if (name) update.name = name;
  if (password) update.password = await bcrypt.hash(password, 10);
  const admin = await User.findOneAndUpdate({ role: 'admin' }, update, { new: true });
  res.json({ message: 'Admin updated', admin });
});

module.exports = router; 