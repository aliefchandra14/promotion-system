# Promotion System

Employee promotion management system — Express + MSSQL backend, React + Vite + Tailwind frontend.

## Stack

- **Server**: Express 5, Sequelize (MSSQL/tedious), JWT auth via httpOnly cookie
- **Client**: React 19, Vite, Tailwind CSS v4, React Router, React Hook Form

## Getting started

### 1. Server

```bash
cd server
npm install
cp .env.example .env.development   # fill in your MSSQL credentials
npm run dev
```

On first run it connects to MSSQL, creates tables, and seeds a default admin account
(`ADMIN_EMPLOYEE_ID` / `ADMIN_PASSWORD` from your `.env`).

Optional: `npm run seed` populates ~45 sample employees (org hierarchy: HOD → Manager → Staff)
across 5 departments for local testing.

### 2. Client

```bash
cd client
npm install
cp .env.example .env.development
npm run dev
```

App is served under the `/promotionsystem` base path, e.g. `http://localhost:5173/promotionsystem/login`.

## Notes

- A promotion **period** must be created and activated (admin only) before regular employees
  can log in — this is an intentional gate, not a bug.
- Grade and department option lists live in `constants/grades.js` and `constants/departments.js`
  (both client and server) — edit those arrays directly as the org structure changes.
- Email notifications (period activation) are stubbed in `server/services/emailService.js`.
  Set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` in `.env` to enable real sending; until then it
  just logs what would have been sent.
