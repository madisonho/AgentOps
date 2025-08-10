#!/bin/bash

# AgentOps Development Startup Script
# This script starts both the frontend and backend servers

echo "🚀 Starting AgentOps Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Install dependencies if needed
echo "📦 Checking dependencies..."

# Frontend dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Backend dependencies
if [ ! -f "server-package.json" ]; then
    echo "❌ Backend package.json not found. Creating it..."
    cp server-package.json server-package.json.bak 2>/dev/null || true
fi

# Start backend server
echo "🔧 Starting backend server on http://localhost:3001..."
node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Backend server failed to start. Check the logs above."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend server is running!"

# Start frontend server
echo "🎨 Starting frontend server on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

echo ""
echo "🎉 AgentOps is now running!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo "📊 API Docs: http://localhost:3001/api"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user to stop
wait
