const express = require('express');
const router = express.Router();
const GradeSection = require('../models/GradeSection');
const auth = require('../middleware/auth');

// Admin: Add grade/section
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { grade, section } = req.body;
  if (!grade || !section) return res.status(400).json({ message: 'All fields required' });
  const gs = new GradeSection({ grade, section });
  await gs.save();
  res.status(201).json(gs);
});

// List all grade/sections
router.get('/', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const list = await GradeSection.find();
  res.json(list);
});

// Delete a grade/section (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const deleted = await GradeSection.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Grade/Section not found' });
  res.json({ message: 'Grade/Section deleted' });
});

// Update a grade/section (admin only)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { grade, section } = req.body;
  if (!grade || !section) return res.status(400).json({ message: 'All fields required' });
  const gs = await GradeSection.findByIdAndUpdate(req.params.id, { grade, section }, { new: true });
  if (!gs) return res.status(404).json({ message: 'Grade/Section not found' });
  // Update all students with the old grade/section
  const old = gs;
  await require('../models/User').updateMany({ grade: old.grade, section: old.section, role: 'student' }, { grade, section });
  // Update all attendance records with the old grade/section (via session)
  const QRSession = require('../models/QRSession');
  const Attendance = require('../models/Attendance');
  const sessions = await QRSession.find({ grade: old.grade, section: old.section });
  for (const session of sessions) {
    session.grade = grade;
    session.section = section;
    await session.save();
    await Attendance.updateMany({ session: session._id }, {}); // attendance links session, so session update is enough
  }
  res.json(gs);
});

module.exports = router; 