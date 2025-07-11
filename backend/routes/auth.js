const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, grade, section, password, role, studentId } = req.body;
    if (!name || !grade || !section || !password || !role || !studentId) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    // Validate grade-section exists
    const GradeSection = require('../models/GradeSection');
    const exists = await GradeSection.findOne({ grade, section });
    if (!exists) {
      return res.status(400).json({ message: 'Selected grade/section does not exist.' });
    }
    // Check for duplicate studentId
    const User = require('../models/User');
    const idExists = await User.findOne({ studentId });
    if (idExists) {
      return res.status(400).json({ message: 'Student ID already exists.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    console.log(`[Student Register] Registration endpoint called for studentId: ${studentId}, grade: ${grade}, section: ${section}`);
    const user = new User({ studentId, name, grade, section, password: hashed, role });
    await user.save();

    // Create absent attendance records for all existing sessions for this grade/section
    const QRSession = require('../models/QRSession');
    const Attendance = require('../models/Attendance');
    const allSessions = await QRSession.find({});
    const sessions = allSessions.filter(
      s =>
        String(s.grade).trim().toLowerCase() === String(grade).trim().toLowerCase() &&
        String(s.section).trim().toLowerCase() === String(section).trim().toLowerCase()
    );
    console.log(`[Student Register] Found ${sessions.length} sessions for grade '${grade}', section '${section}'`);
    if (sessions.length === 0) {
      console.log('[Student Register] Available sessions:', allSessions.map(s => ({ id: s._id, grade: s.grade, section: s.section, className: s.className })));
    }
    const createdAttendance = [];
    for (const session of sessions) {
      try {
        const exists = await Attendance.findOne({ session: session._id, student: user._id });
        if (!exists) {
          const att = await Attendance.create({ session: session._id, student: user._id, date: new Date(), status: 'absent' });
          createdAttendance.push(att);
          console.log(`[Student Register] Created absent attendance for student ${user._id} in session ${session._id}`);
        } else {
          console.log(`[Student Register] Attendance already exists for student ${user._id} in session ${session._id}`);
        }
      } catch (err) {
        console.error(`[Student Register] Error creating attendance for student ${user._id} in session ${session._id}:`, err);
      }
    }
    console.log(`[Student Register] Attendance creation complete for studentId: ${studentId}`);

    res.status(201).json({ message: 'User registered successfully.', createdAttendance });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join('; ');
      return res.status(400).json({ message: 'Validation error: ' + messages });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: 'Username and password required.' });
    }
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, studentId: user.studentId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, studentId: user.studentId } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; 