@echo off
cd backend
start cmd /k "npm start"
cd ..
start http://localhost:5000 