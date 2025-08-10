#!/bin/bash

echo "🚀 Starting AgentOps Frontend & Backend..."

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping servers..."
    pkill -f "node server.js"
    pkill -f "npm run dev"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend server
echo "📡 Starting backend server on http://localhost:3001..."
node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend server is running"
else
    echo "❌ Backend server failed to start"
    cleanup
fi

# Start frontend server
echo "🌐 Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Check if frontend is running
if curl -s http://localhost:5174 > /dev/null; then
    echo "✅ Frontend server is running"
else
    echo "❌ Frontend server failed to start"
    cleanup
fi

echo ""
echo "🎉 Both servers are running!"
echo "📱 Frontend: http://localhost:5174"
echo "🔌 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait
