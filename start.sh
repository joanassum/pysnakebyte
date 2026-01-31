#!/bin/bash

# Python Tutorial Website - Startup Script

set -e

echo "=== Python Tutorial Website Setup ==="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "[1/3] Building Python sandbox image..."
docker build --tag python-sandbox ./sandbox

echo ""
echo "[2/3] Building and starting services..."
docker compose up --build -d

echo ""
echo "[3/3] Done!"
echo ""
echo "=== Application is running ==="
echo "Frontend: http://localhost:8083"
echo "Backend API: http://localhost:8084"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
