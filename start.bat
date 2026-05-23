@echo off
chcp 65001 >nul

echo ============================================================
echo   Minecraft Skin Server - Windows Startup Script
echo ============================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    echo         https://nodejs.org/
    pause
    exit /b 1
)

:: Check .env file
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] Created .env from .env.example
    ) else (
        echo DB_TYPE=sqlite > .env
        echo DB_PATH=./data/skin_server.db >> .env
        echo JWT_SECRET=change_this_secret >> .env
        echo PORT=3000 >> .env
        echo [INFO] Created default .env with SQLite
    )
)

:: Read DB_TYPE from .env
set DB_TYPE=sqlite
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a"=="DB_TYPE" set DB_TYPE=%%b
)

echo [INFO] Database type: %DB_TYPE%

:: Database check
if /i "%DB_TYPE%"=="postgres" (
    call :check_postgres
) else (
    call :check_sqlite
)

if %errorlevel% neq 0 (
    pause
    exit /b 1
)

:: Install backend dependencies
if not exist "node_modules" (
    echo [INFO] Installing backend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

:: Install frontend dependencies
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    pushd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] frontend npm install failed
        popd
        pause
        exit /b 1
    )
    popd
)

:: Generate RSA keys
if not exist "keys\private.pem" (
    echo [INFO] Generating RSA keys...
    if not exist "keys" mkdir keys
    call npm run generate-keys
)

:: Run database migrations
echo [INFO] Running database migrations...
call npm run migrate
if %errorlevel% neq 0 (
    echo [ERROR] Database migration failed
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Starting development servers...
echo   Frontend: http://localhost:5174
echo   Backend:  http://localhost:3000
echo ============================================================
echo.

start "Skin Server - Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul
call npm run dev

goto :eof

:: ---- PostgreSQL check ----
:check_postgres
echo [INFO] Checking PostgreSQL connection...
node -e "const {Pool}=require('pg');const p=new Pool({host:process.env.DB_HOST||'localhost',port:parseInt(process.env.DB_PORT||'5432'),database:process.env.DB_DATABASE||'skin_server',user:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||''});p.query('SELECT 1',(e)=>{if(e){console.error('[ERROR] PostgreSQL connection failed:',e.message);process.exit(1);}else{console.log('[OK] PostgreSQL connected');process.exit(0);}});"
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL connection failed. Please check your .env settings.
    echo [TIP]   You can set DB_TYPE=sqlite to use local SQLite instead.
    exit /b 1
)
goto :eof

:: ---- SQLite check ----
:check_sqlite
echo [INFO] Checking SQLite setup...
set DB_PATH=./data/skin_server.db
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a"=="DB_PATH" set DB_PATH=%%b
)

:: Create data directory if needed
if not exist "data" mkdir data

echo [INFO] SQLite database path: %DB_PATH%
goto :eof
