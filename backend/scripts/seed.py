"""
Seed Script for ResourcX
Inserts demo users, resources with coordinates, sample bookings, and credentials.
Usage: python backend/scripts/seed.py
"""
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_db_connection():
    if not DATABASE_URL or "your-project-id" in DATABASE_URL:
        print("[!] DATABASE_URL not set or contains placeholder.")
        print("Please configure DATABASE_URL in backend/.env before running the seed script.")
        sys.exit(0)
    try:
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"[!] Database connection error: {e}")
        sys.exit(1)

def seed_data():
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor()

    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hash_pwd = lambda p: pwd_context.hash(p)
    except Exception:
        # Fallback if passlib not installed
        import hashlib
        hash_pwd = lambda p: hashlib.sha256(p.encode()).hexdigest()

    print("Seeding demo users...")
    users = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "admin@inst.edu",
            "username": "admin",
            "password": hash_pwd("AdminPass123!"),
            "full_name": "System Administrator",
            "dob": "1985-05-15",
            "academic_role": "Faculty",
            "department": "Computer Science",
            "system_role": "admin",
            "is_verified": True
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "email": "mira.okafor@inst.edu",
            "username": "mira_okafor",
            "password": hash_pwd("OwnerPass123!"),
            "full_name": "Dr. Mira Okafor",
            "dob": "1982-08-20",
            "academic_role": "Faculty",
            "department": "Mechanical Engineering",
            "system_role": "owner",
            "is_verified": True
        },
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "email": "anders.halden@inst.edu",
            "username": "anders_halden",
            "password": hash_pwd("OwnerPass123!"),
            "full_name": "Prof. Anders Halden",
            "dob": "1978-03-12",
            "academic_role": "Faculty",
            "department": "Computer Science",
            "system_role": "owner",
            "is_verified": True
        },
        {
            "id": "44444444-4444-4444-4444-444444444444",
            "email": "p.raman@inst.edu",
            "username": "priya_raman",
            "password": hash_pwd("UserPass123!"),
            "full_name": "Priya Raman",
            "dob": "1998-11-04",
            "academic_role": "Researcher",
            "department": "Mechanical Engineering",
            "system_role": "user",
            "is_verified": True
        },
        {
            "id": "55555555-5555-5555-5555-555555555555",
            "email": "t.reyes@inst.edu",
            "username": "tomas_reyes",
            "password": hash_pwd("UserPass123!"),
            "full_name": "Tomás Reyes",
            "dob": "2002-04-18",
            "academic_role": "Student",
            "department": "Media & Film",
            "system_role": "user",
            "is_verified": True
        }
    ]

    for u in users:
        cur.execute("""
            INSERT INTO users (id, email, username, password_hash, full_name, dob, academic_role, department, system_role, is_verified)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                system_role = EXCLUDED.system_role,
                is_verified = EXCLUDED.is_verified;
        """, (u["id"], u["email"], u["username"], u["password"], u["full_name"], u["dob"], u["academic_role"], u["department"], u["system_role"], u["is_verified"]))

    print("Seeding demo resources with real coordinates...")
    resources = [
        {
            "id": "cnc-5axis",
            "name": "5-Axis CNC Mill",
            "department": "Mechanical Engineering",
            "category": "Robotics & Fabrication",
            "owner_id": "22222222-2222-2222-2222-222222222222",
            "location": "Fabrication Hall B, Bay 3",
            "building": "Engineering Complex North",
            "floor": "Ground Floor",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "image": "/images/res-robotics.jpg",
            "description": "Haas UMC-750 with tool probing for aluminium, brass, and engineering plastics.",
            "condition": "Serviced Oct 2026",
            "criteria": ["Lab Safety Level 2 Certification", "CNC Operator Clearance"],
            "rules": ["Eye and hearing protection mandatory", "Maximum spindle run 4 continuous hours", "Post-op chip vacuuming required"]
        },
        {
            "id": "ur10-cobot",
            "name": "UR10e Collaborative Arm",
            "department": "Computer Science",
            "category": "Robotics & Fabrication",
            "owner_id": "33333333-3333-3333-3333-333333333333",
            "location": "Robotics Wing, Cell 2",
            "building": "Turing Science Center",
            "floor": "2nd Floor",
            "latitude": 37.7758,
            "longitude": -122.4180,
            "image": "/images/res-robotics.jpg",
            "description": "12.5 kg payload cobot with force-torque sensing and ROS 2 integration.",
            "condition": "Excellent",
            "criteria": ["Cobot Safety Certification"],
            "rules": ["E-stop tested prior to script execution", "Gripper payload under 12.5 kg"]
        },
        {
            "id": "sla-printer",
            "name": "Industrial SLA Printer",
            "department": "Architecture & Design",
            "category": "Robotics & Fabrication",
            "owner_id": "22222222-2222-2222-2222-222222222222",
            "location": "Makerspace Level 1",
            "building": "Design Hub",
            "floor": "1st Floor",
            "latitude": 37.7735,
            "longitude": -122.4210,
            "image": "/images/res-robotics.jpg",
            "description": "Large-format resin printing for architectural models and precision prototypes.",
            "condition": "Good — new resin vat",
            "criteria": ["Lab Safety Level 2 Certification", "3D Fabrication Clearance"],
            "rules": ["Nitrile gloves required when handling resin", "Wash vat with IPA only"]
        },
        {
            "id": "hplc",
            "name": "HPLC System",
            "department": "Chemistry",
            "category": "Analytical Equipment",
            "owner_id": "22222222-2222-2222-2222-222222222222",
            "location": "Chem Block, Lab 214",
            "building": "Franklin Chemical Labs",
            "floor": "2nd Floor",
            "latitude": 37.7765,
            "longitude": -122.4230,
            "image": "/images/res-analytical.jpg",
            "description": "Agilent 1260 Infinity II with diode-array detection and autosampler.",
            "condition": "Calibrated Sep 2026",
            "criteria": ["Chemical Hygiene Training"],
            "rules": ["Filter all mobile phases through 0.22 um", "Log column pressure at start"]
        },
        {
            "id": "confocal",
            "name": "Confocal Microscope",
            "department": "Biosciences",
            "category": "Analytical Equipment",
            "owner_id": "33333333-3333-3333-3333-333333333333",
            "location": "Bio Imaging Core",
            "building": "Biomedical Research Center",
            "floor": "3rd Floor",
            "latitude": 37.7770,
            "longitude": -122.4160,
            "image": "/images/res-analytical.jpg",
            "description": "Four-laser confocal with live-cell incubation chamber and spectral detection.",
            "condition": "Excellent",
            "criteria": ["Biosafety Level 2 Training", "Lab Safety Level 2 Certification"],
            "rules": ["Laser warmup required 15 min", "Clean immersion objectives with lens paper only"]
        },
        {
            "id": "sound-stage",
            "name": "Sound Stage & Grid",
            "department": "Media & Film",
            "category": "Studios & Spaces",
            "owner_id": "33333333-3333-3333-3333-333333333333",
            "location": "Media House, Stage A",
            "building": "Creative Arts Pavilion",
            "floor": "Ground Floor",
            "latitude": 37.7720,
            "longitude": -122.4175,
            "image": "/images/res-studio.jpg",
            "description": "Acoustically treated 200 m² stage with lighting grid, cyclorama, and control room.",
            "condition": "Good",
            "criteria": ["Studio Induction"],
            "rules": ["Maximum 25 people in studio", "No liquids near lighting dimmer packs"]
        }
    ]

    for r in resources:
        cur.execute("""
            INSERT INTO resources (id, name, department, category, owner_id, location, building, floor, latitude, longitude, image, description, condition, criteria, rules)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                location = EXCLUDED.location,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                description = EXCLUDED.description,
                criteria = EXCLUDED.criteria,
                rules = EXCLUDED.rules;
        """, (r["id"], r["name"], r["department"], r["category"], r["owner_id"], r["location"], r["building"], r["floor"], r["latitude"], r["longitude"], r["image"], r["description"], r["condition"], r["criteria"], r["rules"]))

    print("Seeding sample credentials...")
    cur.execute("""
        INSERT INTO user_credentials (id, user_id, credential_name, issuing_body, issue_date, expiry_date, document_path, status, ai_analysis)
        VALUES 
        ('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444444', 'Lab Safety Level 2 Certification', 'Campus EHS Division', '2026-01-15', '2027-01-15', 'verification-docs/demo_lab_safety.pdf', 'approved', '{"confidence": 0.98, "matches_requirement": true, "name_match": true, "reasons": ["Valid certificate issued by Campus EHS Division"]}'::jsonb),
        ('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444444', 'CNC Operator Clearance', 'Fab Lab Training Board', '2026-02-10', '2027-02-10', 'verification-docs/demo_cnc_cert.pdf', 'approved', '{"confidence": 0.95, "matches_requirement": true, "name_match": true, "reasons": ["Clearance verified"]}'::jsonb),
        ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555555', 'Studio Induction', 'Media Production Department', '2026-03-01', '2027-03-01', 'verification-docs/demo_studio_ind.pdf', 'approved', '{"confidence": 0.99, "matches_requirement": true, "name_match": true, "reasons": ["Induction records complete"]}'::jsonb)
        ON CONFLICT (id) DO NOTHING;
    """)

    print("\n[OK] Database seeded successfully!")
    cur.close()
    conn.close()

if __name__ == "__main__":
    seed_data()

