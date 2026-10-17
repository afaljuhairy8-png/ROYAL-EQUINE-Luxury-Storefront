# Deploy ROYAL EQUINE on Vercel

1. Import the storefront repository into Vercel.
2. Set **Root Directory** to `artifacts/royal-equine` and use the Next.js framework preset. This keeps Vercel from trying to build the Replit-only mockup sandbox.
3. Add these environment variables in Vercel for each environment you plan to deploy:
   - `MONGODB_URI` — MongoDB Atlas connection string.
   - `JWT_SECRET` — a randomly generated secret with at least 32 characters.
   - `ADMIN_EMAIL` — the email address allowed to use the admin dashboard.
4. Replit Secrets do not automatically transfer to Vercel. Add the values in Vercel’s project settings without committing them to the repository.
5. Confirm the Atlas network access rules allow connections from the Vercel runtime, then deploy. Vercel should detect the Next.js build and use its default `.next` output.

The Next.js app owns the `/api` routes, so no separate API project is needed on Vercel. The existing checkout records an order for follow-up; it does not process an online card payment.
