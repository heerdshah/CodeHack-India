# ResourcX Setup & Deployment Guide

This guide contains the exact steps to configure, seed, and launch the ResourcX platform (Next.js 16 frontend + FastAPI backend + Supabase Postgres & Storage + Groq AI).

---

## 1. Prerequisites
- **Node.js** (v18+ or v20+) and **npm**
- **Python** (v3.10+ or v3.11+) and **pip**
- A free **Supabase** account ([supabase.com](https://supabase.com))
- A free **Groq** account ([console.groq.com](https://console.groq.com))

---

## 2. Supabase Setup (Database & Storage)

1. **Create a New Project**:
   - Log in to [database.new](https://database.new) and create a new project named `resourcx`.
   - Set a strong database password and choose your nearest region.

2. **Retrieve API Keys and Connection String**:
   - Go to **Project Settings** -> **API**:
     - Copy `Project URL` -> Set as `SUPABASE_URL` in `backend/.env`.
     - Copy `anon` `public` key -> Set as `SUPABASE_ANON_KEY` in `backend/.env` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
     - Copy `service_role` `secret` key -> Set as `SUPABASE_SERVICE_KEY` in `backend/.env`.
     - Copy the project's JWT signing secret -> Set as `SUPABASE_JWT_SECRET` in `backend/.env`. This stays server-side and is used only to issue short-lived participant tokens for Realtime.
     - Set the project URL as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
   - Go to **Project Settings** -> **Database** -> **Connection string** (URI):
     - Copy the connection URI (replace `[YOUR-PASSWORD]` with your real password) -> Set as `DATABASE_URL` in `backend/.env`.

3. **Run Migrations**:
   - Go to the **SQL Editor** in your Supabase Dashboard.
   - Run the migration files in order from `backend/migrations/`:
     - `001_users.sql`
     - `002_resources.sql`
     - `003_credentials.sql`
     - `004_bookings.sql`
     - `005_agreements.sql`
     - `006_waitlist.sql`
     - `007_inspections.sql`
     - `008_incidents.sql`
     - `009_notifications_audit_flags.sql`
     - `010_rls.sql`
     - `011_chat.sql`
     - `012_direct_username_chat.sql`
     - `storage.sql`
   - *Alternatively, run the automated migration script:*
     ```bash
     python backend/scripts/apply_migrations.py
     ```
   - If migrations `001`–`011` have already been applied to an existing project, run only `012_direct_username_chat.sql` to enable username-started direct conversations.

4. **Verify Storage Buckets**:
   - Go to **Storage** in Supabase: verify that `verification-docs`, `booking-proofs`, `inspection-photos`, `incident-photos`, and `agreements` are present and marked Private.
   - For an existing project, run the updated `backend/migrations/storage.sql` in the SQL Editor to add the private `booking-proofs` bucket required for booking attachments.

---

## 3. Groq API Key Setup

1. Visit [console.groq.com/keys](https://console.groq.com/keys) and generate an API key.
2. In `backend/.env`, set:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
   GROQ_TEXT_MODEL=llama-3.3-70b-versatile
   ```
   *(Confirm model names at [console.groq.com/docs/models](https://console.groq.com/docs/models))*

---

## 4. Environment Files Setup

1. Copy backend example file:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Copy frontend example file:
   ```bash
   cp .env.example .env.local
   ```
3. Fill in your credentials in `backend/.env`.

---

## 5. Backend Installation & Seeding

1. Install Python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Seed Demo Data (Admin, Owners, Borrowers, and 6 Geocoded Resources):
   ```bash
   python backend/scripts/seed.py
   ```

3. Start the FastAPI server:
   ```bash
   python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Backend will be running at: `http://localhost:8000` (Docs at `http://localhost:8000/docs`).

---

## 6. Frontend Installation & Execution

1. In the root directory:
   ```bash
   npm install
   ```

2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   Frontend will be running at: `http://localhost:3000`.

---

## 7. Demo Accounts

- **Administrator**: `admin@inst.edu` / `AdminPass123!`
- **Facility Owner (MechE / Fab)**: `mira.okafor@inst.edu` / `OwnerPass123!`
- **Facility Owner (Robotics / CS)**: `anders.halden@inst.edu` / `OwnerPass123!`
- **Researcher (Borrower)**: `p.raman@inst.edu` / `UserPass123!`
- **Student (Borrower)**: `t.reyes@inst.edu` / `UserPass123!`
