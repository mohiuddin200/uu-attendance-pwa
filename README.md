# UU Attendance PWA

Attendance PWA for Uttara University Batch 67 sections. The app uses Vite React, Convex, Convex Auth password login, PWA install support, existing Batch 67 routine data, and PDF attendance export.

## Current Scope

- Manual email/password auth restricted to `@uttara.ac.bd`
- Roles: `student` and `cr`
- Batch/section profile: starts with Batch 67, Sections A-D from the existing routine data
- Public signup always creates active student accounts
- Student ID is derived from the part before `@` in each university email
- First CR email is controlled by Convex env `INITIAL_CR_EMAILS`
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

Initialize Convex Auth keys:

```bash
npx @convex-dev/auth
```

Set the first CR email in Convex:

```bash
npx convex env set INITIAL_CR_EMAILS your-cr-email@uttara.ac.bd
```

Then run the app:

```bash
npm run dev
```

Students can create accounts with full name, `@uttara.ac.bd` email, 4+ character password, batch, and section. The stored student ID is derived from the email before `@`. OTP/email verification is intentionally not enabled yet.

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
