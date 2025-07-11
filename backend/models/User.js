const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  grade: { type: String, required: true },
  section: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); 