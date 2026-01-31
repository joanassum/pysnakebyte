# Python Tutorial Website

A comprehensive Python learning platform with 105 lessons, 25 code challenges, and Docker-based sandbox code execution.

**Live Demo:** [https://pysnakebyte.com/](https://pysnakebyte.com/)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support%20my%20work-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/joanassum)

## Features

- **105 Interactive Lessons** - From beginner basics to advanced topics
- **25 Code Challenges** - Test your skills with automated testing
- **Docker Sandbox** - Secure Python code execution environment
- **Modern React Frontend** - Monaco Editor for code editing
- **FastAPI Backend** - High-performance API

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Run the Application

**Option 1: Use the start script (recommended)**
```bash
./start.sh
```

**Option 2: Manual steps**
```bash
# 1. Make sure Docker Desktop is running first!

# 2. Build the sandbox image
docker build --tag python-sandbox ./sandbox

# 3. Start all services
docker compose up --build
```

**Access the application:**
- Frontend: http://localhost:8083
- Backend API: http://localhost:8084

## Project Structure

```
├── backend/                 # FastAPI backend
│   ├── app/
│   │   └── main.py         # API endpoints
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.js         # Main React app
│   │   ├── index.js
│   │   └── index.css      # Styles
│   ├── public/
│   ├── Dockerfile
│   └── nginx.conf
├── sandbox/                # Python sandbox
│   └── Dockerfile         # Secure execution environment
├── lessons/               # 105 lesson JSON files
│   └── lessons.json       # Lesson index
├── challenges/            # 25 challenge JSON files
│   └── challenges.json    # Challenge index
└── docker-compose.yml
```

## Lesson Categories

| Category | Lessons | Topics |
|----------|---------|--------|
| Python Basics | 15 | Syntax, variables, operators, I/O |
| Data Types | 12 | Strings, lists, dicts, sets, tuples |
| Control Flow | 10 | Conditionals, loops, patterns |
| Functions | 12 | Parameters, scope, lambda, recursion |
| Modules | 8 | Imports, packages, pip, venv |
| OOP | 15 | Classes, inheritance, magic methods |
| File Handling | 8 | Read/write, CSV, JSON, paths |
| Error Handling | 6 | Try/except, custom exceptions |
| Advanced | 14 | Decorators, generators, async, testing |
| Projects | 5 | Calculator, web scraping, Flask |

## Code Challenges

- **Easy (8)**: Hello World, Sum Numbers, Even/Odd, Reverse String, etc.
- **Medium (10)**: FizzBuzz, Prime Check, Binary Search, etc.
- **Hard (7)**: Quick Sort, LRU Cache, Sudoku Validator, etc.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lessons` | List all lessons |
| GET | `/api/lessons/{id}` | Get specific lesson |
| GET | `/api/challenges` | List all challenges |
| GET | `/api/challenges/{id}` | Get specific challenge |
| POST | `/api/execute` | Execute Python code |
| POST | `/api/challenges/{id}/submit` | Submit challenge solution |

## Development

### Run Backend Locally
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Run Frontend Locally
```bash
cd frontend
npm install
npm start
```

## Security

The sandbox container runs with:
- Non-root user
- Memory limit (128MB)
- CPU limit (50%)
- Network disabled
- Read-only filesystem
- Execution timeout (10s default)

## License

MIT
