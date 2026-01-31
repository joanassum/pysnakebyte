from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import docker
import json
from typing import Optional
from pathlib import Path

app = FastAPI(title="Python Tutorial API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Docker client
docker_client = docker.from_env()

# Paths - Use /app for Docker, fallback for local dev
APP_DIR = Path("/app")
if APP_DIR.exists():
    LESSONS_DIR = APP_DIR / "lessons"
    CHALLENGES_DIR = APP_DIR / "challenges"
else:
    BASE_DIR = Path(__file__).parent.parent.parent
    LESSONS_DIR = BASE_DIR / "lessons"
    CHALLENGES_DIR = BASE_DIR / "challenges"


class CodeRequest(BaseModel):
    code: str
    timeout: int = 10


class CodeResponse(BaseModel):
    output: str
    error: Optional[str] = None
    success: bool


class ChallengeSubmission(BaseModel):
    code: str
    challenge_id: str


@app.get("/")
async def root():
    return {"message": "Python Tutorial API"}


@app.post("/api/execute", response_model=CodeResponse)
async def execute_code(request: CodeRequest):
    """Execute Python code in a sandboxed Docker container"""
    try:
        container = docker_client.containers.run(
            "python-sandbox",
            command=["python3", "-c", request.code],
            detach=True,
            mem_limit="128m",
            cpu_period=100000,
            cpu_quota=50000,
            network_disabled=True,
            read_only=True,
            user="sandbox",
            remove=False,
        )
        
        try:
            result = container.wait(timeout=request.timeout)
            logs = container.logs(stdout=True, stderr=True).decode("utf-8")
            exit_code = result.get("StatusCode", 1)
            
            container.remove()
            
            if exit_code == 0:
                return CodeResponse(output=logs, success=True)
            else:
                return CodeResponse(output="", error=logs, success=False)
                
        except Exception as e:
            container.kill()
            container.remove()
            return CodeResponse(
                output="",
                error=f"Execution timeout ({request.timeout}s exceeded)",
                success=False
            )
            
    except docker.errors.ImageNotFound:
        raise HTTPException(
            status_code=500,
            detail="Sandbox image not found. Run: docker build -t python-sandbox ./sandbox"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== COURSES API ==========

@app.get("/api/courses")
async def get_courses():
    """Get all available courses"""
    courses_file = LESSONS_DIR / "courses.json"
    if courses_file.exists():
        with open(courses_file) as f:
            return json.load(f)
    return {"courses": []}


@app.get("/api/courses/{course_id}")
async def get_course(course_id: str):
    """Get a specific course with its lessons"""
    courses_file = LESSONS_DIR / "courses.json"
    if courses_file.exists():
        with open(courses_file) as f:
            courses = json.load(f)
            for course in courses.get("courses", []):
                if course["id"] == course_id:
                    # Load lessons for this course
                    lessons_file = LESSONS_DIR / course_id / "lessons.json"
                    if lessons_file.exists():
                        with open(lessons_file) as lf:
                            course["lessons"] = json.load(lf)
                    return course
    raise HTTPException(status_code=404, detail="Course not found")


@app.get("/api/courses/{course_id}/lessons")
async def get_course_lessons(course_id: str):
    """Get all lessons for a course organized by category"""
    lessons_file = LESSONS_DIR / course_id / "lessons.json"
    if lessons_file.exists():
        with open(lessons_file) as f:
            return json.load(f)
    return {"categories": []}


@app.get("/api/courses/{course_id}/lessons/{lesson_id}")
async def get_course_lesson(course_id: str, lesson_id: str):
    """Get a specific lesson from a course"""
    lesson_file = LESSONS_DIR / course_id / f"{lesson_id}.json"
    if lesson_file.exists():
        with open(lesson_file) as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Lesson not found")


# ========== LEGACY LESSONS API (for backwards compatibility) ==========

@app.get("/api/lessons")
async def get_lessons():
    """Get all lessons (legacy - returns python-basics course)"""
    return await get_course_lessons("python-basics")


@app.get("/api/lessons/{lesson_id}")
async def get_lesson(lesson_id: str):
    """Get a specific lesson (legacy - searches in python-basics)"""
    return await get_course_lesson("python-basics", lesson_id)


# ========== CHALLENGES API ==========

@app.get("/api/challenges")
async def get_challenges():
    """Get all challenges"""
    challenges_file = CHALLENGES_DIR / "challenges.json"
    if challenges_file.exists():
        with open(challenges_file) as f:
            return json.load(f)
    return {"challenges": []}


@app.get("/api/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    """Get a specific challenge"""
    challenge_file = CHALLENGES_DIR / f"{challenge_id}.json"
    if challenge_file.exists():
        with open(challenge_file) as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Challenge not found")


@app.post("/api/challenges/{challenge_id}/submit")
async def submit_challenge(challenge_id: str, submission: ChallengeSubmission):
    """Submit a solution for a challenge and run tests"""
    challenge_file = CHALLENGES_DIR / f"{challenge_id}.json"
    if not challenge_file.exists():
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    with open(challenge_file) as f:
        challenge = json.load(f)
    
    test_code = challenge.get("test_code", "")
    full_code = f"{submission.code}\n\n{test_code}"
    
    result = await execute_code(CodeRequest(code=full_code, timeout=15))
    
    return {
        "passed": result.success and "PASSED" in result.output,
        "output": result.output,
        "error": result.error
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
