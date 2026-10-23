# Development Phases

## Phase 0: Foundation and safety baseline

- [x] Next.js frontend and FastAPI backend scaffolded.
- [x] Firebase authentication and role-aware client flow implemented.
- [x] ML inference, Grad-CAM, Cloudinary, and Qdrant integrations present.
- [ ] Remove committed secrets and local runtime/data artifacts from version control; rotate exposed credentials.
- [ ] Add environment templates and production-safe configuration validation.
- [ ] Restrict backend CORS and review Firebase/Firestore access rules for production.

## Phase 1: Secure authentication and roles

- [x] Email/password and Google Firebase sign-in.
- [x] User, doctor, and admin role routing.
- [x] Server-side doctor authorization on labelled uploads.
- [ ] Enforce server-side admin authorization for every admin operation.
- [ ] Add approval workflow for doctor accounts and account-management UX.

## Phase 2: User screening journey

- [x] Image upload with Firebase-token authentication.
- [x] Model prediction, confidence, similarity lookup, Cloudinary upload, and Grad-CAM generation.
- [x] Optional questionnaire context and severity calculation.
- [x] Chat-based follow-up guidance and chat persistence flow.
- [ ] Validate file type, file size, and image dimensions before processing.
- [ ] Make the result screen consistently show disclaimer, uncertainty, error recovery, and referral guidance.
- [ ] Reconcile questionnaire/image persistence onto Firestore; retire the legacy MongoDB dependency.

## Phase 3: Clinician and care-discovery tools

- [x] Doctor-labelled image contribution.
- [x] Nearby dermatologist lookup using consented location.
- [ ] Implement a clinician review queue for unverified cases.
- [ ] Add administrator review, audit visibility, and dataset quality controls.
- [ ] Replace the fallback sample clinics with clearly labelled, production-approved care-search behavior.

## Phase 4: Quality, privacy, and production readiness

- [ ] Add frontend component tests and FastAPI route/service tests.
- [ ] Add CI checks for linting, type safety, tests, dependency/security scanning, and secret scanning.
- [ ] Define image retention, deletion, consent withdrawal, and data-access policies.
- [ ] Validate model performance across relevant skin tones/conditions and document limitations.
- [ ] Complete threat modeling, clinical review, accessibility review, and deployment runbook.

## Definition of release-ready

- [ ] No known credential exposure; configuration is environment-based.
- [ ] Role and data-access controls have been tested.
- [ ] Upload, result, chat, deletion, and failure flows are tested end-to-end.
- [ ] Medical safety copy and escalation behavior have been clinically reviewed.
- [ ] Privacy policy, consent text, and data-retention behavior match the deployed system.

