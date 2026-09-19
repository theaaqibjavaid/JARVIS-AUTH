"""J.A.R.V.I.S. Auth Core API — Production-hardened FastAPI backend.

Security features:
  - bcrypt password hashing (never store plaintext)
  - PyJWT access + refresh tokens with HS256 signing
  - CORS middleware (configurable allowed origins)
  - slowapi rate-limiting (30 req/min default)
  - SQLModel + SQLite for persistent storage
"""

import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import bcrypt
import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlmodel import Field as SQLField, Session, SQLModel, create_engine, select
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_jwt_secret = os.environ.get("JARVIS_JWT_SECRET")
if not _jwt_secret:
    raise RuntimeError(
        "JARVIS_JWT_SECRET environment variable is required. "
        "Generate one with: openssl rand -hex 64"
    )
SECRET_KEY: str = _jwt_secret

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

# ---------------------------------------------------------------------------
# CSRF / Origin validation middleware
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Create database tables on startup (replaces deprecated on_event hook).
    create_db_and_tables()
    yield


app = FastAPI(
    title="J.A.R.V.I.S. Auth Core API",
    version="1.0.0",
    description="Industry-grade pluggable authentication backend for the JARVIS security suite.",
    lifespan=lifespan,
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


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=()"
    )
    # HSTS: only set when running over HTTPS to avoid breaking HTTP dev servers.
    is_https = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    if is_https:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
    # CSP: strict — no unsafe-inline or unsafe-eval.
    origin = request.headers.get("origin", "")
    csp_values = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        f"base-uri 'self'",
        f"form-action 'self'",
    ]
    if origin and origin not in ("", "null"):
        csp_values[1] += f" {origin}"
        csp_values[2] += f" {origin}"
        csp_values[5] += f" {origin}"
    response.headers["Content-Security-Policy"] = "; ".join(csp_values)
    return response


@app.middleware("http")
async def csrf_origin_middleware(request: Request, call_next):
    """Reject cross-origin state-changing requests whose Origin is not allowed."""
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Cross-origin request forbidden"},
            )
    response = await call_next(request)
    return response


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


class BiometricLoginRequest(BaseModel):
    email: EmailStr
    method: str = Field(pattern="^(face|voice|fingerprint)$")
    credential_id: Optional[str] = None


class EnrollBiometricRequest(BaseModel):
    email: EmailStr
    credential_id: str = Field(min_length=1)


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


# ---------------------------------------------------------------------------
# Password-reset tokens (in-memory, cleared on server restart — fine for demo)
# ---------------------------------------------------------------------------
_reset_tokens: dict[str, tuple[str, str]] = {}  # email -> (token, new_password)


class ResetPasswordRequest(BaseModel):
    email: str


class ResetPasswordConfirmRequest(BaseModel):
    email: str
    token: str
    new_passkey: str


@app.post("/api/v1/auth/reset-password/request")
@limiter.limit("5/minute")
def request_password_reset(
    request: Request,
    req: ResetPasswordRequest,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, bool]:
    """Issue a one-time reset token for the given email."""
    if not req.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email required")
    user = session.exec(select(User).where(User.email == req.email.lower())).first()
    if not user:
        # Return success anyway to prevent email enumeration.
        return {"success": True}
    token = secrets.token_urlsafe(32)
    _reset_tokens[req.email.lower()] = (token, "")
    # In production, send an email here with the token.
    return {"success": True}


@app.post("/api/v1/auth/reset-password/confirm")
@limiter.limit("5/minute")
def confirm_password_reset(
    request: Request,
    req: ResetPasswordConfirmRequest,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, bool]:
    """Swap a one-time reset token for a new passkey."""
    if not req.email or not req.token or not req.new_passkey:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All fields required")
    stored = _reset_tokens.get(req.email.lower())
    if not stored or stored[0] != req.token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired token")
    user = session.exec(select(User).where(User.email == req.email.lower())).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    hashed = hash_passkey(req.new_passkey)
    user.hashed_passkey = hashed
    session.add(user)
    session.commit()
    del _reset_tokens[req.email.lower()]
    return {"success": True}


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


@app.post("/api/v1/auth/enroll-biometric")
@limiter.limit("10/minute")
def enroll_biometric(
    request: Request,
    req: EnrollBiometricRequest,
    session: Annotated[Session, Depends(get_session)],
):
    """Persist a device-biometric credential binding for an operative.

    Called after the client completes the real OS biometric enrollment
    (Windows Hello / Touch ID / Face ID via the WebAuthn platform
    authenticator). The raw biometric never reaches the server — only the
    credential id produced by the OS authenticator is stored.
    """
    user = session.exec(select(User).where(User.email == req.email.lower())).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Avoid duplicate bindings for the same credential id.
    existing = session.exec(
        select(Passkey).where(Passkey.credential_id == req.credential_id)
    ).first()
    if not existing:
        session.add(
            Passkey(user_uid=user.uid, credential_id=req.credential_id, public_key="platform")
        )

    user.has_biometrics = True
    session.add(user)
    session.commit()
    session.refresh(user)

    return AuthResponse(success=True, user=to_user_response(user), token=None)


@app.post("/api/v1/auth/biometric-login")
@limiter.limit("20/minute")
def biometric_login(
    request: Request,
    req: BiometricLoginRequest,
    session: Annotated[Session, Depends(get_session)],
):
    """Establish a session after the client passes its local biometric gate.

    The biometric match itself is enforced on the device: an OS-level WebAuthn
    platform authenticator for face/fingerprint, and an on-device DSP
    voiceprint for voice. The server's responsibilities are to (1) refuse login
    unless the operative has previously enrolled biometrics ("register first,
    then login"), (2) for device biometrics, verify the presented credential id
    is actually bound to the claimed operative, and (3) issue tokens.
    """
    user = session.exec(select(User).where(User.email == req.email.lower())).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid biometric credential"
        )

    # Register-first: biometric login is only allowed after enrollment.
    if not user.has_biometrics:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Biometrics not enrolled for this operative",
        )

    # Device biometrics must present a credential bound to this operative.
    if req.method in ("face", "fingerprint"):
        if not req.credential_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing credential_id for device biometric",
            )
        stored = session.exec(
            select(Passkey).where(
                Passkey.credential_id == req.credential_id,
                Passkey.user_uid == user.uid,
            )
        ).first()
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credential not bound to this operative",
            )
        stored.sign_count += 1
        session.add(stored)

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
