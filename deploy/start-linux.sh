#!/bin/bash

# Minecraft Skin Server - Linux Startup Script
# Run from project root: ./deploy/start-linux.sh
# Or: cd /path/to/minecraft-skin-server && ./deploy/start-linux.sh

set -e

# Navigate to project root (parent of deploy/)
cd "$(dirname "$0")/.." || exit 1
PROJECT_ROOT=$(pwd)

echo "========================================"
echo "  Minecraft Skin Server - Linux Startup"
echo "  Project root: $PROJECT_ROOT"
echo "========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install Node.js 18+"
    echo "Install: sudo apt install nodejs npm"
    exit 1
fi

# Check .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "[INFO] Created .env from .env.example (SQLite default)"
    else
        echo "DB_TYPE=sqlite" > .env
        echo "DB_PATH=./data/skin_server.db" >> .env
        echo "[INFO] Created default .env with SQLite"
    fi
fi

# Read database type
DB_TYPE=$(grep "^DB_TYPE" .env | cut -d'=' -f2 | tr -d ' ')
if [ -z "$DB_TYPE" ]; then
    DB_TYPE="sqlite"
fi

echo "[INFO] Database type: $DB_TYPE"

# Check database connection
if [ "$DB_TYPE" = "postgres" ]; then
    echo "[INFO] Checking PostgreSQL connection..."
    # shellcheck disable=SC2016
    node -e '
    const {Pool}=require("pg");
    const p=new Pool({host:process.env.DB_HOST||"localhost",port:parseInt(process.env.DB_PORT||"5432"),database:process.env.DB_DATABASE||"skin_server",user:process.env.DB_USER||"postgres",password:process.env.DB_PASSWORD||""});
    p.query("SELECT 1",(e)=>{if(e){console.error("[ERROR] PostgreSQL connection failed:",e.message);process.exit(1);}else{console.log("[OK] PostgreSQL connected");process.exit(0);}});
    '
    if [ $? -ne 0 ]; then
        echo "[ERROR] PostgreSQL connection failed. Set DB_TYPE=sqlite to use local SQLite instead."
        exit 1
    fi
else
    echo "[INFO] Checking SQLite setup..."
    DB_PATH=$(grep "^DB_PATH" .env | cut -d'=' -f2 | tr -d ' ')
    if [ -z "$DB_PATH" ]; then
        DB_PATH="./data/skin_server.db"
    fi
    DB_DIR=$(dirname "$DB_PATH")
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"
        echo "[INFO] Created data directory: $DB_DIR"
    fi
    echo "[INFO] SQLite database path: $DB_PATH"
fi

# Install backend dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing backend dependencies..."
    npm install
fi

# Install frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    (cd frontend && npm install)
fi

# Generate RSA keys
if [ ! -f "keys/private.pem" ]; then
    echo "[INFO] Generating RSA key pair..."
    npm run generate-keys
fi

# Run database migration
echo "[INFO] Running database migrations..."
npm run migrate

# Start servers
echo ""
echo "========================================"
echo "  Starting development servers..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo "========================================"
echo ""

# Start frontend in background
npm run dev --prefix frontend &
FRONTEND_PID=$!
sleep 3

# Start backend
npm run dev

# Keep running
wait $FRONTEND_PID
