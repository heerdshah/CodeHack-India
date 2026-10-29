"""
Migration Runner Script
Runs all ordered SQL files in backend/migrations against DATABASE_URL.
Usage: python backend/scripts/apply_migrations.py
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from backend/.env or root .env
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migrations():
    if not DATABASE_URL or "your-project-id" in DATABASE_URL:
        print("[!] DATABASE_URL not set or contains placeholder.")
        print("Please configure DATABASE_URL in backend/.env before running migrations.")
        print("Alternatively, copy and paste the SQL files directly into the Supabase SQL Editor.")
        sys.exit(0)

    try:
        import psycopg2
    except ImportError:
        print("[!] psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    migrations_dir = Path(__file__).parent.parent / "migrations"
    sql_files = sorted([f for f in migrations_dir.glob("*.sql") if f.name != "storage.sql"])
    
    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        print("Successfully connected to database.\n")

        for sql_file in sql_files:
            print(f"Applying migration: {sql_file.name}...")
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_content = f.read()
            cursor.execute(sql_content)
            print(f"  [OK] Applied {sql_file.name}")

        # Optionally apply storage.sql
        storage_file = migrations_dir / "storage.sql"
        if storage_file.exists():
            print("Applying storage configuration: storage.sql...")
            with open(storage_file, "r", encoding="utf-8") as f:
                storage_sql = f.read()
            cursor.execute(storage_sql)
            print("  [OK] Applied storage.sql")

        print("\nAll database migrations successfully executed!")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[!] Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()

