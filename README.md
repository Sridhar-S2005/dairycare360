# Ticket Tracker Lite (Fresh Starter)

A small full-stack ticket tracker built with React + Vite, Python Flask, and MySQL.

## Requirements
- Python 3.10+
- Node.js 18+
- MySQL Server and MySQL Workbench (Workbench is optional but useful)

## 1. Create the database
Open MySQL Workbench and run:

```sql
CREATE DATABASE IF NOT EXISTS ticket_tracker;
```

## 2. Configure the backend
Open a terminal in this project folder:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `DB_PASSWORD` to your MySQL password. If your MySQL user is not `root`, update `DB_USER` too.

If PowerShell blocks activation, you can skip activation and use:
```powershell
py -m pip install -r requirements.txt
py app.py
```

Start Flask:
```powershell
py app.py
```
It runs on `http://127.0.0.1:5000`.

## 3. Start the frontend in a second terminal
From the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`.

## 4. Test
- Frontend: `http://localhost:5173`
- API health: `http://127.0.0.1:5000/api/health`
- Tickets API: `http://127.0.0.1:5000/api/tickets`

Create a ticket from the website, change its status, refresh, and check it persists.

## Common issues
- **Blank frontend:** inspect Chrome DevTools → Console. Ensure `npm run dev` is run from `frontend`, and `frontend/src/main.jsx` and `frontend/src/App.jsx` exist.
- **API unavailable:** keep the Flask terminal running.
- **MySQL connection error:** ensure MySQL Server is running and `.env` credentials match your MySQL account.
- **Missing table:** the backend creates the `tickets` table on startup once it connects to MySQL.


## User portal login and password

1. Ensure MySQL is running and the `ticket_tracker` database exists.
2. Copy `backend/.env.example` to `backend/.env` and fill in your MySQL credentials. Set `SECRET_KEY` to a long random value.
3. Start the backend from the `backend` folder using `python app.py`. On startup it creates the `users` table automatically.
4. Start the frontend from the `frontend` folder using `npm install` (first run only), then `npm run dev`.
5. Open `/portal` on the Vite URL. Select **Create account** to register, then log in with that email and password.

Passwords are stored as one-way password hashes, not plain text. The user portal uses a Flask session cookie and only returns tickets belonging to the logged-in user's email. This is a development starter: before production, add rate limiting, CSRF protection, HTTPS, and authentication/authorization to the admin endpoints as well.


## Support Team and Technician portals

The React app now has a staff workspace at `http://127.0.0.1:5173/staff`.
Sign in using an existing account whose database role is `support`, `technician`, or `admin`.
The backend upgrades the existing `users.role` enum on startup to support these roles.

### Assign a staff role

Register the staff member first through the customer portal, then change the role in MySQL Workbench. Use the exact email address the person registered with:

```sql
UPDATE ticket_tracker.users
SET role = 'support'
WHERE email = 'support@example.com';

UPDATE ticket_tracker.users
SET role = 'technician'
WHERE email = 'technician@example.com';
```

Use the same staff member's `name` as the ticket's `assignee` for Technician Portal tickets to appear in their assigned list. Support users can view all tickets; technicians can view and update only tickets assigned to their account name through the staff API.

### Portal routes

- Admin dashboard: `http://127.0.0.1:5173/`
- Customer portal: `http://127.0.0.1:5173/portal`
- Support Team / Technician portal: `http://127.0.0.1:5173/staff`

This is a development starter, not a production-ready access-control system. The existing admin ticket endpoints remain available to the main dashboard and should be protected before deploying publicly. Set a strong `SECRET_KEY`, use HTTPS, and configure appropriate session/CSRF protections before production.

## Guided portal tour

The Admin Dashboard includes a guided DairyCare 360 tour for new workspace members. Select **Start portal tour** in the sidebar's **Need a hand?** card. The tour walks through Overview, All tickets, Schedule, Team members, Activity log, SLA policies, Settings, and the Helpdesk Assistant. Use Next/Back to move between areas, or close/skip the tour at any time. The tour is frontend guidance and does not change the `ticket_tracker` MySQL schema.

## Admin account management

The Admin Management page and its account-management API endpoints have been removed. Existing login, customer portal, staff portal, and ticket workflows remain. Manage account roles directly in MySQL Workbench when needed, and do not expose the Flask development server publicly without production security settings.


## SLA policy settings

Open **SLA policies** in the dashboard to configure separate targets for Critical, High, Medium, and Low tickets (1–720 hours each). Saving stores the values in the current browser's local storage and the ticket SLA badges use the selected priority target when recalculating deadlines. These preferences are browser-local; they are not shared across browsers or users and are not yet persisted in MySQL.


## Show who raised each ticket

Tickets created by a signed-in customer now save both the customer's name and email from the server-side login session. The dashboard displays **Raised by: [name]** beneath each ticket title. The backend automatically adds the `requester_name` column to an existing `tickets` table at startup and backfills are available in `backend/ticket_requester_name_migration.sql` for existing tickets whose requester email matches a user account. For existing tickets, the backend startup migration adds the column but does not automatically backfill; run the migration's UPDATE statement separately if you want to populate old tickets.

## Administrator user management

When signed in with an administrator account, open **Settings → User accounts** to view registered users, their role, registration date and active/deactivated status. Use **Deactivate** to block an account that submits fake or abusive tickets, or **Reactivate** to restore access. Deactivation is enforced by the Flask backend; it is not just a frontend toggle. The API prevents an administrator from deactivating their own account or the last active administrator.

The admin endpoints are `GET /api/admin/users` and `PATCH /api/admin/users/<id>/status`, and require an authenticated `admin` session. If the user list says administrator access is required, sign in through the app as an admin in the same browser session and refresh the list.

## Deploy the frontend to Vercel and the API to Render

The root `vercel.json` builds the React frontend and rewrites portal routes such as `/portal` and `/staff`. The root `render.yaml` defines only the Flask API. A separately hosted, publicly reachable MySQL-compatible database is required; Vercel and Render do not make your local MySQL server public.

1. In TiDB Cloud Starter, create a **MySQL-compatible** cluster and a database named `ticket_tracker`. Copy its public endpoint hostname, port, username, and generated password from its connection instructions. TiDB Starter requires a TLS connection; check its connection instructions and verify TLS is negotiated by the database driver. The free tier has a limited usage quota and may reject new connections after that quota is exhausted.
2. In the Render Dashboard, create a **Blueprint** from `Sridhar-S2005/dairycare360` on branch `main`. When prompted for sync environment values, enter `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `FRONTEND_ORIGINS`. For TiDB, use the port provided by its connection instructions (commonly `4000`), and set `FRONTEND_ORIGINS` to the Vercel production origin. Never put database credentials in Vercel, source code, or chat. The blueprint generates `SECRET_KEY` and enables secure session cookies.
3. Wait for the Render service `dairycare-360-api` to deploy, then verify `https://<render-api-host>/api/health` reports `{"status":"ok","database":"connected"}`. If it reports an error, inspect the Render logs and confirm the TiDB public endpoint, credentials, TLS, and allowed network access.
4. In Vercel, import `Sridhar-S2005/dairycare360` from GitHub. Keep the repository root as the project root so Vercel reads `vercel.json`. Set `VITE_API_BASE_URL` to `https://<render-api-host>` (no trailing slash) for Production, then deploy.
5. Confirm that the Vercel origin exactly matches Render's `FRONTEND_ORIGINS`, including `https://`. Test customer registration/login and ticket creation on the deployed site.

The app will be publicly reachable after both deployments complete, so anyone can visit it. Authentication does not replace a production security review; the dashboard's admin ticket endpoints must be protected before public production use. Check provider plans and usage limits; free quotas are not an unlimited availability guarantee.
