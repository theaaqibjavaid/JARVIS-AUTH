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
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Ensure vendored deps are importable
VENDOR_DIR = os.path.join(os.path.dirname(__file__), "vendor")
if VENDOR_DIR not in os.sys.path:
    os.sys.path.insert(0, VENDOR_DIR)

# Set test env vars before importing the app
os.environ["JARVIS_JWT_SECRET"] = "test-secret-for-ci"
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
    response = await client.post(
        "/api/v1/auth/verify-fingerprint",
        data={"scan_data": "fake-scan"},
    )
    assert response.status_code == 401
    assert "bearer token" in response.json()["detail"].lower()


async def test_protected_endpoint_valid_token(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "wanda@avengers.io", "passkey": "hexvision", "full_name": "Wanda Maximoff"},
    )
    token = reg.json()["token"]["access_token"]

    response = await client.post(
        "/api/v1/auth/verify-fingerprint",
        data={"scan_data": "valid-fingerprint-data"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["hasBiometrics"] is True


async def test_webauthn_options(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"email": "vision@avengers.io", "passkey": "synthezoid", "full_name": "Vision"},
    )
    response = await client.get(
        "/api/v1/auth/webauthn/options",
        params={"email": "vision@avengers.io"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "challenge" in data
    assert data["rpName"] == "J.A.R.V.I.S."
    assert data["rpId"] == "localhost"


async def test_webauthn_options_user_not_found(client: AsyncClient):
    response = await client.get(
        "/api/v1/auth/webauthn/options",
        params={"email": "ghost@nowhere.io"},
    )
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]
