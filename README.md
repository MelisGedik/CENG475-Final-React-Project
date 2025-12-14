Movie Recommendation Platform

Overview
- Full-stack app with React (client) and Node/Express + SQLite (server).
- Features: auth (sign up/in), movies catalog, search/filter, ratings & reviews, personalized recommendations, and an admin panel (manage movies and user roles).

Stack
- Frontend: React + React Router + Axios + Vite
- Backend: Node + Express + better-sqlite3 + JWT + bcryptjs
- DB: SQLite (file at `server/data/app.db`)

Local Setup
Prerequisites
- Node.js 18+ and npm

1) Server
- cd server
- npm install
- set JWT_SECRET=your_secret_here (PowerShell) or export JWT_SECRET=...
- npm start
- Server runs at http://localhost:4000

Notes
- DB schema auto-creates on first run and seeds sample movies.
- The first user who registers becomes admin automatically (so you can access the Admin panel immediately). You can later change roles in the Admin panel.

2) Client
- Open a new terminal
- cd client
- npm install
- npm run dev
- Client runs at http://localhost:5173

One-Command Dev (from repo root)
- npm install
- npm run dev
- This installs client and server packages and starts both concurrently:
  - API at http://localhost:4000
  - Web at http://localhost:5173

Optional
- If your server runs on a different URL, set VITE_API_URL before `npm run dev`, e.g. `set VITE_API_URL=http://localhost:4000` (PowerShell) then `npm run dev`.

Production Build (served by Express)
- npm run start:prod (from repo root)
- This builds the client to `client/dist` and serves it via the Express server on `PORT` (default 4000). Visit http://localhost:4000.

Key Features Mapped to Requirements
- CRUD: Movies (admin create/update/delete), Ratings & Reviews (user create/update/delete), Users (admin update role/delete).
- Auth: Sign up / Sign in, JWT-protected routes, role-based admin access.
- Search & Filter: Query by text, genre, min rating, release year.
- Recommendations: Content-based using the user’s highly rated genres and global averages as fallback.
- Warnings/Validation: Client-side form checks, server-side validation, toast feedback for errors and actions.

API Summary (Server)
- POST /api/auth/register, POST /api/auth/login, GET /api/me
- GET /api/movies, GET /api/movies/:id
- POST /api/movies (admin), PUT /api/movies/:id (admin), DELETE /api/movies/:id (admin)
- GET /api/movies/:id/ratings, POST /api/movies/:id/ratings, DELETE /api/movies/:id/ratings/me
- GET /api/recommendations (auth)
- GET /api/admin/users (admin), PUT /api/admin/users/:id (admin), DELETE /api/admin/users/:id (admin)

Troubleshooting
- If ports are in use, change client port in `client/vite.config.js` or server `PORT` env var.
- If CORS issues occur, verify the server is running at the URL used by the client (`VITE_API_URL`).
