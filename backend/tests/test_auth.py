"""
test_auth.py — Auth endpoint tests (sync, starlette TestClient).
"""


def test_academic_email_validation(client):
    # Non-academic email must be rejected (422 from Pydantic or 400)
    res = client.post("/auth/register", json={
        "email": "test@gmail.com",
        "username": "non_academic",
        "password": "Password123!",
        "full_name": "Test User",
        "dob": "2000-01-01",
        "department": "Computer Science"
    })
    assert res.status_code in (422, 400), f"Expected rejection for gmail.com, got {res.status_code}: {res.text}"


def test_valid_edu_registration(client):
    res = client.post("/auth/register", json={
        "email": "newstudent@stanford.edu",
        "username": "student_edu_unique1",
        "password": "Password123!",
        "full_name": "Stanford Student",
        "dob": "2001-05-10",
        "department": "Mechanical Engineering"
    })
    assert res.status_code == 200, f"Expected 200 for .edu, got {res.status_code}: {res.text}"
    assert res.json()["email"] == "newstudent@stanford.edu"


def test_valid_acin_registration(client):
    res = client.post("/auth/register", json={
        "email": "scholar@iitb.ac.in",
        "username": "scholar_acin_unique1",
        "password": "Password123!",
        "full_name": "IIT Scholar",
        "dob": "1999-08-20",
        "department": "Biosciences"
    })
    assert res.status_code == 200, f"Expected 200 for .ac.in, got {res.status_code}: {res.text}"
    assert res.json()["email"] == "scholar@iitb.ac.in"


def test_duplicate_email_rejected(client):
    # First registration
    client.post("/auth/register", json={
        "email": "duptest@stanford.edu",
        "username": "duptest_user_a",
        "password": "Password123!",
        "full_name": "Dup User",
        "dob": "2001-05-10",
        "department": "Mechanical Engineering"
    })
    # Second with same email
    res = client.post("/auth/register", json={
        "email": "duptest@stanford.edu",
        "username": "duptest_user_b",
        "password": "Password123!",
        "full_name": "Dup User 2",
        "dob": "2001-05-10",
        "department": "Mechanical Engineering"
    })
    assert res.status_code == 400
    assert "already exists" in res.text


def test_login_and_me(client):
    login_res = client.post("/auth/login", json={
        "identifier": "p.raman@inst.edu",
        "password": "UserPass123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    assert "resourcx_token" in login_res.cookies

    me_res = client.get("/auth/me")
    assert me_res.status_code == 200, f"/auth/me failed: {me_res.text}"
    body = me_res.json()
    assert body["username"] == "priya_raman"
    assert body["system_role"] == "user"
    client.cookies.clear()


def test_login_wrong_password(client):
    res = client.post("/auth/login", json={
        "identifier": "p.raman@inst.edu",
        "password": "WrongPassword!"
    })
    assert res.status_code == 401
