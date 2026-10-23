# Project Requirements Document

## Project name

AI Derma Assistant (also presented in the UI as DermaScan)

## Goal

Provide a safe, AI-assisted skin-lesion screening experience that lets people upload a skin image, receive an explainable model result and supportive educational guidance, then find a dermatologist when appropriate. The product must make clear that it is not a diagnosis or a substitute for clinical care.

## Target users

- People seeking preliminary information about a skin concern.
- Dermatologists who contribute verified, labelled clinical images to improve the research dataset.
- Administrators who review and manage platform activity.

## Core features

- **Authentication and roles:** Email/password and Google sign-in through Firebase, with user, doctor, and admin roles.
- **Skin-image analysis:** Authenticated users upload an image; the backend runs the trained skin-lesion model, creates a Grad-CAM heatmap, and returns confidence, similar cases, and a severity indicator when questionnaire information is available.
- **Guided chat:** An AI assistant uses the current chat history, image-analysis context, and optional questionnaire answers to provide cautious, non-diagnostic guidance.
- **Care discovery:** With consented location data, users can find nearby dermatologists through Google Places, with a safe sample response when the API key is unavailable.
- **Clinical contribution:** Doctors can upload labelled images and notes for the research dataset.
- **Conversation management:** Users can store and delete chat conversations and messages in their own Firebase data.

## Safety, privacy, and product constraints

- Display a clear medical disclaimer before or alongside every prediction and chat response: outputs are informational and a certified dermatologist should provide medical advice or diagnosis.
- Never describe a model result as definitive, guarantee an outcome, or suggest delaying urgent medical care.
- Require Firebase authentication for personal data, uploads, chats, and clinician tools.
- Treat images, location, chat content, and health information as sensitive. Minimize collection, restrict access by role, and never commit secrets or service-account keys.
- Obtain clear user consent before collecting browser location or uploading images.
- The product is a screening/research assistant, not a regulated diagnostic device; clinical, privacy, legal, and security review is required before production use.

## Out of scope for the current product

- Diagnosis, prescriptions, emergency triage, or replacing a clinical examination.
- Autonomous treatment plans.
- Retraining or deploying a model automatically from user-submitted images.
- Public sharing of uploaded images, medical history, or chat content.

## Success criteria

- A signed-in user can complete upload, analysis, explanation, and follow-up guidance without exposing another user’s data.
- Every result shows prediction confidence, an uncertainty-aware disclaimer, and an understandable next action.
- A verified doctor can contribute a labelled image; it is stored as verified dataset metadata.
- Role-specific pages deny access to unauthorized users.
- Error, loading, empty, and denied-permission states are usable and do not leak internal provider details.
- The frontend passes lint/build checks and backend routes have proportionate automated tests before release.

