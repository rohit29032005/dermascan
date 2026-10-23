/**
 * API configuration for frontend.
 * Reads backend API Base URL from environment variable NEXT_PUBLIC_API_URL in production,
 * falling back to local backend for local development.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, ""); // Remove trailing slash if present
