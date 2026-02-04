from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks, Depends, Header
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
from urllib.parse import parse_qsl
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import httpx
import pytz
import asyncpg

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

def find_frontend_build_dir() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[1] / "frontend" / "build",
        here.parents[0] / "frontend" / "build",
        here.parents[0] / "frontend_build",
        here.parents[0] / "frontend" / "build",
        Path.cwd() / "frontend" / "build",
        Path.cwd() / "frontend_build",
    ]
    for p in candidates:
        if (p / "index.html").exists() and (p / "static").exists():
            return p
    return None

FRONTEND_BUILD_DIR = find_frontend_build_dir()

DATABASE_URL = os.environ.get('DATABASE_URL', '')
db_pool: Optional[asyncpg.Pool] = None

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.environ.get('TELEGRAM_BOT_USERNAME', 'Friendorbitbot')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'default_secret')
WEBAPP_URL = os.environ.get('WEBAPP_URL', 'https://7c53df09-4f93-499e-9ad6-5e9a49c48841-00-1jbjv48khbbn7.pike.replit.dev')

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', WEBAPP_URL).split(',') if o.strip()]

app = FastAPI()
api_router = APIRouter(prefix="/api")
scheduler = AsyncIOScheduler()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def serialize_row(row) -> Dict:
    """Convert asyncpg Record to JSON-serializable dict"""
    if row is None:
        return None
    result = dict(row)
    for key, value in result.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
    return result

async def init_db():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    
    async with db_pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                telegram_id TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                avatar_url TEXT,
                timezone TEXT DEFAULT 'Asia/Kolkata',
                inner_circle_size INTEGER DEFAULT 6,
                drift_strictness TEXT DEFAULT 'normal',
                onboarded BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_battery INTEGER,
                last_battery_at TIMESTAMPTZ
            )
        ''')
        
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS people (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                relationship_subtype TEXT,
                archetype TEXT DEFAULT 'Anchor',
                cadence_days INTEGER DEFAULT 7,
                tags TEXT[] DEFAULT '{}',
                pinned BOOLEAN DEFAULT FALSE,
                archived BOOLEAN DEFAULT FALSE,
                gravity_score REAL DEFAULT 80.0,
                last_interaction TIMESTAMPTZ,
                telegram_user_id TEXT,
                connected BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS meteors (
                id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL REFERENCES people(id),
                user_id TEXT NOT NULL REFERENCES users(id),
                content TEXT NOT NULL,
                tag TEXT,
                due_date TEXT,
                done BOOLEAN DEFAULT FALSE,
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS battery_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                score INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')
        
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS invites (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                inviter_id TEXT NOT NULL REFERENCES users(id),
                person_id TEXT NOT NULL REFERENCES people(id),
                status TEXT DEFAULT 'pending',
                invitee_telegram_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            )
        ''')
    
    logger.info("Database initialized successfully")

async def get_current_user(request: Request, x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> Dict:
    uid = x_user_id or request.query_params.get('user_id')
    if not uid:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", uid)
        if not row:
            raise HTTPException(status_code=401, detail="Invalid user")
        return dict(row)

async def verify_resource_ownership(table: str, resource_id: str, user_id: str) -> Dict:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(f"SELECT * FROM {table} WHERE id = $1", resource_id)
        if not row:
            raise HTTPException(status_code=404, detail="Resource not found")
        resource = dict(row)
        if resource.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return resource

def get_user_local_date(user_timezone: str) -> datetime.date:
    try:
        tz = pytz.timezone(user_timezone)
    except:
        tz = pytz.timezone('Asia/Kolkata')
    return datetime.now(tz).date()

class UserCreate(BaseModel):
    telegram_id: str
    display_name: str
    avatar_url: Optional[str] = None
    timezone: str = "Asia/Kolkata"

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    inner_circle_size: Optional[int] = None
    drift_strictness: Optional[str] = None

class PersonCreate(BaseModel):
    name: str
    relationship_type: str
    relationship_subtype: Optional[str] = None
    archetype: Optional[str] = None
    cadence_days: int = 7
    tags: List[str] = []
    pinned: bool = False

class PersonUpdate(BaseModel):
    name: Optional[str] = None
    archetype: Optional[str] = None
    cadence_days: Optional[int] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None

class MeteorCreate(BaseModel):
    person_id: str
    content: str
    tag: Optional[str] = None
    due_date: Optional[str] = None

class MeteorUpdate(BaseModel):
    content: Optional[str] = None
    tag: Optional[str] = None
    done: Optional[bool] = None
    archived: Optional[bool] = None

async def send_telegram_message(chat_id: str, text: str, reply_markup: Optional[Dict] = None):
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("No Telegram bot token configured")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = json.dumps(reply_markup)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send Telegram message: {e}")

def validate_telegram_init_data(init_data: str) -> Optional[Dict]:
    if not TELEGRAM_BOT_TOKEN:
        return None
    
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        hash_value = parsed.pop('hash', '')
        data_check_string = '\n'.join(f'{k}={v}' for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b'WebAppData', TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash == hash_value:
            user_data = json.loads(parsed.get('user', '{}'))
            return user_data
    except Exception as e:
        logger.error(f"Failed to validate init data: {e}")
    
    return None

def calculate_gravity_decay(person: Dict, user_strictness: str = 'normal') -> float:
    base_score = person.get('gravity_score', 80.0)
    last_interaction = person.get('last_interaction')
    relationship_type = person.get('relationship_type', 'friend')
    archetype = person.get('archetype', 'Anchor')
    pinned = person.get('pinned', False)
    
    if pinned:
        return base_score
    
    if not last_interaction:
        return base_score
    
    if isinstance(last_interaction, str):
        last_interaction = datetime.fromisoformat(last_interaction.replace('Z', '+00:00'))
    
    days_since = (datetime.now(timezone.utc) - last_interaction).days
    
    relationship_decay = {'partner': 1.0, 'family': 2.0, 'friend': 3.0}
    archetype_multiplier = {'Anchor': 0.8, 'Sage': 0.9, 'Spark': 1.2, 'Comet': 0.5}
    strictness_multiplier = {'gentle': 0.6, 'normal': 1.0, 'strict': 1.5}
    
    base_decay = relationship_decay.get(relationship_type, 3.0)
    arch_mult = archetype_multiplier.get(archetype, 1.0)
    strict_mult = strictness_multiplier.get(user_strictness, 1.0)
    
    daily_decay = base_decay * arch_mult * strict_mult
    new_score = max(0, base_score - (days_since * daily_decay))
    
    return round(new_score, 1)

def get_orbit_zone(gravity_score: float) -> str:
    if gravity_score >= 80:
        return "inner"
    elif gravity_score >= 40:
        return "goldilocks"
    else:
        return "outer"

async def run_gravity_decay():
    logger.info("Running gravity decay job...")
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM people WHERE archived = FALSE")
            for row in rows:
                person = dict(row)
                user_row = await conn.fetchrow("SELECT drift_strictness FROM users WHERE id = $1", person['user_id'])
                strictness = user_row['drift_strictness'] if user_row else 'normal'
                
                new_score = calculate_gravity_decay(person, strictness)
                if new_score != person.get('gravity_score'):
                    await conn.execute("UPDATE people SET gravity_score = $1 WHERE id = $2", new_score, person['id'])
        logger.info("Gravity decay job completed")
    except Exception as e:
        logger.error(f"Gravity decay job failed: {e}")

def get_suggestions(user: Dict, people: List[Dict], battery_score: int) -> List[Dict]:
    sorted_people = sorted(people, key=lambda p: p.get('gravity_score', 100))
    
    if battery_score <= 20:
        count = 1
    elif battery_score <= 50:
        count = 2
    else:
        count = 3
    
    suggestions = []
    for person in sorted_people[:count]:
        suggestions.append({
            "id": person['id'],
            "name": person['name'],
            "gravity_score": person.get('gravity_score', 0),
            "orbit_zone": get_orbit_zone(person.get('gravity_score', 0)),
            "reason": "Drifting - last interaction was a while ago"
        })
    
    return suggestions

@api_router.get("/")
async def root():
    return {"message": "Friend Orbit API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.post("/users", response_model=Dict)
async def create_user(user_data: UserCreate):
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", user_data.telegram_id)
        if existing:
            return dict(existing)
        
        user_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO users (id, telegram_id, display_name, avatar_url, timezone)
               VALUES ($1, $2, $3, $4, $5)""",
            user_id, user_data.telegram_id, user_data.display_name, user_data.avatar_url, user_data.timezone
        )
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row)

@api_router.get("/users/{telegram_id}", response_model=Dict)
async def get_user(telegram_id: str):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)

@api_router.patch("/users/{user_id}", response_model=Dict)
async def update_user(user_id: str, update_data: UserUpdate):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    async with db_pool.acquire() as conn:
        set_clause = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(update_dict.keys())])
        values = [user_id] + list(update_dict.values())
        result = await conn.execute(f"UPDATE users SET {set_clause} WHERE id = $1", *values)
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="User not found")
        
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        return dict(row)

@api_router.post("/users/{user_id}/onboard", response_model=Dict)
async def complete_onboarding(user_id: str):
    async with db_pool.acquire() as conn:
        await conn.execute("UPDATE users SET onboarded = TRUE WHERE id = $1", user_id)
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(row)

@api_router.delete("/users/{user_id}/data")
async def delete_all_user_data(user_id: str):
    """Delete all data for a user (people, meteors, battery logs, invites) and reset user"""
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        people_ids = await conn.fetch("SELECT id FROM people WHERE user_id = $1", user_id)
        person_ids = [r['id'] for r in people_ids]
        
        if person_ids:
            await conn.execute("DELETE FROM meteors WHERE person_id = ANY($1::text[])", person_ids)
            await conn.execute("DELETE FROM invites WHERE person_id = ANY($1::text[])", person_ids)
        
        await conn.execute("DELETE FROM meteors WHERE user_id = $1", user_id)
        await conn.execute("DELETE FROM battery_logs WHERE user_id = $1", user_id)
        await conn.execute("DELETE FROM invites WHERE inviter_id = $1", user_id)
        await conn.execute("DELETE FROM people WHERE user_id = $1", user_id)
        
        await conn.execute("""
            UPDATE users SET 
                onboarded = FALSE, 
                last_battery = NULL, 
                last_battery_at = NULL 
            WHERE id = $1
        """, user_id)
        
        logger.info(f"Deleted all data for user {user_id}")
        return {"message": "All data deleted successfully", "user_id": user_id}

@api_router.delete("/users/telegram/{telegram_id}/data")
async def delete_user_data_by_telegram_id(telegram_id: str):
    """Delete all data for a user by their Telegram ID"""
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", str(telegram_id))
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = user['id']
        people_ids = await conn.fetch("SELECT id FROM people WHERE user_id = $1", user_id)
        person_ids = [r['id'] for r in people_ids]
        
        if person_ids:
            await conn.execute("DELETE FROM meteors WHERE person_id = ANY($1::text[])", person_ids)
            await conn.execute("DELETE FROM invites WHERE person_id = ANY($1::text[])", person_ids)
        
        await conn.execute("DELETE FROM meteors WHERE user_id = $1", user_id)
        await conn.execute("DELETE FROM battery_logs WHERE user_id = $1", user_id)
        await conn.execute("DELETE FROM invites WHERE inviter_id = $1", user_id)
        await conn.execute("DELETE FROM people WHERE user_id = $1", user_id)
        
        await conn.execute("""
            UPDATE users SET 
                onboarded = FALSE, 
                last_battery = NULL, 
                last_battery_at = NULL 
            WHERE id = $1
        """, user_id)
        
        logger.info(f"Deleted all data for user {user_id} (telegram_id: {telegram_id})")
        return {"message": "All data deleted successfully", "telegram_id": telegram_id}

@api_router.post("/people", response_model=Dict)
async def create_person(person_data: PersonCreate, current_user: Dict = Depends(get_current_user)):
    user_id = current_user['id']
    
    async with db_pool.acquire() as conn:
        if person_data.relationship_type == "partner":
            existing = await conn.fetchrow(
                "SELECT id FROM people WHERE user_id = $1 AND relationship_type = 'partner' AND archived = FALSE",
                user_id
            )
            if existing:
                raise HTTPException(status_code=400, detail="You can only have one active partner")
        
        person_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO people (id, user_id, name, relationship_type, relationship_subtype, archetype, cadence_days, tags, pinned)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            person_id, user_id, person_data.name, person_data.relationship_type,
            person_data.relationship_subtype, person_data.archetype or 'Anchor',
            person_data.cadence_days, person_data.tags, person_data.pinned
        )
        
        if not current_user.get('onboarded'):
            await conn.execute("UPDATE users SET onboarded = TRUE WHERE id = $1", user_id)
            logger.info(f"User {user_id} auto-onboarded after adding first person")
        
        row = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        result = dict(row)
        result['orbit_zone'] = get_orbit_zone(result.get('gravity_score', 80))
        return result

@api_router.get("/people", response_model=List[Dict])
async def get_people(current_user: Dict = Depends(get_current_user), include_archived: bool = False):
    user_id = current_user['id']
    
    async with db_pool.acquire() as conn:
        if include_archived:
            rows = await conn.fetch("SELECT * FROM people WHERE user_id = $1", user_id)
        else:
            rows = await conn.fetch("SELECT * FROM people WHERE user_id = $1 AND archived = FALSE", user_id)
        
        people = []
        for row in rows:
            person = dict(row)
            person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
            if person.get('tags') is None:
                person['tags'] = []
            people.append(person)
        return people

@api_router.get("/people/{person_id}", response_model=Dict)
async def get_person(person_id: str, user_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        if not row:
            raise HTTPException(status_code=404, detail="Person not found")
        person = dict(row)
        person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
        if person.get('tags') is None:
            person['tags'] = []
        return person

@api_router.patch("/people/{person_id}", response_model=Dict)
async def update_person(person_id: str, update_data: PersonUpdate, user_id: Optional[str] = None):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Person not found")
        
        set_clause = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(update_dict.keys())])
        values = [person_id] + list(update_dict.values())
        await conn.execute(f"UPDATE people SET {set_clause} WHERE id = $1", *values)
        
        row = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        person = dict(row)
        person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
        return person

@api_router.post("/people/{person_id}/interaction", response_model=Dict)
async def log_interaction(person_id: str, user_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        if not row:
            raise HTTPException(status_code=404, detail="Person not found")
        person = dict(row)
    
    new_score = min(100, person.get('gravity_score', 50) + 20)
    now = datetime.now(timezone.utc)
    
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE people SET gravity_score = $1, last_interaction = $2 WHERE id = $3",
            new_score, now, person_id
        )
        row = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        updated = dict(row)
        updated['orbit_zone'] = get_orbit_zone(updated.get('gravity_score', 0))
        return updated

@api_router.delete("/people/{person_id}")
async def archive_person(person_id: str, user_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM people WHERE id = $1", person_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Person not found")
        await conn.execute("UPDATE people SET archived = TRUE WHERE id = $1", person_id)
    return {"message": "Person archived", "id": person_id}

@api_router.post("/meteors", response_model=Dict)
async def create_meteor(meteor_data: MeteorCreate, user_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        person = await conn.fetchrow("SELECT id, user_id FROM people WHERE id = $1", meteor_data.person_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        owner_id = person['user_id']
        if user_id and user_id != owner_id:
            raise HTTPException(status_code=403, detail="Cannot add meteor to someone else's person")
        
        meteor_id = str(uuid.uuid4())
        await conn.execute(
            """INSERT INTO meteors (id, person_id, user_id, content, tag, due_date)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            meteor_id, meteor_data.person_id, owner_id, meteor_data.content, meteor_data.tag, meteor_data.due_date
        )
        row = await conn.fetchrow("SELECT * FROM meteors WHERE id = $1", meteor_id)
        return dict(row)

@api_router.get("/meteors", response_model=List[Dict])
async def get_meteors(user_id: Optional[str] = None, person_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        if person_id:
            person = await conn.fetchrow("SELECT user_id FROM people WHERE id = $1", person_id)
            if not person:
                return []
            rows = await conn.fetch(
                "SELECT * FROM meteors WHERE person_id = $1 AND archived = FALSE",
                person_id
            )
        elif user_id:
            rows = await conn.fetch("SELECT * FROM meteors WHERE user_id = $1 AND archived = FALSE", user_id)
        else:
            rows = []
        return [dict(row) for row in rows]

@api_router.patch("/meteors/{meteor_id}", response_model=Dict)
async def update_meteor(meteor_id: str, update_data: MeteorUpdate, user_id: Optional[str] = None):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM meteors WHERE id = $1", meteor_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Meteor not found")
        
        set_clause = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(update_dict.keys())])
        values = [meteor_id] + list(update_dict.values())
        await conn.execute(f"UPDATE meteors SET {set_clause} WHERE id = $1", *values)
        
        row = await conn.fetchrow("SELECT * FROM meteors WHERE id = $1", meteor_id)
        return dict(row)

@api_router.delete("/meteors/{meteor_id}")
async def archive_meteor(meteor_id: str, user_id: Optional[str] = None):
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM meteors WHERE id = $1", meteor_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Meteor not found")
        await conn.execute("UPDATE meteors SET archived = TRUE WHERE id = $1", meteor_id)
    return {"message": "Meteor archived", "id": meteor_id}

@api_router.post("/battery", response_model=Dict)
async def log_battery(score: int, user_id: Optional[str] = None):
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if not 0 <= score <= 100:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 100")
    
    now = datetime.now(timezone.utc)
    
    async with db_pool.acquire() as conn:
        user_check = await conn.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
        if not user_check:
            raise HTTPException(status_code=404, detail="User not found")
        
        await conn.execute(
            "UPDATE users SET last_battery = $1, last_battery_at = $2 WHERE id = $3",
            score, now, user_id
        )
        
        battery_id = str(uuid.uuid4())
        await conn.execute(
            "INSERT INTO battery_logs (id, user_id, score) VALUES ($1, $2, $3)",
            battery_id, user_id, score
        )
        
        user_row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        user = dict(user_row) if user_row else {}
        
        rows = await conn.fetch(
            "SELECT * FROM people WHERE user_id = $1 AND archived = FALSE",
            user_id
        )
        people = [dict(row) for row in rows]
        suggestions = get_suggestions(user, people, score)
        
        return {
            "score": score,
            "logged_at": now.isoformat(),
            "suggestions": suggestions
        }

@api_router.get("/battery/{user_id}", response_model=Dict)
async def get_battery_by_user_id(user_id: str):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        user = dict(row)
    
    last_battery = user.get('last_battery')
    last_battery_at = user.get('last_battery_at')
    user_tz = user.get('timezone', 'Asia/Kolkata')
    
    today_local = get_user_local_date(user_tz)
    needs_update = True
    
    if last_battery_at:
        try:
            if isinstance(last_battery_at, str):
                last_dt = datetime.fromisoformat(last_battery_at.replace('Z', '+00:00'))
            else:
                last_dt = last_battery_at
            tz = pytz.timezone(user_tz)
            last_logged_local = last_dt.astimezone(tz).date()
            needs_update = last_logged_local != today_local
        except:
            needs_update = True
    
    suggestions = []
    if last_battery is not None:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM people WHERE user_id = $1 AND archived = FALSE",
                user_id
            )
            people = [dict(row) for row in rows]
            suggestions = get_suggestions(user, people, last_battery)
    
    return {
        "score": last_battery,
        "logged_at": last_battery_at.isoformat() if isinstance(last_battery_at, datetime) else last_battery_at,
        "needs_update": needs_update,
        "suggestions": suggestions
    }

@api_router.get("/battery", response_model=Dict)
async def get_battery(current_user: Dict = Depends(get_current_user)):
    user_id = current_user['id']
    last_battery = current_user.get('last_battery')
    last_battery_at = current_user.get('last_battery_at')
    user_tz = current_user.get('timezone', 'Asia/Kolkata')
    
    today_local = get_user_local_date(user_tz)
    needs_update = True
    
    if last_battery_at:
        try:
            if isinstance(last_battery_at, str):
                last_dt = datetime.fromisoformat(last_battery_at.replace('Z', '+00:00'))
            else:
                last_dt = last_battery_at
            tz = pytz.timezone(user_tz)
            last_logged_local = last_dt.astimezone(tz).date()
            needs_update = last_logged_local != today_local
        except:
            needs_update = True
    
    suggestions = []
    if last_battery is not None:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM people WHERE user_id = $1 AND archived = FALSE",
                user_id
            )
            people = [dict(row) for row in rows]
            suggestions = get_suggestions(current_user, people, last_battery)
    
    return {
        "score": last_battery,
        "logged_at": last_battery_at.isoformat() if isinstance(last_battery_at, datetime) else last_battery_at,
        "needs_update": needs_update,
        "suggestions": suggestions
    }

@api_router.post("/invites", response_model=Dict)
async def create_invite(person_id: str, current_user: Dict = Depends(get_current_user)):
    user_id = current_user['id']
    
    async with db_pool.acquire() as conn:
        person = await conn.fetchrow("SELECT * FROM people WHERE id = $1 AND user_id = $2", person_id, user_id)
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        if person['connected']:
            raise HTTPException(status_code=400, detail="Person is already connected")
        
        token = str(uuid.uuid4())[:12]
        invite_id = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await conn.execute(
            """INSERT INTO invites (id, token, inviter_id, person_id, expires_at)
               VALUES ($1, $2, $3, $4, $5)""",
            invite_id, token, user_id, person_id, expires_at
        )
        
        invite_link = f"https://t.me/{TELEGRAM_BOT_USERNAME}?start=invite_{token}"
        
        return {
            "invite": {"id": invite_id, "token": token, "status": "pending"},
            "link": invite_link,
            "message_template": f"Hey! I added you to my Friend Orbit. Accept to stay connected: {invite_link}"
        }

@api_router.post("/invites/{token}/accept", response_model=Dict)
async def accept_invite(token: str, telegram_id: str):
    async with db_pool.acquire() as conn:
        invite = await conn.fetchrow("SELECT * FROM invites WHERE token = $1 AND status = 'pending'", token)
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found or expired")
        
        if invite['expires_at'] < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Invite has expired")
        
        await conn.execute(
            "UPDATE invites SET status = 'accepted', invitee_telegram_id = $1 WHERE token = $2",
            telegram_id, token
        )
        
        await conn.execute(
            "UPDATE people SET connected = TRUE, telegram_user_id = $1 WHERE id = $2",
            telegram_id, invite['person_id']
        )
        
        person = await conn.fetchrow("SELECT * FROM people WHERE id = $1", invite['person_id'])
        
        return {"message": "Invite accepted", "person": dict(person) if person else None}

@api_router.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request, background_tasks: BackgroundTasks):
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
    
    try:
        update = await request.json()
        logger.info(f"Received Telegram update: {json.dumps(update)[:500]}")
        
        if 'message' in update:
            message = update['message']
            chat_id = str(message['chat']['id'])
            text = message.get('text', '')
            user = message.get('from', {})
            
            if text.startswith('/start'):
                parts = text.split(' ')
                
                if len(parts) > 1 and parts[1].startswith('invite_'):
                    token = parts[1].replace('invite_', '')
                    async with db_pool.acquire() as conn:
                        invite = await conn.fetchrow("SELECT * FROM invites WHERE token = $1 AND status = 'pending'", token)
                    
                    if invite:
                        async with db_pool.acquire() as conn:
                            inviter = await conn.fetchrow("SELECT display_name FROM users WHERE id = $1", invite['inviter_id'])
                        inviter_name = inviter['display_name'] if inviter else 'Someone'
                        
                        reply_markup = {
                            "inline_keyboard": [[
                                {"text": "✅ Accept", "callback_data": f"accept_{token}"},
                                {"text": "❌ Decline", "callback_data": f"decline_{token}"}
                            ]]
                        }
                        
                        await send_telegram_message(
                            chat_id,
                            f"🌌 <b>{inviter_name}</b> invited you to connect on Friend Orbit!\n\nAccept to stay in their universe.",
                            reply_markup
                        )
                    else:
                        await send_telegram_message(chat_id, "This invite link has expired or is invalid.")
                else:
                    reply_markup = {
                        "inline_keyboard": [[
                            {"text": "🌌 Open Friend Orbit", "web_app": {"url": WEBAPP_URL}}
                        ], [
                            {"text": "ℹ️ How it works", "callback_data": "how_it_works"},
                            {"text": "🔒 Privacy", "callback_data": "privacy"}
                        ]]
                    }
                    
                    await send_telegram_message(
                        chat_id,
                        "🌌 <b>Welcome to Friend Orbit</b>\n\nYour relationships as a universe. You're the sun — friends, family, and partners orbit around you based on how close you stay.\n\n<i>No guilt. Just gravity.</i>",
                        reply_markup
                    )
        
        elif 'callback_query' in update:
            callback = update['callback_query']
            chat_id = str(callback['message']['chat']['id'])
            callback_id = callback['id']
            data = callback.get('data', '')
            user = callback.get('from', {})
            
            if data.startswith('accept_'):
                token = data.replace('accept_', '')
                try:
                    result = await accept_invite(token, str(user['id']))
                    await send_telegram_message(chat_id, "✅ Connected! You're now in their orbit.")
                    
                    async with db_pool.acquire() as conn:
                        invite = await conn.fetchrow("SELECT * FROM invites WHERE token = $1", token)
                        if invite:
                            inviter = await conn.fetchrow("SELECT telegram_id FROM users WHERE id = $1", invite['inviter_id'])
                            if inviter:
                                person = await conn.fetchrow("SELECT name FROM people WHERE id = $1", invite['person_id'])
                                person_name = person['name'] if person else 'Someone'
                                await send_telegram_message(
                                    inviter['telegram_id'],
                                    f"✅ <b>{person_name}</b> accepted your invite! They're now connected."
                                )
                except Exception as e:
                    await send_telegram_message(chat_id, f"Could not accept invite: {str(e)}")
            
            elif data.startswith('decline_'):
                token = data.replace('decline_', '')
                async with db_pool.acquire() as conn:
                    await conn.execute("UPDATE invites SET status = 'declined' WHERE token = $1", token)
                await send_telegram_message(chat_id, "Invite declined.")
            
            elif data == 'how_it_works':
                await send_telegram_message(
                    chat_id,
                    "🪐 <b>How Friend Orbit works:</b>\n\n"
                    "1. <b>Add people</b> to your universe (friends, family, partner)\n"
                    "2. They appear as <b>planets</b> orbiting around you\n"
                    "3. <b>Gravity</b> = how close you are (recent chats = closer)\n"
                    "4. Without interaction, they <b>drift</b> outward\n"
                    "5. Daily <b>battery check</b> suggests who to reach out to\n\n"
                    "<i>No notifications to them. No guilt. Just awareness.</i>"
                )
            
            elif data == 'privacy':
                await send_telegram_message(
                    chat_id,
                    "🔒 <b>Privacy:</b>\n\n"
                    "• We only store names you enter\n"
                    "• Connected friends see they're in your orbit (nothing more)\n"
                    "• No message content is stored\n"
                    "• You can delete all data anytime"
                )
            
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                    json={"callback_query_id": callback_id}
                )
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.get("/debug/frontend")
async def debug_frontend():
    fb = find_frontend_build_dir()
    if not fb:
        return {
            "frontend_build_dir": None,
            "index_exists": False,
            "static_exists": False,
            "cwd": str(Path.cwd()),
            "server_file": str(Path(__file__).resolve()),
        }
    return {
        "frontend_build_dir": str(fb),
        "index_exists": (fb / "index.html").exists(),
        "static_exists": (fb / "static").exists(),
        "cwd": str(Path.cwd()),
        "server_file": str(Path(__file__).resolve()),
    }

class AuthRequest(BaseModel):
    init_data: str = ""
    telegram_id: str = ""
    display_name: str = "User"

@api_router.post("/auth/telegram", response_model=Dict)
async def auth_telegram(auth_data: AuthRequest):
    init_data = auth_data.init_data
    telegram_id = auth_data.telegram_id
    display_name = auth_data.display_name
    
    async with db_pool.acquire() as conn:
        if telegram_id and not init_data:
            row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", telegram_id)
            if row:
                return {"user": serialize_row(row), "is_new": False}
            
            user_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO users (id, telegram_id, display_name) VALUES ($1, $2, $3)",
                user_id, telegram_id, display_name
            )
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
            return {"user": serialize_row(row), "is_new": True}
        
        if init_data:
            user_data = validate_telegram_init_data(init_data)
            if user_data:
                tg_id = str(user_data.get('id', ''))
                name = user_data.get('first_name', '') + ' ' + user_data.get('last_name', '')
                name = name.strip() or 'User'
                
                row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", tg_id)
                if row:
                    return {"user": serialize_row(row), "is_new": False}
                
                user_id = str(uuid.uuid4())
                await conn.execute(
                    "INSERT INTO users (id, telegram_id, display_name) VALUES ($1, $2, $3)",
                    user_id, tg_id, name
                )
                row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
                return {"user": serialize_row(row), "is_new": True}
            else:
                logger.warning("Telegram init_data validation failed, creating temp user")
                temp_id = f"tg_unverified_{hashlib.md5(init_data.encode()).hexdigest()[:8]}"
                row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id = $1", temp_id)
                if row:
                    return {"user": serialize_row(row), "is_new": False}
                
                user_id = str(uuid.uuid4())
                await conn.execute(
                    "INSERT INTO users (id, telegram_id, display_name) VALUES ($1, $2, $3)",
                    user_id, temp_id, "Telegram User"
                )
                row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
                return {"user": serialize_row(row), "is_new": True}
    
    raise HTTPException(status_code=401, detail="Invalid authentication")

@api_router.get("/stats/{user_id}", response_model=Dict)
async def get_user_stats(user_id: str):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM people WHERE user_id = $1 AND archived = FALSE", user_id)
        people = [dict(row) for row in rows]
    
    total = len(people)
    inner = sum(1 for p in people if get_orbit_zone(p.get('gravity_score', 0)) == 'inner')
    goldilocks = sum(1 for p in people if get_orbit_zone(p.get('gravity_score', 0)) == 'goldilocks')
    outer = sum(1 for p in people if get_orbit_zone(p.get('gravity_score', 0)) == 'outer')
    
    by_type = {}
    for p in people:
        t = p.get('relationship_type', 'friend')
        by_type[t] = by_type.get(t, 0) + 1
    
    drifting = [p for p in people if p.get('gravity_score', 100) < 40]
    
    return {
        "total_people": total,
        "inner_circle": inner,
        "goldilocks_zone": goldilocks,
        "outer_rim": outer,
        "by_type": by_type,
        "drifting_count": len(drifting),
        "drifting_names": [p['name'] for p in drifting[:5]]
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def send_battery_prompts():
    logger.info("Running daily battery prompt job...")
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM users WHERE onboarded = TRUE")
            for row in rows:
                user = dict(row)
                user_tz = user.get('timezone', 'Asia/Kolkata')
                last_battery_at = user.get('last_battery_at')
                
                needs_prompt = True
                if last_battery_at:
                    try:
                        tz = pytz.timezone(user_tz)
                        if last_battery_at.astimezone(tz).date() == datetime.now(tz).date():
                            needs_prompt = False
                    except:
                        pass
                
                if needs_prompt and user.get('telegram_id'):
                    await send_telegram_message(
                        user['telegram_id'],
                        "☀️ <b>Good morning!</b>\n\nHow's your social battery today?\n\nTap below to log it and see who you should connect with.",
                        {"inline_keyboard": [[
                            {"text": "🔋 Log Battery", "web_app": {"url": WEBAPP_URL}}
                        ]]}
                    )
        logger.info("Battery prompt job completed")
    except Exception as e:
        logger.error(f"Battery prompt job failed: {e}")

async def send_drift_digest():
    logger.info("Running weekly drift digest job...")
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM users WHERE onboarded = TRUE")
            for row in rows:
                user = dict(row)
                if not user.get('telegram_id'):
                    continue
                
                drifting_rows = await conn.fetch(
                    "SELECT name FROM people WHERE user_id = $1 AND archived = FALSE AND gravity_score < 40 LIMIT 10",
                    user['id']
                )
                
                if drifting_rows:
                    names = [r['name'] for r in drifting_rows[:5]]
                    names_str = ", ".join(names)
                    count = len(drifting_rows)
                    
                    await send_telegram_message(
                        user['telegram_id'],
                        f"🌌 <b>Weekly Drift Report</b>\n\n"
                        f"{count} {'person is' if count == 1 else 'people are'} drifting away:\n"
                        f"<i>{names_str}</i>\n\n"
                        f"A quick message could pull them back into orbit.",
                        {"inline_keyboard": [[
                            {"text": "🪐 View Universe", "web_app": {"url": WEBAPP_URL}}
                        ]]}
                    )
        logger.info("Drift digest job completed")
    except Exception as e:
        logger.error(f"Drift digest job failed: {e}")

@app.on_event("startup")
async def startup():
    await init_db()
    
    scheduler.add_job(run_gravity_decay, CronTrigger(hour=18, minute=30))
    scheduler.add_job(send_battery_prompts, CronTrigger(hour=4, minute=30))
    scheduler.add_job(send_drift_digest, CronTrigger(day_of_week='sun', hour=13, minute=30))
    
    scheduler.start()
    logger.info("Scheduler started - all jobs scheduled")
    if FRONTEND_BUILD_DIR:
        logger.info(f"Frontend build directory found: {FRONTEND_BUILD_DIR}")
    else:
        logger.error("Frontend build directory NOT FOUND - app will not serve React!")

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
    if db_pool:
        await db_pool.close()

if FRONTEND_BUILD_DIR:
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="static")
    logger.info(f"Mounted static files from {FRONTEND_BUILD_DIR / 'static'}")

    @app.get("/", response_class=HTMLResponse)
    async def serve_root():
        return (FRONTEND_BUILD_DIR / "index.html").read_text(encoding="utf-8")

    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        return (FRONTEND_BUILD_DIR / "index.html").read_text(encoding="utf-8")

else:
    logger.error("Frontend build not found! React app will not load.")
    
    @app.get("/", response_class=HTMLResponse)
    async def frontend_missing():
        return HTMLResponse(
            "<h2>Frontend build not found</h2>"
            "<p>React build (frontend/build) is missing on the server.</p>",
            status_code=500,
        )
    
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def frontend_missing_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return HTMLResponse("<h2>Frontend build not found</h2>", status_code=500)
