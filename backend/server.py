from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks, Depends, Header
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============== FRONTEND BUILD DISCOVERY ==============

def find_frontend_build_dir() -> Path | None:
    """
    Try multiple likely locations for React build.
    Works for:
      - monorepo deploy (root has frontend/build)
      - backend-only deploy where build is copied into backend/frontend_build
      - backend-only deploy where build is copied into backend/frontend/build
    """
    here = Path(__file__).resolve()
    candidates = [
        # monorepo: <root>/frontend/build
        here.parents[1] / "frontend" / "build",   # backend/server.py -> backend -> root
        here.parents[0] / "frontend" / "build",   # backend/server.py -> backend
        # backend-only: <backend>/frontend_build
        here.parents[0] / "frontend_build",
        # backend-only: <backend>/frontend/build
        here.parents[0] / "frontend" / "build",
        # current working dir variants
        Path.cwd() / "frontend" / "build",
        Path.cwd() / "frontend_build",
    ]

    for p in candidates:
        if (p / "index.html").exists() and (p / "static").exists():
            return p

    return None

# Find the frontend build directory
FRONTEND_BUILD_DIR = find_frontend_build_dir()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Telegram Bot Config
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.environ.get('TELEGRAM_BOT_USERNAME', 'Friendorbitbot')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'default_secret')
WEBAPP_URL = os.environ.get('WEBAPP_URL', 'https://webapp-secure.preview.emergentagent.com')

# Allowed origins for CORS (security fix) - strip whitespace from each origin
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', WEBAPP_URL).split(',') if o.strip()]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Scheduler for cron jobs
scheduler = AsyncIOScheduler()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== AUTH HELPERS ==============

async def get_current_user(x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> Dict:
    """Get current authenticated user from header"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    
    user = await db.users.find_one({"id": x_user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")
    return user

async def verify_resource_ownership(resource_collection: str, resource_id: str, user_id: str) -> Dict:
    """Verify user owns the resource"""
    resource = await db[resource_collection].find_one({"id": resource_id}, {"_id": 0})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.get('user_id') != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return resource

def get_user_local_date(user_timezone: str) -> datetime.date:
    """Get current date in user's timezone"""
    try:
        tz = pytz.timezone(user_timezone)
    except:
        tz = pytz.timezone('Asia/Kolkata')
    return datetime.now(tz).date()

# ============== MODELS ==============

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

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: str
    display_name: str
    avatar_url: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    inner_circle_size: int = 6
    drift_strictness: str = "normal"  # gentle, normal, strict
    onboarded: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_battery: Optional[int] = None
    last_battery_at: Optional[datetime] = None

class PersonCreate(BaseModel):
    name: str
    relationship_type: str  # partner, family, friend
    relationship_subtype: Optional[str] = None  # mom, dad, brother, etc.
    archetype: Optional[str] = None  # Anchor, Spark, Sage, Comet
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

class Person(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    relationship_type: str
    relationship_subtype: Optional[str] = None
    archetype: str = "Anchor"
    cadence_days: int = 7
    tags: List[str] = []
    pinned: bool = False
    archived: bool = False
    gravity_score: float = 80.0
    last_interaction: Optional[datetime] = None
    telegram_user_id: Optional[str] = None
    connected: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class Meteor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    person_id: str
    user_id: str
    content: str
    tag: Optional[str] = None
    due_date: Optional[str] = None
    done: bool = False
    archived: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BatteryLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    score: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Invite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str
    inviter_id: str
    person_id: str
    status: str = "pending"  # pending, accepted, declined
    invitee_telegram_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))

# ============== TELEGRAM HELPERS ==============

async def send_telegram_message(chat_id: str, text: str, reply_markup: Optional[Dict] = None):
    """Send a message via Telegram Bot API"""
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
    """Validate Telegram Web App init data"""
    if not TELEGRAM_BOT_TOKEN:
        return None
    
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True))
        hash_value = parsed.pop('hash', '')
        
        # Create check string
        data_check_string = '\n'.join(f'{k}={v}' for k, v in sorted(parsed.items()))
        
        # Create secret key
        secret_key = hmac.new(b'WebAppData', TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash == hash_value:
            user_data = json.loads(parsed.get('user', '{}'))
            return user_data
    except Exception as e:
        logger.error(f"Failed to validate init data: {e}")
    
    return None

# ============== GRAVITY ENGINE ==============

def calculate_gravity_decay(person: Dict, user_strictness: str = 'normal') -> float:
    """Calculate gravity decay based on time since last interaction"""
    base_score = person.get('gravity_score', 80.0)
    last_interaction = person.get('last_interaction')
    relationship_type = person.get('relationship_type', 'friend')
    archetype = person.get('archetype', 'Anchor')
    pinned = person.get('pinned', False)
    
    if pinned:
        return base_score  # No decay for pinned
    
    if not last_interaction:
        return base_score
    
    if isinstance(last_interaction, str):
        last_interaction = datetime.fromisoformat(last_interaction.replace('Z', '+00:00'))
    
    days_since = (datetime.now(timezone.utc) - last_interaction).days
    
    # Base decay rates - LOWER = slower decay (partner decays slowest)
    relationship_decay = {
        'partner': 1.0,   # Slowest decay - closest relationship
        'family': 2.0,    # Slow decay
        'friend': 3.0     # Normal decay
    }
    
    # Archetype multipliers
    archetype_multiplier = {
        'Anchor': 0.8,    # Stable - decays slower
        'Sage': 0.9,      # Wise - decays slower
        'Spark': 1.2,     # Energizing but needs attention
        'Comet': 0.5      # Comes and goes - decays slowest (expected to be distant)
    }
    
    # Strictness multipliers
    strictness_multiplier = {
        'gentle': 0.6,
        'normal': 1.0,
        'strict': 1.5
    }
    
    base_decay = relationship_decay.get(relationship_type, 3.0)
    arch_mult = archetype_multiplier.get(archetype, 1.0)
    strict_mult = strictness_multiplier.get(user_strictness, 1.0)
    
    daily_decay = base_decay * arch_mult * strict_mult
    new_score = max(0, base_score - (days_since * daily_decay))
    
    return round(new_score, 1)

def get_orbit_zone(gravity_score: float) -> str:
    """Determine orbit zone based on gravity score (80/40 thresholds)"""
    if gravity_score >= 80:
        return "inner"
    elif gravity_score >= 40:
        return "goldilocks"
    else:
        return "outer"

async def run_gravity_decay():
    """Cron job to update gravity scores for all people"""
    logger.info("Running gravity decay job...")
    try:
        async for person in db.people.find({"archived": False}):
            # Get user's strictness setting
            user = await db.users.find_one({"id": person.get('user_id')}, {"_id": 0})
            strictness = user.get('drift_strictness', 'normal') if user else 'normal'
            
            new_score = calculate_gravity_decay(person, strictness)
            if new_score != person.get('gravity_score'):
                await db.people.update_one(
                    {"id": person['id']},
                    {"$set": {"gravity_score": new_score}}
                )
        logger.info("Gravity decay job completed")
    except Exception as e:
        logger.error(f"Gravity decay job failed: {e}")

# ============== BATTERY SUGGESTIONS ==============

def get_suggestions(user: Dict, people: List[Dict], battery_score: int) -> List[Dict]:
    """Get rule-based suggestions based on battery score"""
    # Sort by gravity score (ascending = most drifting first)
    sorted_people = sorted(people, key=lambda p: p.get('gravity_score', 100))
    
    # Number of suggestions based on battery
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

# ============== API ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "Friend Orbit API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ---------- USER ROUTES ----------

@api_router.post("/users", response_model=Dict)
async def create_user(user_data: UserCreate):
    """Create or get user by Telegram ID"""
    existing = await db.users.find_one({"telegram_id": user_data.telegram_id}, {"_id": 0})
    if existing:
        return existing
    
    user = User(**user_data.model_dump())
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc.copy())
    doc.pop('_id', None)
    return doc

@api_router.get("/users/{telegram_id}", response_model=Dict)
async def get_user(telegram_id: str):
    """Get user by Telegram ID"""
    user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.patch("/users/{user_id}", response_model=Dict)
async def update_user(user_id: str, update_data: UserUpdate):
    """Update user settings"""
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user

@api_router.post("/users/{user_id}/onboard", response_model=Dict)
async def complete_onboarding(user_id: str):
    """Mark user as onboarded"""
    result = await db.users.update_one({"id": user_id}, {"$set": {"onboarded": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user

# ---------- PEOPLE ROUTES (with auth) ----------

@api_router.post("/people", response_model=Dict)
async def create_person(person_data: PersonCreate, current_user: Dict = Depends(get_current_user)):
    """Add a new person (planet) to user's orbit"""
    user_id = current_user['id']
    
    # Check for existing partner
    if person_data.relationship_type == "partner":
        existing_partner = await db.people.find_one({
            "user_id": user_id, 
            "relationship_type": "partner",
            "archived": False
        })
        if existing_partner:
            raise HTTPException(status_code=400, detail="You can only have one active partner")
    
    person = Person(user_id=user_id, **person_data.model_dump())
    doc = person.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('last_interaction'):
        doc['last_interaction'] = doc['last_interaction'].isoformat()
    
    await db.people.insert_one(doc.copy())
    doc.pop('_id', None)
    return doc

@api_router.get("/people", response_model=List[Dict])
async def get_people(current_user: Dict = Depends(get_current_user), include_archived: bool = False):
    """Get all people in user's orbit"""
    user_id = current_user['id']
    query = {"user_id": user_id}
    if not include_archived:
        query["archived"] = False
    
    people = await db.people.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate current orbit zones
    for person in people:
        person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
    
    return people

@api_router.get("/people/{person_id}", response_model=Dict)
async def get_person(person_id: str, current_user: Dict = Depends(get_current_user)):
    """Get a specific person - only if user owns it"""
    person = await verify_resource_ownership("people", person_id, current_user['id'])
    person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
    return person

@api_router.patch("/people/{person_id}", response_model=Dict)
async def update_person(person_id: str, update_data: PersonUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a person - only if user owns it"""
    await verify_resource_ownership("people", person_id, current_user['id'])
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.people.update_one({"id": person_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    
    person = await db.people.find_one({"id": person_id}, {"_id": 0})
    person['orbit_zone'] = get_orbit_zone(person.get('gravity_score', 0))
    return person

@api_router.post("/people/{person_id}/interaction", response_model=Dict)
async def log_interaction(person_id: str, current_user: Dict = Depends(get_current_user)):
    """Log an interaction - increases gravity score"""
    person = await verify_resource_ownership("people", person_id, current_user['id'])
    
    # Boost gravity score (max 100)
    new_score = min(100, person.get('gravity_score', 50) + 20)
    now = datetime.now(timezone.utc).isoformat()
    
    await db.people.update_one(
        {"id": person_id},
        {"$set": {"gravity_score": new_score, "last_interaction": now}}
    )
    
    updated = await db.people.find_one({"id": person_id}, {"_id": 0})
    updated['orbit_zone'] = get_orbit_zone(updated.get('gravity_score', 0))
    return updated

@api_router.delete("/people/{person_id}")
async def archive_person(person_id: str, current_user: Dict = Depends(get_current_user)):
    """Archive (soft delete) a person - only if user owns it"""
    await verify_resource_ownership("people", person_id, current_user['id'])
    result = await db.people.update_one({"id": person_id}, {"$set": {"archived": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    return {"message": "Person archived", "id": person_id}

# ---------- METEOR ROUTES (with auth) ----------

@api_router.post("/meteors", response_model=Dict)
async def create_meteor(meteor_data: MeteorCreate, current_user: Dict = Depends(get_current_user)):
    """Create a memory meteor"""
    user_id = current_user['id']
    # Verify person belongs to user
    person = await db.people.find_one({"id": meteor_data.person_id, "user_id": user_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    meteor = Meteor(user_id=user_id, **meteor_data.model_dump())
    doc = meteor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.meteors.insert_one(doc.copy())
    doc.pop('_id', None)
    return doc

@api_router.get("/meteors", response_model=List[Dict])
async def get_meteors(current_user: Dict = Depends(get_current_user), person_id: Optional[str] = None):
    """Get meteors for user, optionally filtered by person"""
    user_id = current_user['id']
    query = {"user_id": user_id, "archived": False}
    if person_id:
        query["person_id"] = person_id
    
    meteors = await db.meteors.find(query, {"_id": 0}).to_list(1000)
    return meteors

@api_router.patch("/meteors/{meteor_id}", response_model=Dict)
async def update_meteor(meteor_id: str, update_data: MeteorUpdate, current_user: Dict = Depends(get_current_user)):
    """Update a meteor - only if user owns it"""
    await verify_resource_ownership("meteors", meteor_id, current_user['id'])
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.meteors.update_one({"id": meteor_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meteor not found")
    
    meteor = await db.meteors.find_one({"id": meteor_id}, {"_id": 0})
    return meteor

@api_router.delete("/meteors/{meteor_id}")
async def archive_meteor(meteor_id: str, current_user: Dict = Depends(get_current_user)):
    """Archive a meteor - only if user owns it"""
    await verify_resource_ownership("meteors", meteor_id, current_user['id'])
    result = await db.meteors.update_one({"id": meteor_id}, {"$set": {"archived": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meteor not found")
    return {"message": "Meteor archived", "id": meteor_id}

# ---------- BATTERY ROUTES (with auth + timezone fix) ----------

@api_router.post("/battery", response_model=Dict)
async def log_battery(score: int, current_user: Dict = Depends(get_current_user)):
    """Log daily social battery score"""
    user_id = current_user['id']
    if not 0 <= score <= 100:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 100")
    
    # Update user's last battery
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"last_battery": score, "last_battery_at": now.isoformat()}}
    )
    
    # Log to battery history
    battery_log = BatteryLog(user_id=user_id, score=score)
    doc = battery_log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.battery_logs.insert_one(doc.copy())
    
    # Get suggestions
    people = await db.people.find({"user_id": user_id, "archived": False}, {"_id": 0}).to_list(100)
    suggestions = get_suggestions(current_user, people, score)
    
    return {
        "score": score,
        "logged_at": now.isoformat(),
        "suggestions": suggestions
    }

@api_router.get("/battery", response_model=Dict)
async def get_battery_status(current_user: Dict = Depends(get_current_user)):
    """Get current battery status and suggestions (timezone-aware)"""
    user_id = current_user['id']
    user_timezone = current_user.get('timezone', 'Asia/Kolkata')
    
    last_battery = current_user.get('last_battery')
    last_battery_at = current_user.get('last_battery_at')
    
    # Check if battery was logged today in USER'S TIMEZONE
    needs_update = True
    if last_battery_at:
        if isinstance(last_battery_at, str):
            last_battery_at_dt = datetime.fromisoformat(last_battery_at.replace('Z', '+00:00'))
        else:
            last_battery_at_dt = last_battery_at
        
        # Convert to user's timezone and compare dates
        try:
            user_tz = pytz.timezone(user_timezone)
            last_logged_local = last_battery_at_dt.astimezone(user_tz).date()
            today_local = datetime.now(user_tz).date()
            needs_update = last_logged_local != today_local
        except:
            needs_update = True
    
    suggestions = []
    if last_battery is not None:
        people = await db.people.find({"user_id": user_id, "archived": False}, {"_id": 0}).to_list(100)
        suggestions = get_suggestions(current_user, people, last_battery)
    
    return {
        "score": last_battery,
        "logged_at": last_battery_at if isinstance(last_battery_at, str) else (last_battery_at.isoformat() if last_battery_at else None),
        "needs_update": needs_update,
        "suggestions": suggestions
    }

# ---------- INVITE ROUTES (with auth) ----------

@api_router.post("/invites", response_model=Dict)
async def create_invite(person_id: str, current_user: Dict = Depends(get_current_user)):
    """Generate invite link for a person"""
    user_id = current_user['id']
    # Verify person belongs to user and isn't already connected
    person = await db.people.find_one({"id": person_id, "user_id": user_id}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    if person.get('connected'):
        raise HTTPException(status_code=400, detail="Person is already connected")
    
    # Generate unique token
    token = str(uuid.uuid4())[:12]
    
    invite = Invite(token=token, inviter_id=user_id, person_id=person_id)
    doc = invite.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['expires_at'] = doc['expires_at'].isoformat()
    
    await db.invites.insert_one(doc.copy())
    doc.pop('_id', None)
    
    # Generate invite link using env variable
    invite_link = f"https://t.me/{TELEGRAM_BOT_USERNAME}?start=invite_{token}"
    
    return {
        "invite": doc,
        "link": invite_link,
        "message_template": f"Hey! I added you to my Friend Orbit. Accept to stay connected: {invite_link}"
    }

@api_router.post("/invites/{token}/accept", response_model=Dict)
async def accept_invite(token: str, telegram_id: str):
    """Accept an invite"""
    invite = await db.invites.find_one({"token": token, "status": "pending"}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    
    # Check expiry
    expires_at = invite.get('expires_at')
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    # Update invite
    await db.invites.update_one(
        {"token": token},
        {"$set": {"status": "accepted", "invitee_telegram_id": telegram_id}}
    )
    
    # Update person as connected
    await db.people.update_one(
        {"id": invite['person_id']},
        {"$set": {"connected": True, "telegram_user_id": telegram_id}}
    )
    
    person = await db.people.find_one({"id": invite['person_id']}, {"_id": 0})
    
    return {
        "message": "Invite accepted",
        "person": person
    }

# ---------- TELEGRAM WEBHOOK ----------

@api_router.post("/telegram/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request, background_tasks: BackgroundTasks):
    """Handle Telegram Bot webhook updates"""
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")
    
    try:
        update = await request.json()
        logger.info(f"Received Telegram update: {json.dumps(update)[:500]}")
        
        # Handle messages
        if 'message' in update:
            message = update['message']
            chat_id = str(message['chat']['id'])
            text = message.get('text', '')
            user = message.get('from', {})
            
            # Handle /start command
            if text.startswith('/start'):
                parts = text.split(' ')
                
                if len(parts) > 1 and parts[1].startswith('invite_'):
                    # Handle invite acceptance
                    token = parts[1].replace('invite_', '')
                    invite = await db.invites.find_one({"token": token, "status": "pending"})
                    
                    if invite:
                        inviter = await db.users.find_one({"id": invite['inviter_id']})
                        inviter_name = inviter.get('display_name', 'Someone') if inviter else 'Someone'
                        
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
                    # Regular start - show welcome
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
        
        # Handle callback queries
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
                    
                    # Notify inviter
                    invite = await db.invites.find_one({"token": token})
                    if invite:
                        inviter = await db.users.find_one({"id": invite['inviter_id']})
                        if inviter:
                            person = await db.people.find_one({"id": invite['person_id']})
                            person_name = person.get('name', 'Someone') if person else 'Someone'
                            await send_telegram_message(
                                inviter['telegram_id'],
                                f"✅ <b>{person_name}</b> accepted your invite! They're now connected."
                            )
                except Exception as e:
                    await send_telegram_message(chat_id, f"Could not accept invite: {str(e)}")
            
            elif data.startswith('decline_'):
                token = data.replace('decline_', '')
                await db.invites.update_one({"token": token}, {"$set": {"status": "declined"}})
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
            
            # Answer callback to remove loading state
            async with httpx.AsyncClient() as http_client:
                await http_client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                    json={"callback_query_id": callback_id}
                )
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ---------- DEBUG ENDPOINT ----------

@api_router.get("/debug/frontend")
async def debug_frontend():
    """Debug endpoint to verify frontend build exists in production"""
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
        "static_js_files_count": len(list((fb / "static" / "js").glob("*.js"))) if (fb / "static" / "js").exists() else 0,
        "cwd": str(Path.cwd()),
        "server_file": str(Path(__file__).resolve()),
    }

# ---------- TELEGRAM AUTH ----------

class AuthRequest(BaseModel):
    init_data: str = ""
    telegram_id: str = ""
    display_name: str = "User"

@api_router.post("/auth/telegram", response_model=Dict)
async def auth_telegram(auth_data: AuthRequest):
    """Authenticate user via Telegram Web App or create demo user"""
    init_data = auth_data.init_data
    telegram_id = auth_data.telegram_id
    display_name = auth_data.display_name
    
    # For demo/testing without Telegram
    if telegram_id and not init_data:
        user = await db.users.find_one({"telegram_id": telegram_id}, {"_id": 0})
        if user:
            return {"user": user, "is_new": False}
        
        # Create new user
        new_user = User(telegram_id=telegram_id, display_name=display_name)
        doc = new_user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc.copy())
        doc.pop('_id', None)  # Remove _id if added by insert
        return {"user": doc, "is_new": True}
    
    # Validate Telegram init data
    if init_data:
        user_data = validate_telegram_init_data(init_data)
        if user_data:
            tg_id = str(user_data.get('id', ''))
            name = user_data.get('first_name', '') + ' ' + user_data.get('last_name', '')
            name = name.strip() or 'User'
            
            user = await db.users.find_one({"telegram_id": tg_id}, {"_id": 0})
            if user:
                return {"user": user, "is_new": False}
            
            new_user = User(telegram_id=tg_id, display_name=name)
            doc = new_user.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc.copy())
            doc.pop('_id', None)
            return {"user": doc, "is_new": True}
        else:
            # If init_data validation fails, create a temporary demo user
            # This allows the app to still work while debugging
            logger.warning("Telegram init_data validation failed, creating temp user")
            temp_id = f"tg_unverified_{hashlib.md5(init_data.encode()).hexdigest()[:8]}"
            user = await db.users.find_one({"telegram_id": temp_id}, {"_id": 0})
            if user:
                return {"user": user, "is_new": False}
            
            new_user = User(telegram_id=temp_id, display_name="Telegram User")
            doc = new_user.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc.copy())
            doc.pop('_id', None)
            return {"user": doc, "is_new": True}
    
    raise HTTPException(status_code=401, detail="Invalid authentication")

# ============== STATS ROUTE ==============

@api_router.get("/stats/{user_id}", response_model=Dict)
async def get_user_stats(user_id: str):
    """Get user's orbit statistics"""
    people = await db.people.find({"user_id": user_id, "archived": False}, {"_id": 0}).to_list(1000)
    
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

# Include the router in the main app
app.include_router(api_router)

# CORS - allow Telegram WebApp and configured origins
# ALLOWED_ORIGINS is already a list from line 71
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== SCHEDULED JOBS ==============

async def send_battery_prompts():
    """Send daily battery check prompts to users (10:00 AM IST)"""
    logger.info("Running daily battery prompt job...")
    try:
        # Find users who haven't logged battery today
        async for user in db.users.find({"onboarded": True}):
            user_tz = user.get('timezone', 'Asia/Kolkata')
            last_battery_at = user.get('last_battery_at')
            
            needs_prompt = True
            if last_battery_at:
                if isinstance(last_battery_at, str):
                    last_dt = datetime.fromisoformat(last_battery_at.replace('Z', '+00:00'))
                else:
                    last_dt = last_battery_at
                try:
                    tz = pytz.timezone(user_tz)
                    if last_dt.astimezone(tz).date() == datetime.now(tz).date():
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
    """Send weekly drift digest (Sunday 7 PM IST)"""
    logger.info("Running weekly drift digest job...")
    try:
        async for user in db.users.find({"onboarded": True}):
            if not user.get('telegram_id'):
                continue
                
            # Get drifting people (gravity < 40)
            drifting = await db.people.find({
                "user_id": user['id'],
                "archived": False,
                "gravity_score": {"$lt": 40}
            }, {"_id": 0}).to_list(10)
            
            if drifting:
                names = [p['name'] for p in drifting[:5]]
                names_str = ", ".join(names)
                count = len(drifting)
                
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
    """Start scheduler for cron jobs"""
    # Gravity decay: daily at midnight IST (18:30 UTC)
    scheduler.add_job(run_gravity_decay, CronTrigger(hour=18, minute=30))
    
    # Daily battery prompt: 10:00 AM IST (04:30 UTC)
    scheduler.add_job(send_battery_prompts, CronTrigger(hour=4, minute=30))
    
    # Weekly drift digest: Sunday 7:00 PM IST (13:30 UTC)
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
    client.close()

# ============== STATIC FILE SERVING (React SPA) ==============

# Mount static files and serve React app based on whether build exists
if FRONTEND_BUILD_DIR:
    app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="static")
    logger.info(f"Mounted static files from {FRONTEND_BUILD_DIR / 'static'}")

    @app.get("/", response_class=HTMLResponse)
    async def serve_root():
        """Serve React app index.html"""
        return (FRONTEND_BUILD_DIR / "index.html").read_text(encoding="utf-8")

    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def serve_spa(full_path: str):
        """SPA fallback - serve index.html for all non-API routes"""
        # Let API routes behave normally
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        
        # Try to serve the exact file first (for assets like favicon, manifest, etc.)
        file_path = FRONTEND_BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        # Otherwise serve index.html (SPA routing)
        return (FRONTEND_BUILD_DIR / "index.html").read_text(encoding="utf-8")

else:
    # If build missing, DON'T silently blank — show explicit HTML so we can debug
    logger.error("Frontend build not found! React app will not load.")
    
    @app.get("/", response_class=HTMLResponse)
    async def frontend_missing():
        return HTMLResponse(
            "<h2>Frontend build not found</h2>"
            "<p>React build (frontend/build) is missing on the server.</p>"
            "<p>Fix deployment: build frontend and ensure it is deployed alongside backend.</p>"
            f"<p>Server file location: {Path(__file__).resolve()}</p>"
            f"<p>Working directory: {Path.cwd()}</p>",
            status_code=500,
        )
    
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def frontend_missing_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return HTMLResponse(
            "<h2>Frontend build not found</h2>"
            "<p>Cannot serve React app - build is missing.</p>",
            status_code=500,
        )
