require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const qrRoutes = require('./routes/qr');
const gradeSectionRoutes = require('./routes/gradesection');
const adminRoutes = require('./routes/admin');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Debug: Log missing static files
app.use((req, res, next) => {
  if (req.path.startsWith('/js/') || req.path.startsWith('/assets/')) {
    console.warn('Static file not found:', req.path);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/gradesection', gradeSectionRoutes);
app.use('/api/admin', adminRoutes);

// Fallback: serve index.html for any unknown non-API route
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB connected');
  // Ensure single admin
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    const hashed = await bcrypt.hash('admin', 10);
    await User.create({ name: 'admin', grade: '-', section: '-', password: hashed, role: 'admin' });
    console.log('Default admin account created: username: admin, password: admin');
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
}); 