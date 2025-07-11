# Student Attendance Management System (QR-based)

A modern, responsive web application for managing student attendance using QR codes. Built with Node.js, Express, MongoDB, Bootstrap 5, and Font Awesome.

## Features
- Student and Admin login
- QR code-based attendance (scan & generate)
- Attendance history and reports
- Student and class management
- Responsive, modern UI

## Getting Started
- Backend: See `/backend` for API setup
- Frontend: Open `index.html` or other HTML files in your browser

---
**Design inspired by modern UI best practices.** 

## Production Build & Deployment

### 1. Install Dependencies

```
cd backend
npm install
```

### 2. Set Environment Variables

- Copy `.env.example` to `.env` and fill in your values.

### 3. Build Frontend Assets

```
npm run build
```
This will minify JS and CSS files in `public/js` and `public/assets/css`.

### 4. Start the Server (Production)

#### With PM2 (Recommended)
```
npm install -g pm2
pm run build
pm run start  # or pm2 start ecosystem.config.js
```

#### Or with Node.js
```
node server.js
```

### 5. (Optional) Expose Locally with ngrok
```
../ngrok.exe http 3000
```

### 6. (Optional) Use a Reverse Proxy (Nginx/Apache) and HTTPS

---

For more details, see comments in `.env.example` and `ecosystem.config.js`. 