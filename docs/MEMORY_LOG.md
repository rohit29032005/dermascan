# Memory Log

Keep this short and factual. Append an entry after a completed feature, architectural decision, migration, or significant investigation. Do not store secrets, personal data, raw health data, or full provider errors here.

## 2026-09-09 — Project context established

- Added project requirements, architecture, coding rules, development phases, design system, and this memory log.
- Confirmed current stack: Next.js/Firebase frontend; FastAPI backend; PyTorch ML, Grad-CAM, Cloudinary, Qdrant, OpenRouter-compatible chat, and Google Places integration.
- Confirmed role flows for user, doctor, and admin exist in the frontend; doctor uploads are checked server-side.
- Identified an architectural inconsistency: new image/chat metadata is handled in Firestore, while `auth_routes.py` and `question_routes.py` still use MongoDB. Treat migration/consolidation as a planned task, not a pattern to extend.

## 2026-10-23 — Live Production Deployment Blueprint Created

- Authored `docs/LIVE_DEPLOYMENT_CORE_DOC.md` detailing multi-cloud serverless production architecture: Vercel (Frontend Next.js 16) + Google Cloud Run / Render (FastAPI + PyTorch CPU container) + Firebase Auth/Firestore + Qdrant Cloud Free Tier + Cloudinary CDN.
- Identified 7 critical pre-deployment blockers: hardcoded localhost frontend API URLs, ML model path container resolution, local Qdrant filesystem persistence in ephemeral containers, super-admin plain text credentials in client bundle, wide-open CORS (`*`), and insecure Firestore rules (`allow read, write: if true`).
- Provided step-by-step launch checklist, cost model ($0 - $10/month), Dockerfile optimizations, and post-launch verification matrix.


