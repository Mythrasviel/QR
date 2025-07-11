const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const QRSession = require('../models/QRSession');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// List all QR sessions (admin only)
router.get('/sessions', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const sessions = await QRSession.find().sort({ createdAt: -1 });
  res.json(sessions);
});

// POST /api/qr/generate (admin only)
router.post('/generate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { className, grade, section } = req.body;
    if (!className || !grade || !section) return res.status(400).json({ message: 'className, grade, and section required' });
    // Generate a random code for the session (not a QR image)
    const code = (Math.random().toString(36).substr(2, 9) + Date.now()).slice(0, 16);
    const qrSession = new QRSession({ className, code, grade, section });
    await qrSession.save();
    res.json({ code, sessionId: qrSession._id });
  } catch (err) {
    console.error('QR Generate Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
});

// DELETE /api/qr/session/:id (admin only)
router.delete('/session/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const deleted = await QRSession.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Session not found' });
    // Delete all attendance records for this session
    await Attendance.deleteMany({ session: req.params.id });
    res.json({ message: 'Session and related attendance deleted' });
  } catch (err) {
    console.error('QR Delete Session Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
});

// DELETE /api/qr/session/:sessionId/attendance/:studentId (admin only)
const Attendance = require('../models/Attendance');
router.delete('/session/:sessionId/attendance/:studentId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { sessionId, studentId } = req.params;
    const deleted = await Attendance.findOneAndDelete({ session: sessionId, student: studentId });
    if (!deleted) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance deleted' });
  } catch (err) {
    console.error('QR Delete Attendance Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
  }
});

// GET /api/qr/session/:id (admin only)
router.get('/session/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const session = await QRSession.findById(req.params.id);
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json(session);
});

// Remove expiry watcher and absentee marking logic

// POST /api/qr/validate (student)
router.post('/validate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'QR code required' });
    const qrSession = await QRSession.findOne({ code, active: true });
    if (!qrSession) return res.status(404).json({ message: 'Invalid or expired QR code' });
    // Mark attendance will be handled in attendance route
    res.json({ message: 'QR code valid', classId: qrSession.class, sessionId: qrSession._id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; 