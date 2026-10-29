"""
conftest.py — Synchronous Starlette TestClient fixtures for ResourcX.
Creates separate TestClient instances for separate roles/actors so cookies don't interfere.
Provides autouse fixture that resets and reseeds booking store before each test.
"""
import os
os.environ["TESTING"] = "1"

import sys
from pathlib import Path
import pytest

root_dir = Path(__file__).parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.repositories.booking_repo import booking_repo


@pytest.fixture(autouse=True)
def reset_booking_store():
    """Autouse fixture to reset and reseed in-memory booking repository before each test."""
    booking_repo.reset()
    yield
    booking_repo.reset()


@pytest.fixture
def client():
    """Unauthenticated sync TestClient."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def user_client():
    """TestClient authenticated as user priya_raman (p.raman@inst.edu)."""
    with TestClient(app, raise_server_exceptions=True) as c:
        r = c.post("/auth/login", json={
            "identifier": "p.raman@inst.edu",
            "password": "UserPass123!"
        })
        assert r.status_code == 200, f"User login failed: {r.text}"
        yield c


@pytest.fixture
def tomas_client():
    """TestClient authenticated as borrower tomas_reyes (t.reyes@inst.edu)."""
    with TestClient(app, raise_server_exceptions=True) as c:
        r = c.post("/auth/login", json={
            "identifier": "t.reyes@inst.edu",
            "password": "UserPass123!"
        })
        assert r.status_code == 200, f"Tomás login failed: {r.text}"
        yield c


@pytest.fixture
def owner_client():
    """TestClient authenticated as owner anders_halden (anders.halden@inst.edu)."""
    with TestClient(app, raise_server_exceptions=True) as c:
        r = c.post("/auth/login", json={
            "identifier": "anders.halden@inst.edu",
            "password": "OwnerPass123!"
        })
        assert r.status_code == 200, f"Owner login failed: {r.text}"
        yield c


@pytest.fixture
def mira_client():
    """TestClient authenticated as owner mira_okafor (mira.okafor@inst.edu)."""
    with TestClient(app, raise_server_exceptions=True) as c:
        r = c.post("/auth/login", json={
            "identifier": "mira.okafor@inst.edu",
            "password": "OwnerPass123!"
        })
        assert r.status_code == 200, f"Mira login failed: {r.text}"
        yield c
