# main.py
import sqlite3
import json, time
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

# --- Configuration ---
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY" # Make sure to paste your actual key here!

# Initialize the new genai client
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect('bugs.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS bugs (
            id TEXT PRIMARY KEY,
            title TEXT,
            priority TEXT,
            status TEXT,
            lang TEXT,
            desc TEXT,
            assignee TEXT,
            created TEXT,
            code TEXT
        )
    ''')
    
    # Seed initial data if empty
    c.execute('SELECT COUNT(*) FROM bugs')
    if c.fetchone()[0] == 0:
        seed_data = [
            ('BUG-001', 'fetchUserData: .json() never called on Response', 'critical', 'open', 'JavaScript', 'The fetch() API is called but the response is never parsed...', '@frontend-team', '2026-03-08', 'function fetchUserData(userId) {\n  fetch("/api/users/" + userId)\n    .then(data => console.log(data))\n}'),
            ('BUG-002', 'divide() throws exception instead of returning error', 'high', 'in-progress', 'Python', 'The divide function crashes with ZeroDivisionError...', '@backend-team', '2026-03-09', 'def divide(a, b):\n    result = a / b\n    return result\n\nprint(divide(10, 0))')
        ]
        c.executemany('INSERT INTO bugs VALUES (?,?,?,?,?,?,?,?,?)', seed_data)
    
    conn.commit()
    conn.close()

init_db()

# --- Pydantic Models ---
class BugCreate(BaseModel):
    title: str
    priority: str
    status: str
    lang: str
    desc: str
    assignee: str
    code: str

class AnalyzeRequest(BaseModel):
    bug_id: str

class DetectRequest(BaseModel):
    code: str
    desc: str

# --- API Endpoints ---
def get_db():
    conn = sqlite3.connect('bugs.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/api/bugs")
def get_bugs():
    conn = get_db()
    bugs = conn.execute('SELECT * FROM bugs ORDER BY id DESC').fetchall()
    conn.close()
    return [dict(bug) for bug in bugs]

@app.post("/api/bugs")
def create_bug(bug: BugCreate):
    conn = get_db()
    # Generate ID based on count
    count = conn.execute('SELECT COUNT(*) FROM bugs').fetchone()[0]
    new_id = f"BUG-{str(count + 1).zfill(3)}"
    created_date = datetime.now().strftime("%Y-%m-%d")
    
    conn.execute('''
        INSERT INTO bugs (id, title, priority, status, lang, desc, assignee, created, code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (new_id, bug.title, bug.priority, bug.status, bug.lang, bug.desc, bug.assignee, created_date, bug.code))
    conn.commit()
    conn.close()
    return {"id": new_id, "message": "Bug created successfully"}

@app.put("/api/bugs/{bug_id}/close")
def close_bug(bug_id: str):
    conn = get_db()
    conn.execute('UPDATE bugs SET status = "closed" WHERE id = ?', (bug_id,))
    conn.commit()
    conn.close()
    return {"message": "Bug closed"}

@app.delete("/api/bugs/{bug_id}")
def delete_bug(bug_id: str):
    conn = get_db()
    conn.execute('DELETE FROM bugs WHERE id = ?', (bug_id,))
    conn.commit()
    conn.close()
    return {"message": "Bug deleted"}

@app.post("/api/detect")
def detect_code(req: DetectRequest):
    prompt = f"""
    Analyze the following code snippet and bug description.
    Description: {req.desc}
    Code: {req.code}
    
    Determine:
    1. The exact programming language or framework used (e.g., 'React', 'Ruby on Rails', 'Go', 'Rust', 'Swift', 'Bash', etc.).
    2. The bug priority. It MUST be exactly one of: 'low', 'medium', 'high', 'critical'. 
       - 'critical' for security risks (SQLi, exposed keys), data loss, or server crashes.
       - 'high' for broken core features or unhandled exceptions.
       - 'medium' for UI bugs or standard logic errors.
       - 'low' for typos, bad formatting, or unused variables.
    
    Provide your response as a valid JSON object with these EXACT keys:
    "lang" (string)
    "priority" (string)
    """
    
    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            if attempt == max_retries - 1:
                # If AI detection fails, fail silently so we don't crash the user's typing experience
                return {"lang": "Unknown", "priority": "medium"}
            time.sleep(1)

@app.post("/api/analyze")
def analyze_code(req: AnalyzeRequest):
    conn = get_db()
    bug = conn.execute('SELECT * FROM bugs WHERE id = ?', (req.bug_id,)).fetchone()
    conn.close()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
        
    prompt = f"""
    You are an expert code reviewer and debugger.
    Bug Title: {bug['title']}
    Language: {bug['lang']}
    Description: {bug['desc']}
    
    Buggy Code:
    {bug['code']}
    
    Analyze the code. Provide your response as a valid JSON object with these EXACT keys:
    "whatIsWrong" (string: explanation of the error)
    "howToFix" (string: step-by-step fix)
    "fixedCode" (string: the complete corrected code)
    "improvements" (string: additional best practices)
    """
    
    # Retry logic: Try up to 3 times before failing
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Upgraded to the new Gemini 3 Flash model
            response = client.models.generate_content(
                model='gemini-3-flash-preview',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
            
        except Exception as e:
            error_msg = str(e)
            # If it's a 503 or 429 (rate limit), we wait and try again
            if ("503" in error_msg or "429" in error_msg) and attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Waits 1s, then 2s
                print(f"API busy. Retrying in {wait_time} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                # If it's a different error, or we ran out of retries, we crash gracefully
                print(f"Final error during analysis: {error_msg}") 
                raise HTTPException(status_code=500, detail=error_msg)
