---
name: ROYAL EQUINE Next.js deployment
description: The chosen storefront/API ownership and Vercel deployment setup.
---

The Vercel storefront is the Next.js app; it owns `/api`. Keep the mockup sandbox in Replit. The old Express service is only a Replit fallback under `/legacy-api`. Shared server code keeps MongoDB models, password hashing, and JWT behavior aligned across both runtimes.

**Why:** The user chose one Next.js storefront with API routes for Vercel while keeping the design sandbox in Replit. Moving the Express service off `/api` avoids route conflicts while preserving a fallback.

**How to apply:** Set Vercel’s root directory to `artifacts/royal-equine` and configure `MONGODB_URI`, `JWT_SECRET`, and `ADMIN_EMAIL` there. Implement future `/api` behavior in the Next.js routes and shared server library.
