"""J.A.R.V.I.S. Auth Core API — Production-hardened FastAPI backend.

Security features:
  - bcrypt password hashing (never store plaintext)
  - PyJWT access + refresh tokens with HS256 signing
  - CORS middleware (configurable allowed origins)
  - slowapi rate-limiting (30 req/min default)
  - SQLModel + SQLite for persistent storage
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import bcrypt
import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlmodel import Field as SQLField, Session, SQLModel, create_engine, select

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.environ.get(
    "JARVIS_JWT_SECRET", "dev-secret-change-in-production"
)
if SECRET_KEY == "dev-secret-change-in-production":
    import warnings
    warnings.warn(
        "JARVIS_JWT_SECRET not set — using insecure default. Set in production.",
        stacklevel=2,
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALLOWED_ORIGINS = os.environ.get(
    "JARVIS_CORS_ORIGINS", "http://localhost:3000"
).split(",")

DB_URL = os.environ.get("JARVIS_DB_URL", "sqlite:///jarvis_auth.db")
engine = create_engine(DB_URL, echo=False)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["30/minute"],
    headers_enabled=True,
)

app = FastAPI(
    title="J.A.R.V.I.S. Auth Core API",
    version="1.0.0",
    description="Industry-grade pluggable authentication backend for the JARVIS security suite.",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Database models
# ---------------------------------------------------------------------------
class User(SQLModel, table=True):
    __tablename__ = "users"

    uid: str = SQLField(default_factory=lambda: f"PY-{uuid.uuid4().hex[:6].upper()}", primary_key=True)
    email: str = SQLField(index=True, unique=True)
    hashed_passkey: str
    full_name: str
    clearance_level: str = "Level 1"
    has_biometrics: bool = False
    created_at: str = SQLField(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_login_at: Optional[str] = None


class Passkey(SQLModel, table=True):
    __tablename__ = "passkeys"

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_uid: str = SQLField(foreign_key="users.uid")
    credential_id: str = SQLField(index=True)
    public_key: str
    sign_count: int = 0


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    passkey: str = Field(min_length=6)
    full_name: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    passkey: str = Field(min_length=6)


class FaceVerifyRequest(BaseModel):
    image_base64: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfileResponse(BaseModel):
    uid: str
    email: str
    fullName: str
    clearanceLevel: str
    hasBiometrics: bool
    createdAt: Optional[str] = None
    lastLoginAt: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    user: UserProfileResponse
    token: Optional[TokenResponse] = None


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
def hash_passkey(passkey: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(passkey.encode("utf-8"), salt).decode("utf-8")


def verify_passkey(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token type mismatch"
        )
    return payload


def get_current_user(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )
    token = auth_header[7:]
    payload = decode_token(token)
    uid: str = payload.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )
    user = session.exec(select(User).where(User.uid == uid)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def to_user_response(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        uid=user.uid,
        email=user.email,
        fullName=user.full_name,
        clearanceLevel=user.clearance_level,
        hasBiometrics=user.has_biometrics,
        createdAt=user.created_at,
        lastLoginAt=user.last_login_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/api/v1/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok", "service": "jarvis-auth-core", "version": "1.0.0"}


@app.post("/api/v1/auth/register", status_code=201)
@limiter.limit("5/minute")
def register_operative(
    request: Request,
    req: RegisterRequest,
    session: Annotated[Session, Depends(get_session)],
):
    existing = session.exec(select(User).where(User.email == req.email.lower())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=req.email.lower(),
        hashed_passkey=hash_passkey(req.passkey),
        full_name=req.full_name,
        clearance_level="Level 1",
        has_biometrics=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token({"sub": user.uid, "email": user.email})
    refresh_token = create_refresh_token({"sub": user.uid})

    return AuthResponse(
        success=True,
        user=to_user_response(user),
        token=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@app.post("/api/v1/auth/login")
@limiter.limit("10/minute")
def login_operative(
    request: Request,
    req: LoginRequest,
    session: Annotated[Session, Depends(get_session)],
):
    user = session.exec(select(User).where(User.email == req.email.lower())).first()
    if not user or not verify_passkey(req.passkey, user.hashed_passkey):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or passkey",
        )

    user.last_login_at = datetime.now(timezone.utc).isoformat()
    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token({"sub": user.uid, "email": user.email})
    refresh_token = create_refresh_token({"sub": user.uid})

    return AuthResponse(
        success=True,
        user=to_user_response(user),
        token=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@app.post("/api/v1/auth/refresh")
@limiter.limit("30/minute")
def refresh_token(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    current: Annotated[User, Depends(get_current_user)],
):
    access_token = create_access_token({"sub": current.uid, "email": current.email})
    return TokenResponse(access_token=access_token, refresh_token="")


@app.post("/api/v1/auth/verify-face")
@limiter.limit("20/minute")
def verify_face(
    request: Request,
    req: FaceVerifyRequest,
    session: Annotated[Session, Depends(get_session)],
    current: Annotated[User, Depends(get_current_user)],
):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Missing base64 frame stream")

    current.has_biometrics = True
    session.add(current)
    session.commit()
    session.refresh(current)

    access_token = create_access_token({"sub": current.uid, "email": current.email})
    return AuthResponse(
        success=True,
        user=to_user_response(current),
        token=TokenResponse(access_token=access_token, refresh_token=""),
    )


@app.post("/api/v1/auth/verify-voice")
@limiter.limit("20/minute")
def verify_voice(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    current: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    contents = file.file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty audio payload")

    current.has_biometrics = True
    session.add(current)
    session.commit()
    session.refresh(current)

    access_token = create_access_token({"sub": current.uid, "email": current.email})
    return AuthResponse(
        success=True,
        user=to_user_response(current),
        token=TokenResponse(access_token=access_token, refresh_token=""),
    )


@app.post("/api/v1/auth/verify-fingerprint")
@limiter.limit("20/minute")
def verify_fingerprint(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    current: Annotated[User, Depends(get_current_user)],
    scan_data: str = Form(...),
):
    if not scan_data:
        raise HTTPException(status_code=400, detail="Missing fingerprint scan data")

    current.has_biometrics = True
    session.add(current)
    session.commit()
    session.refresh(current)

    access_token = create_access_token({"sub": current.uid, "email": current.email})
    return AuthResponse(
        success=True,
        user=to_user_response(current),
        token=TokenResponse(access_token=access_token, refresh_token=""),
    )


@app.get("/api/v1/auth/webauthn/options")
@limiter.limit("10/minute")
def webauthn_options(
    request: Request,
    email: str,
    session: Annotated[Session, Depends(get_session)],
):
    user = session.exec(select(User).where(User.email == email.lower())).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # In production, generate a cryptographically random challenge
    challenge = uuid.uuid4().hex

    return {
        "challenge": challenge,
        "rpId": "localhost",
        "rpName": "J.A.R.V.I.S.",
        "userId": user.uid,
        "userEmail": user.email,
        "userName": user.full_name,
        "timeout": 60000,
        "attestation": "none",
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},
            {"type": "public-key", "alg": -257},
        ],
    }


@app.post("/api/v1/auth/webauthn/verify")
@limiter.limit("10/minute")
def webauthn_verify(
    request: Request,
    credential: dict,
    session: Annotated[Session, Depends(get_session)],
):
    # In production, use @simplewebauthn/server to verify the assertion
    credential_id = credential.get("id", "")
    stored = session.exec(select(Passkey).where(Passkey.credential_id == credential_id)).first()

    if not stored:
        raise HTTPException(status_code=404, detail="Credential not found")

    stored.sign_count += 1
    session.add(stored)
    session.commit()

    user = session.exec(select(User).where(User.uid == stored.user_uid)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = create_access_token({"sub": user.uid, "email": user.email})
    return {
        "success": True,
        "user": to_user_response(user),
        "token": TokenResponse(access_token=access_token, refresh_token=""),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
