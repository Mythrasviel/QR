@echo off
cd backend

REM 1. Install dependencies
echo Installing dependencies...
npm install

REM 2. Copy .env.example to .env if .env does not exist
IF NOT EXIST .env (
    echo Copying .env.example to .env...
    copy .env.example .env
) ELSE (
    echo .env already exists, skipping copy.
)

REM 3. Build frontend assets
echo Building frontend assets...
npm run build

REM 4. Install PM2 globally if not present
where pm2 >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo Installing PM2 globally...
    npm install -g pm2
) ELSE (
    echo PM2 already installed.
)

REM 5. Start server with PM2
echo Starting server with PM2...
pm2 start ecosystem.config.js

echo Deployment complete!
pause 