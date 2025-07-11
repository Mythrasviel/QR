const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// GET /api/students (admin only)
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const filter = { role: 'student' };
  if (req.query.grade) filter.grade = req.query.grade;
  if (req.query.section) filter.section = req.query.section;
  const students = await User.find(filter).select('-password');
  res.json(students);
});

// POST /api/students (admin only)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { studentId, name, grade, section, password } = req.body;
  if (!studentId || !name || !grade || !section || !password) return res.status(400).json({ message: 'All fields required' });
  // Validate grade-section exists
  const GradeSection = require('../models/GradeSection');
  const exists = await GradeSection.findOne({ grade, section });
  if (!exists) return res.status(400).json({ message: 'Selected grade/section does not exist.' });
  // Check for duplicate studentId
  const idExists = await User.findOne({ studentId });
  if (idExists) return res.status(400).json({ message: 'Student ID already exists.' });
  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash(password, 10);
  const student = new User({ studentId, name, grade, section, password: hashed, role: 'student' });
  await student.save();

  console.log(`[Student Add] Endpoint called for studentId: ${studentId}, grade: ${grade}, section: ${section}`);
  // Create absent attendance records for all existing sessions for this grade/section
  const QRSession = require('../models/QRSession');
  const allSessions = await QRSession.find({});
  const sessions = allSessions.filter(
    s =>
      String(s.grade).trim().toLowerCase() === String(grade).trim().toLowerCase() &&
      String(s.section).trim().toLowerCase() === String(section).trim().toLowerCase()
  );
  console.log(`[Student Add] Found ${sessions.length} sessions for grade '${grade}', section '${section}'`);
  if (sessions.length === 0) {
    console.log('[Student Add] Available sessions:', allSessions.map(s => ({ id: s._id, grade: s.grade, section: s.section, className: s.className })));
  }
  const createdAttendance = [];
  for (const session of sessions) {
    try {
      const exists = await Attendance.findOne({ session: session._id, student: student._id });
      if (!exists) {
        const att = await Attendance.create({ session: session._id, student: student._id, date: new Date(), status: 'absent' });
        createdAttendance.push(att);
        console.log(`[Student Add] Created absent attendance for student ${student._id} in session ${session._id}`);
      } else {
        console.log(`[Student Add] Attendance already exists for student ${student._id} in session ${session._id}`);
      }
    } catch (err) {
      console.error(`[Student Add] Error creating attendance for student ${student._id} in session ${session._id}:`, err);
    }
  }
  console.log(`[Student Add] Attendance creation complete for studentId: ${studentId}`);

  res.status(201).json({ message: 'Student added', createdAttendance });
});

// PUT /api/students/:id (admin only)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { studentId, name, grade, section } = req.body;
  if (!studentId || !name || !grade || !section) return res.status(400).json({ message: 'All fields required' });
  // Validate grade-section exists
  const GradeSection = require('../models/GradeSection');
  const exists = await GradeSection.findOne({ grade, section });
  if (!exists) return res.status(400).json({ message: 'Selected grade/section does not exist.' });
  // Check for duplicate studentId (excluding current student)
  const idExists = await User.findOne({ studentId, _id: { $ne: req.params.id } });
  if (idExists) return res.status(400).json({ message: 'Student ID already exists.' });
  const student = await User.findByIdAndUpdate(req.params.id, { studentId, name, grade, section }, { new: true });
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json({ message: 'Student updated', student });
});

// DELETE /api/students/:id (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const student = await User.findByIdAndDelete(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  // Delete all attendance records for this student
  await Attendance.deleteMany({ student: req.params.id });
  res.json({ message: 'Student and related attendance deleted' });
});

// GET /api/students/:id/attendance (student or admin)
router.get('/:id/attendance', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) return res.status(403).json({ message: 'Forbidden' });
  const records = await Attendance.find({ student: req.params.id }).populate('class', 'name code');
  res.json(records);
});

// GET /api/students/me (student)
router.get('/me', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
  const student = await User.findById(req.user.id).select('-password');
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json(student);
});

module.exports = router; 