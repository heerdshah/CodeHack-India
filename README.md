# ResourcX — Institutional Resource Sharing Platform

ResourcX is a multi-tenant resource-sharing system for university makerspaces, advanced robotics wings, chemistry labs, and film studios.

## Features
- **FastAPI Async Backend** with Pydantic v2 validation and role-based access control (`user`, `owner`, `manager`, `admin`).
- **Postgres Database (Supabase)** featuring `tstzrange` booking interval overlap exclusion constraints powered by `btree_gist`.
- **FIFO Waitlist Engine** with automatic promotion, 24-hour hold windows, and fair allocation policies.
- **Groq AI Integration**:
  - Optical verification of uploaded safety certificates against required qualifications.
  - Six-angle pre-check baseline & post-return damage comparison with bad-photo retry detection.
  - Objective incident summarization with human-in-the-loop owner approval.
  - Dynamically tailored equipment loan agreements rendered to SHA-256 hashed PDFs.
- **Split E-Signatures**: Independent signoff portals ensuring borrowers and owners execute agreements strictly within their authenticated roles.
- **Geocoded Discovery**: Haversine proximity calculation and "Near me" sorting.
- **Audit Logging**: Comprehensive actor, role, action, and state transition trail.

## Quickstart
See [SETUP.md](SETUP.md) for full setup instructions, Supabase migrations, and demo accounts.
