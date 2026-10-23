# AI Boundaries and Coding Rules

## Allowed libraries and platforms

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Firebase, Framer Motion, Lucide React, React Markdown, and existing project dependencies.
- Backend: FastAPI, Pydantic, Firebase Admin, PyTorch/Torchvision, OpenCV, Pillow, Qdrant client, Cloudinary, HTTPX, and the existing OpenAI-compatible client.
- Testing additions may use the ecosystem’s standard tools when introduced with configuration and documentation.

## Do not introduce without explicit approval

- jQuery, a second UI framework, a second global state library, or a second CSS system.
- A replacement authentication or database provider.
- A new paid API, telemetry/analytics SDK, browser tracker, or externally hosted health-data service.
- Automated medical decisions, treatment advice, prescription guidance, or model retraining from unreviewed user uploads.

## Coding standards

- Use TypeScript for all new frontend code. Prefer small, focused client components and typed props/data models; avoid `any`.
- Use `PascalCase` for React components, `camelCase` for variables/functions, and clear `snake_case` for Python modules/functions.
- Keep API payload names consistent end-to-end. Validate backend input with Pydantic and return stable, documented error shapes.
- Prefer existing aliases (`@/…`) and established component patterns in the frontend.
- Use Tailwind utility classes and the design tokens in `DESIGN_SYSTEM.md`; avoid scattered, unexplained hard-coded values when a reusable token fits.
- Run `npm run lint` in `frontend` after frontend changes. Add focused tests for API/business logic changes and run the relevant checks before declaring work complete.

## Authentication, authorization, and data handling

- Authenticate protected FastAPI routes with the existing Firebase token dependency.
- Verify role server-side for doctor/admin-only operations. Client-side protected routes are a usability layer, not security.
- Scope Firestore queries and storage paths to the authenticated user unless the operation is explicitly privileged.
- Never log, expose, commit, or paste credentials, raw bearer tokens, service-account keys, medical images, location coordinates, or complete chat transcripts.
- Do not alter or delete user data in bulk without an explicit, reviewed request.

## Medical-AI safety rules

- Say “model result,” “screening,” or “prediction,” never “diagnosis.”
- Keep the consultation disclaimer in all result and chat experiences.
- Avoid certainty language, alarming statements without escalation guidance, and recommendations to ignore symptoms or postpone professional care.
- Preserve a clear pathway to a dermatologist; flag urgent-care messaging for a separately reviewed clinical-content change.

## Error handling

- Return actionable, user-safe messages and appropriate HTTP status codes; keep stack traces and vendor details in server logs only.
- Always clean up temporary image files in success and error paths.
- Show loading, failure, retry, empty, and permission-denied states in the frontend.
- Never silently substitute an invented clinical result when a model, storage provider, or AI provider fails.

## Never do

- Commit `.env` files, Firebase service account JSON, trained-image datasets, generated runtime storage, or provider secrets.
- Weaken CORS, Firestore rules, or authorization checks to make a feature work.
- Modify model weights, labels, dataset contents, or medical safety text without an explicit request and validation plan.
- Expand the legacy MongoDB path; migrate or isolate it instead.

