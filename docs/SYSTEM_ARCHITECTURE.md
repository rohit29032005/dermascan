# System Architecture

## Tech stack

| Layer | Current technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript, App Router |
| Styling and motion | Tailwind CSS 4, Framer Motion, Lucide icons |
| Client authentication and app data | Firebase Authentication and Cloud Firestore |
| API | Python, FastAPI, Uvicorn, Pydantic |
| ML | PyTorch, Torchvision, Pillow, OpenCV, Grad-CAM |
| Image and vector storage | Cloudinary and Qdrant |
| AI chat | OpenAI-compatible client configured for OpenRouter |
| External care search | Google Places API through HTTPX |
| Legacy data paths | MongoDB is still referenced by `auth_routes.py` and `question_routes.py` |

## Repository structure

```text
ai-derma-assistant/
├── frontend/                    # Next.js application
│   ├── src/app/                 # Route pages and global styles
│   ├── src/components/          # Auth, chat, doctor dashboard, route guard
│   ├── src/context/             # Firebase auth/role context
│   └── src/lib/firebase.ts      # Firebase client configuration
├── backend/                     # FastAPI service
│   ├── main.py                  # App setup, CORS, route registration
│   └── app/
│       ├── routes/              # Auth, image, questionnaire, chat, doctor APIs
│       ├── services/            # Firebase, ML, Grad-CAM, vector integrations
│       ├── schemas/             # Request validation models
│       └── utils/               # Auth, image hash, severity, security helpers
├── ml/                          # Training scripts, weights, and HAM10000 data
└── docs/                        # Product and engineering context
```

## App flow

```text
Visitor → Firebase sign-in / registration → role-based route
  User   → Chat → questionnaire and image upload → FastAPI
         → model prediction + Grad-CAM + Qdrant similarity + Cloudinary storage
         → result stored in user chat → cautious AI follow-up → dermatologist search
  Doctor → Doctor dashboard → authenticated labelled image upload → Cloudinary + Firestore dataset_images
  Admin  → Admin dashboard
```

## Core data flow

1. The frontend authenticates with Firebase and sends the Firebase ID token as a bearer token to FastAPI.
2. `POST /api/upload-image` receives an image and chat context, calls the ML and heatmap services, uploads the original to Cloudinary, stores its feature vector in Qdrant, and records dataset metadata in Firestore.
3. The frontend owns the lifecycle of user chat messages in `users/{userId}/chats/{chatId}/messages`; `POST /api/chat` reads that history and returns a text reply.
4. `POST /api/doctor-upload` verifies the user’s Firebase role before adding a verified clinical case to Firestore.

## Key decisions and constraints

- **Firebase is the intended identity and application-data source.** New work should use Firebase auth and Firestore unless a deliberate migration plan says otherwise.
- **MongoDB routes are legacy/inconsistent.** The questionnaire route expects Mongo image records while the upload route writes Firestore metadata. Do not extend this mismatch; consolidate it in a dedicated migration phase.
- **API configuration must be environment-based.** Firebase credentials, Cloudinary credentials, OpenRouter/OpenAI key, Google Maps key, Mongo URI (while migration remains), and allowed frontend origins belong in environment configuration, never source control.
- **CORS must be restricted for production.** The present wildcard configuration is suitable only for local development.
- **The ML prediction is supportive evidence, not a diagnosis.** Preserve disclaimers and clinician escalation paths throughout the UI and API.
- **Provider failures must degrade safely.** An unavailable location provider may return the existing sample response; medical predictions and chat must return clear failures rather than fabricated results.

