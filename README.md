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

## Deploy to Render

The root `render.yaml` defines a Render Flask API web service and a static React frontend. Push this repository to GitHub, then create a **Blueprint** in the Render Dashboard and select the repository. During setup, provide `DB_HOST`, `DB_USER`, and `DB_PASSWORD` for an externally hosted MySQL database; the database must already exist and allow connections from Render. `DB_NAME` defaults to `ticket_tracker`.

Render provides managed PostgreSQL, not managed MySQL. This project currently uses MySQL-specific SQL, so the Blueprint expects an external MySQL service. The API initializes its tables on startup. The frontend API URL and CORS origin are connected to the two Render services through their generated URLs. The Blueprint generates `SECRET_KEY` and enables secure session cookies for HTTPS.

The deployed services are not public until the Blueprint is created from a connected Git repository and valid MySQL connection values are supplied. Check your Render plan and external database provider for any usage charges.

## Deploy the frontend to Vercel

The React frontend can be deployed to Vercel while the existing Flask API runs on Render. The root `vercel.json` builds `frontend` and rewrites portal routes such as `/portal` and `/staff` to the React app. The Flask API and MySQL database remain separate services; deploying only the frontend does not make the local database publicly available.

1. Push this project to GitHub and import the repository into Vercel. Keep the project root as the Vercel Root Directory so it can read `vercel.json`.
2. Set the Vercel project environment variable `VITE_API_BASE_URL` to the public Render API URL, without a trailing slash (for example, `https://your-api.onrender.com`). Set it for Production and Preview as appropriate, then redeploy.
3. Provision an externally hosted MySQL database reachable by the Render API. In the Render API service, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from the database provider. Never put database credentials in Vercel or the frontend.
4. Set the Render API service's `FRONTEND_ORIGINS` to the exact Vercel production origin (for example, `https://your-project.vercel.app`). If multiple browser origins are needed, use a comma-separated list. Keep `SECRET_KEY` private and set `SESSION_COOKIE_SECURE=true` for HTTPS.
5. Redeploy the Render API and verify its `/api/health` endpoint reports a connected database. Then open the Vercel site and test customer sign-in and ticket creation.

The app is publicly reachable after deployment, so anyone can visit it. Authentication does not replace production security review; do not expose the development/admin endpoints publicly without adding the required authorization protections.
