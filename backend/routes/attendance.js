const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const QRSession = require('../models/QRSession');
const auth = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');

// POST /api/attendance/mark
router.post('/mark', auth, async (req, res) => {
  try {
    const { sessionId, qrCode } = req.body;
    if (!sessionId || !qrCode) {
      console.error('[Attendance Mark] Missing sessionId or qrCode:', req.body);
      return res.status(400).json({ message: 'sessionId and qrCode required' });
    }
    let qrSession;
    try {
      qrSession = await QRSession.findById(sessionId);
    } catch (err) {
      console.error('[Attendance Mark] Error finding session:', err);
      return res.status(500).json({ message: 'Error finding session', error: err.message });
    }
    if (!qrSession) {
      console.error(`[Attendance Mark] Invalid sessionId: ${sessionId}`);
      return res.status(404).json({ message: 'Invalid session' });
    }
    let student;
    try {
      student = await User.findOne({ studentId: qrCode, role: 'student' });
    } catch (err) {
      console.error('[Attendance Mark] Error finding student:', err);
      return res.status(500).json({ message: 'Error finding student', error: err.message });
    }
    if (!student) {
      console.error(`[Attendance Mark] Student not found for QR code: ${qrCode}`);
      return res.status(404).json({ message: 'Student not found' });
    }
    // Compare scanned QR code with expected studentId
    if (qrCode !== student.studentId) {
      console.warn(`[Attendance Mark] QR code does not match studentId: scanned=${qrCode}, expected=${student.studentId}`);
      return res.status(400).json({ message: 'QR code does not match student.' });
    }
    // Check if student belongs to the session's grade and section
    if (student.grade !== qrSession.grade || student.section !== qrSession.section) {
      console.warn(`[Attendance Mark] Student ${student.studentId} does not belong to session ${sessionId} (grade/section mismatch)`);
      return res.status(400).json({ message: 'Student does not belong to this session.' });
    }
    // Ensure sessionId is an ObjectId
    let sessionObjId;
    try {
      sessionObjId = new mongoose.Types.ObjectId(sessionId);
    } catch (err) {
      console.error('[Attendance Mark] Invalid sessionId for ObjectId:', err);
      return res.status(400).json({ message: 'Invalid sessionId format' });
    }
    console.log('[DEBUG] Looking for attendance:', { session: sessionObjId, student: student._id });
    let attendance;
    try {
      attendance = await Attendance.findOne({ session: sessionObjId, student: student._id });
    } catch (err) {
      console.error('[Attendance Mark] Error finding attendance:', err);
      return res.status(500).json({ message: 'Error finding attendance', error: err.message });
    }
    console.log('[DEBUG] Found attendance:', attendance);
    if (attendance) {
      if (attendance.status === 'present') {
        const populatedAttendance = await Attendance.findOne({ session: sessionObjId, student: student._id }).populate('student', 'name studentId grade section');
        console.warn(`[Attendance Mark] Attendance already marked as present for studentId: ${student.studentId}, sessionId: ${sessionId}`);
        return res.status(409).json({ message: 'Attendance already marked as present.', student: populatedAttendance.student });
      }
      attendance.status = 'present';
      try {
        await attendance.save();
      } catch (err) {
        console.error('[Attendance Mark] Error saving attendance:', err);
        return res.status(500).json({ message: 'Error saving attendance', error: err.message });
      }
      console.log('[DEBUG] Updated attendance:', attendance);
      const populatedAttendance = await Attendance.findOne({ session: sessionObjId, student: student._id }).populate('student', 'name studentId grade section');
      console.log(`[Attendance Mark] SUCCESS: Attendance updated to present for studentId: ${student.studentId}, sessionId: ${sessionId}`);
      return res.json({ message: 'Attendance updated to present.', student: populatedAttendance.student });
    } else {
      try {
        attendance = new Attendance({
          session: sessionObjId,
          student: student._id,
          date: new Date(),
          status: 'present'
        });
        await attendance.save();
      } catch (err) {
        console.error('[Attendance Mark] Error creating attendance:', err);
        return res.status(500).json({ message: 'Error creating attendance', error: err.message });
      }
      const populatedAttendance = await Attendance.findOne({ session: sessionObjId, student: student._id }).populate('student', 'name studentId grade section');
      console.log(`[Attendance Mark] SUCCESS: Attendance marked as present for studentId: ${student.studentId}, sessionId: ${sessionId}`);
      return res.json({ message: 'Attendance marked as present.', student: populatedAttendance.student });
    }
  } catch (err) {
    console.error('[Attendance Mark] Server error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// --- Mark all students as absent on session creation ---
router.post('/mark-absent-for-session', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.error('[Mark Absent] Forbidden: Not admin');
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { sessionId } = req.body;
    if (!sessionId) {
      console.error('[Mark Absent] Missing sessionId:', req.body);
      return res.status(400).json({ message: 'sessionId required' });
    }
    let session;
    try {
      session = await QRSession.findById(sessionId);
    } catch (err) {
      console.error('[Mark Absent] Error finding session:', err);
      return res.status(500).json({ message: 'Error finding session', error: err.message });
    }
    if (!session) {
      console.error(`[Mark Absent] Session not found for sessionId: ${sessionId}`);
      return res.status(404).json({ message: 'Session not found' });
    }
    let students;
    try {
      students = await User.find({ grade: session.grade, section: session.section, role: 'student' });
    } catch (err) {
      console.error('[Mark Absent] Error finding students:', err);
      return res.status(500).json({ message: 'Error finding students', error: err.message });
    }
    let count = 0;
    for (const student of students) {
      try {
        const exists = await Attendance.findOne({ session: new mongoose.Types.ObjectId(sessionId), student: student._id });
        if (!exists) {
          await Attendance.create({ session: new mongoose.Types.ObjectId(sessionId), student: student._id, date: new Date(), status: 'absent' });
          count++;
        }
      } catch (err) {
        console.error(`[Mark Absent] Error processing student ${student._id}:`, err);
      }
    }
    console.log(`[Mark Absent] Marked ${count} students as absent for sessionId: ${sessionId}`);
    res.json({ message: `Marked ${count} students as absent for session.` });
  } catch (err) {
    console.error('[Mark Absent] Server error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/attendance/report (admin)
router.get('/report', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { classId, date, sessionId } = req.query;
    const filter = {};
    if (classId) filter.class = classId;
    if (sessionId) filter.session = sessionId;
    if (date) {
      const d = new Date(date);
      filter.date = { $gte: new Date(d.setHours(0,0,0,0)), $lte: new Date(d.setHours(23,59,59,999)) };
    }
    const records = await Attendance.find(filter)
      .populate('student', 'name studentId grade section')
      .populate('session', 'grade section className');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router; 