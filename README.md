# UU Attendance PWA

Attendance PWA for Uttara University Batch 67 sections. The app uses Vite React, Convex, Convex Auth with Google, PWA install support, existing Batch 67 routine data, and PDF attendance export.

## Current Scope

- University email restriction: `@uttara.ac.bd`
- Roles: `student` and `cr`
- Batch/section profile: starts with Batch 67, Sections A-D from the existing routine data
- CR opens an attendance window for a routine class
- Students only see active sessions for their own batch and section
- Backend validates attendance using server time
- CR can close a session, manually add attendance with a reason, invite another CR, and export PDF

## Local Setup

Install dependencies:

```bash
npm install
```

Start Convex:

```bash
npm run convex:dev
```

Convex will create a deployment and print a `VITE_CONVEX_URL`. Put that value in `.env.local`:

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Set the first CR email in Convex:

```bash
npx convex env set INITIAL_CR_EMAILS your-cr-email@uttara.ac.bd
```

Initialize Convex Auth keys:

```bash
npx @convex-dev/auth
```

Set Google OAuth credentials in Convex:

```bash
npx convex env set AUTH_GOOGLE_ID your-google-client-id
npx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
```

Google OAuth callback URL:

```txt
https://your-convex-site-url.convex.site/api/auth/callback/google
```

Then run the app:

```bash
npm run dev
```

## Routine Data

The app copies the existing file from:

```txt
../uu-routine-pwa/data/routine-data.js
```

into:

```txt
public/data/routine-data.js
```

The frontend reads that routine and passes the selected class snapshot to Convex when a CR opens attendance.
