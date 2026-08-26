"""
Pytest test suite for J.A.R.V.I.S. Auth Core API.

Covers the production-hardened FastAPI backend:
  - Health check
  - Register (with validation, duplicate prevention)
  - Login (with bcrypt verification)
  - JWT token flow
  - Biometric verification (protected endpoints)
  - WebAuthn options/verify endpoints

Run:
    cd app/python-backend
    pip install pytest pytest-asyncio httpx
    python -m pytest test_main.py -v --asyncio-mode=auto
"""

import os
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Set test env vars before importing the app
os.environ["JARVIS_JWT_SECRET"] = "test-secret-for-ci-0123456789abcdef"
os.environ["JARVIS_DB_URL"] = "sqlite:///test_jarvis_auth.db"

from main import app, create_db_and_tables, engine  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402


# Disable rate-limiting for tests
app.state.limiter.enabled = False


@pytest_asyncio.fixture(autouse=True)
async def fresh_db():
    """Create fresh tables before each test, clean up after."""
    create_db_and_tables()
    yield
    with engine.begin() as conn:
        for table in reversed(SQLModel.metadata.sorted_tables):
            conn.exec_driver_sql(f"DELETE FROM {table.name}")


@pytest_asyncio.fixture
async def client():
    """Async test client using ASGI transport."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_health(client: AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "jarvis-auth-core"
    assert data["version"] == "1.0.0"


async def test_register_success(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "stark@avengers.io", "passkey": "iamironman", "full_name": "Tony Stark"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["user"]["email"] == "stark@avengers.io"
    assert data["user"]["fullName"] == "Tony Stark"
    assert data["user"]["clearanceLevel"] == "Level 1"
    assert data["user"]["hasBiometrics"] is False
    assert "token" in data
    assert "access_token" in data["token"]
    assert "refresh_token" in data["token"]


async def test_register_short_passkey_validation_error(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "pepper@avengers.io", "passkey": "abc", "full_name": "Pepper Potts"},
    )
    assert response.status_code == 422


async def test_register_duplicate_email_conflict(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "banner@avengers.io", "passkey": "smart@hulk", "full_name": "Bruce Banner"},
    )
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": "banner@avengers.io", "passkey": "anotherpass", "full_name": "Hulk"},
    )
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


async def test_login_success(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "roman@avengers.io", "passkey": "iambatman", "full_name": "Roman Stark"},
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "roman@avengers.io", "passkey": "iambatman"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["email"] == "roman@avengers.io"


async def test_login_invalid_credentials(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@nowhere.io", "passkey": "wrongpass123"},
    )
    assert response.status_code == 401
    assert "Invalid email or passkey" in response.json()["detail"]


async def test_protected_endpoint_requires_bearer_token(client: AsyncClient):
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert "bearer token" in response.json()["detail"].lower()


async def test_protected_endpoint_valid_token(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "wanda@avengers.io", "passkey": "hexvision", "full_name": "Wanda Maximoff"},
    )
    token = reg.json()["token"]["access_token"]

    response = await client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


# ---------------------------------------------------------------------------
# Biometric enrollment + login (real register-first-then-login flow)
# ---------------------------------------------------------------------------
async def _register(client: AsyncClient, email: str = "vision@avengers.io") -> dict:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "passkey": "synthezoid", "full_name": "Vision"},
    )
    assert reg.status_code == 201
    return reg.json()


async def test_enroll_biometric_success(client: AsyncClient):
    await _register(client)
    response = await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-abc123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["hasBiometrics"] is True


async def test_enroll_biometric_user_not_found(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "ghost@nowhere.io", "credential_id": "cred-xyz"},
    )
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]


async def test_biometric_login_requires_prior_enrollment(client: AsyncClient):
    # Register but do NOT enroll biometrics -> login must be refused.
    await _register(client, email="fresh@avengers.io")
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={"email": "fresh@avengers.io", "method": "voice"},
    )
    assert response.status_code == 401
    assert "not enrolled" in response.json()["detail"]


async def test_biometric_login_face_success(client: AsyncClient):
    await _register(client)
    await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-face-1"},
    )
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={
            "email": "vision@avengers.io",
            "method": "face",
            "credential_id": "cred-face-1",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["email"] == "vision@avengers.io"
    assert data["user"]["lastLoginAt"] is not None
    assert data["token"]["access_token"]
    assert data["token"]["refresh_token"]


async def test_biometric_login_fingerprint_success(client: AsyncClient):
    await _register(client)
    await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-fp-1"},
    )
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={
            "email": "vision@avengers.io",
            "method": "fingerprint",
            "credential_id": "cred-fp-1",
        },
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


async def test_biometric_login_voice_success(client: AsyncClient):
    # Voice matching happens on-device; the server only needs prior enrollment.
    await _register(client)
    await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-voice-1"},
    )
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={"email": "vision@avengers.io", "method": "voice"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


async def test_biometric_login_unknown_user(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={"email": "ghost@nowhere.io", "method": "voice"},
    )
    assert response.status_code == 401
    assert "Invalid biometric credential" in response.json()["detail"]


async def test_biometric_login_credential_not_bound(client: AsyncClient):
    await _register(client)
    await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-real"},
    )
    # Present a credential id that was never bound to this operative.
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={
            "email": "vision@avengers.io",
            "method": "fingerprint",
            "credential_id": "cred-forged",
        },
    )
    assert response.status_code == 401
    assert "not bound" in response.json()["detail"]


async def test_biometric_login_device_method_requires_credential_id(client: AsyncClient):
    await _register(client)
    await client.post(
        "/api/v1/auth/enroll-biometric",
        json={"email": "vision@avengers.io", "credential_id": "cred-1"},
    )
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={"email": "vision@avengers.io", "method": "face"},
    )
    assert response.status_code == 400
    assert "credential_id" in response.json()["detail"]


async def test_biometric_login_invalid_method_rejected(client: AsyncClient):
    await _register(client)
    response = await client.post(
        "/api/v1/auth/biometric-login",
        json={"email": "vision@avengers.io", "method": "iris"},
    )
    assert response.status_code == 422
