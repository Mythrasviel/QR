const mongoose = require('mongoose');
const gradeSectionSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  section: { type: String, required: true }
});
module.exports = mongoose.model('GradeSection', gradeSectionSchema); 