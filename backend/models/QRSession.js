const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
  className: { type: String, required: true }, // store class name directly
  code: { type: String, required: true },      // random session code/id
  grade: { type: String, required: true },
  section: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('QRSession', qrSessionSchema); 