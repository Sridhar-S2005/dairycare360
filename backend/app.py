import os
from datetime import datetime

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-development-secret-before-deployment")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
)
cors_origins = {"http://127.0.0.1:5173", "http://localhost:5173"}
cors_origins.update(origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "").split(",") if origin.strip())
CORS(app, supports_credentials=True, origins=sorted(cors_origins))

VALID_STATUSES = {"Open", "In Progress", "Resolved", "Closed"}
VALID_PRIORITIES = {"Low", "Medium", "High", "Critical"}

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "root"),
        database=os.getenv("DB_NAME", "ticket_tracker"),
    )

def initialize_database():
    # The database itself must exist first; see README.md.
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                email VARCHAR(254) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('user','admin','support','technician') NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Safe schema upgrades for existing databases.
        cursor.execute("SHOW COLUMNS FROM users LIKE 'is_active'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role")
        # Upgrade older installations that only supported user/admin roles.
        cursor.execute("SHOW COLUMNS FROM users LIKE 'role'")
        role_column = cursor.fetchone()
        if role_column and "support" not in str(role_column[0]):
            cursor.execute("ALTER TABLE users MODIFY role ENUM('user','admin','support','technician') NOT NULL DEFAULT 'user'")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                category VARCHAR(80) NOT NULL DEFAULT 'General',
                priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
                status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
                assignee VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
                requester_name VARCHAR(120) NOT NULL DEFAULT '',
                requester_email VARCHAR(254) NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("SHOW COLUMNS FROM tickets LIKE 'requester_name'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE tickets ADD COLUMN requester_name VARCHAR(120) NOT NULL DEFAULT '' AFTER assignee")
        cursor.execute("SHOW COLUMNS FROM tickets LIKE 'requester_email'")
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE tickets ADD COLUMN requester_email VARCHAR(254) NOT NULL DEFAULT ''")
        connection.commit()
        cursor.close()
    finally:
        connection.close()

def ticket_dict(row):
    return {
        "id": row[0],
        "title": row[1],
        "description": row[2] or "",
        "category": row[3],
        "priority": row[4],
        "status": row[5],
        "assignee": row[6],
        "requester_name": row[7] or "" if len(row) > 10 else "",
        "requester_email": row[8] if len(row) > 10 else (row[7] if len(row) > 9 else ""),
        "created_at": row[9].isoformat(sep=" ", timespec="seconds") if len(row) > 10 and row[9] else (row[8].isoformat(sep=" ", timespec="seconds") if len(row) > 9 and row[8] else None),
        "updated_at": row[10].isoformat(sep=" ", timespec="seconds") if len(row) > 10 and row[10] else (row[9].isoformat(sep=" ", timespec="seconds") if len(row) > 9 and row[9] else None),
    }

@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if len(name) < 2:
        return jsonify({"error": "Enter your name (at least 2 characters)."}), 400
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'user')",
                       (name, email, generate_password_hash(password)))
        connection.commit()
        user_id = cursor.lastrowid
        cursor.close()
        connection.close()
        session.clear()
        session["user"] = {"id": user_id, "name": name, "email": email, "role": "user"}
        return jsonify({"message": "Account created", "user": session["user"]}), 201
    except Error as exc:
        if getattr(exc, "errno", None) == 1062:
            return jsonify({"error": "An account with this email already exists. Please log in."}), 409
        return jsonify({"error": "Could not create account. Check MySQL settings.", "details": str(exc)}), 503

@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        connection.close()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Incorrect email or password."}), 401
        if not user["is_active"]:
            return jsonify({"error": "This account is inactive. Contact your administrator."}), 403
        session.clear()
        session["user"] = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
        return jsonify({"message": "Logged in", "user": session["user"]})
    except Error as exc:
        return jsonify({"error": "Could not log in. Check MySQL settings.", "details": str(exc)}), 503

@app.get("/api/auth/me")
def auth_me():
    return jsonify({"user": session.get("user")})

@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})

@app.get("/api/my/tickets")
def my_tickets():
    user = current_active_user()
    if not user or user.get("role") != "user":
        return jsonify({"error": "Please log in with an active customer account."}), 401
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("""SELECT id, title, description, category, priority, status, assignee, requester_name, requester_email, created_at, updated_at
                          FROM tickets WHERE LOWER(requester_email) = LOWER(%s) ORDER BY created_at DESC, id DESC""",
                       (user["email"],))
        result = [ticket_dict(row) for row in cursor.fetchall()]
        cursor.close()
        connection.close()
        return jsonify(result)
    except Error as exc:
        return jsonify({"error": "Could not load your tickets.", "details": str(exc)}), 503

@app.post("/api/my/tickets")
def create_my_ticket():
    user = current_active_user()
    if not user or user.get("role") != "user":
        return jsonify({"error": "Please log in with an active customer account."}), 401
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    priority = data.get("priority", "Medium")
    if not title:
        return jsonify({"error": "Ticket title is required."}), 400
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": "Invalid priority."}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("""INSERT INTO tickets (title, description, category, priority, status, assignee, requester_name, requester_email)
                          VALUES (%s, %s, %s, %s, 'Open', 'Unassigned', %s, %s)""",
                       (title, str(data.get("description", "")).strip(),
                        str(data.get("category", "General")).strip() or "General", priority, user["name"], user["email"]))
        connection.commit()
        ticket_id = cursor.lastrowid
        cursor.close()
        connection.close()
        return jsonify({"message": "Ticket created", "id": ticket_id}), 201
    except Error as exc:
        return jsonify({"error": "Could not create ticket.", "details": str(exc)}), 503



def current_active_user():
    """Reload role/status from MySQL so role changes take effect immediately."""
    session_user = session.get("user")
    if not session_user:
        return None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role, is_active FROM users WHERE id = %s", (session_user.get("id"),))
        user = cursor.fetchone()
        cursor.close()
        connection.close()
        if not user or not user["is_active"]:
            session.clear()
            return None
        session["user"] = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
        return session["user"]
    except Error:
        return None

def require_staff(allowed_roles=None):
    user = current_active_user()
    allowed_roles = allowed_roles or {"admin", "support", "technician"}
    if not user or user.get("role") not in allowed_roles:
        return None
    return user

@app.get("/api/admin/users")
def admin_list_users():
    admin = require_staff({"admin"})
    if not admin:
        return jsonify({"error": "Administrator access is required."}), 403
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC, id DESC")
        users = cursor.fetchall()
        for item in users:
            if item.get("created_at"):
                item["created_at"] = item["created_at"].isoformat(sep=" ", timespec="seconds")
            item["is_active"] = bool(item["is_active"])
        cursor.close()
        connection.close()
        return jsonify(users)
    except Error as exc:
        return jsonify({"error": "Could not load users.", "details": str(exc)}), 503

@app.patch("/api/admin/users/<int:user_id>/status")
def admin_update_user_status(user_id):
    admin = require_staff({"admin"})
    if not admin:
        return jsonify({"error": "Administrator access is required."}), 403
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("is_active"), bool):
        return jsonify({"error": "is_active must be true or false."}), 400
    if user_id == admin["id"] and not data["is_active"]:
        return jsonify({"error": "You cannot deactivate your own administrator account."}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, role, is_active FROM users WHERE id = %s", (user_id,))
        target = cursor.fetchone()
        if not target:
            cursor.close(); connection.close()
            return jsonify({"error": "User not found."}), 404
        if target["role"] == "admin" and not data["is_active"]:
            cursor.execute("SELECT COUNT(*) AS active_admins FROM users WHERE role = 'admin' AND is_active = 1")
            if cursor.fetchone()["active_admins"] <= 1:
                cursor.close(); connection.close()
                return jsonify({"error": "The last active administrator cannot be deactivated."}), 400
        cursor.execute("UPDATE users SET is_active = %s WHERE id = %s", (1 if data["is_active"] else 0, user_id))
        connection.commit()
        cursor.close(); connection.close()
        return jsonify({"message": "User activated." if data["is_active"] else "User deactivated.", "id": user_id, "is_active": data["is_active"]})
    except Error as exc:
        return jsonify({"error": "Could not update user status.", "details": str(exc)}), 503

@app.get("/api/staff/tickets")
def staff_tickets():
    user = require_staff()
    if not user:
        return jsonify({"error": "Please sign in with a Support Team or Technician account."}), 401
    try:
        connection = get_connection()
        cursor = connection.cursor()
        if user["role"] == "technician":
            cursor.execute("""
                SELECT id, title, description, category, priority, status, assignee, requester_name, requester_email, created_at, updated_at
                FROM tickets WHERE LOWER(assignee) = LOWER(%s) ORDER BY created_at DESC, id DESC
            """, (user["name"],))
        else:
            cursor.execute("""
                SELECT id, title, description, category, priority, status, assignee, requester_name, requester_email, created_at, updated_at
                FROM tickets ORDER BY created_at DESC, id DESC
            """)
        rows = [ticket_dict(row) for row in cursor.fetchall()]
        cursor.close()
        connection.close()
        return jsonify(rows)
    except Error as exc:
        return jsonify({"error": "Could not load staff tickets.", "details": str(exc)}), 503

@app.patch("/api/staff/tickets/<int:ticket_id>")
def staff_update_ticket(ticket_id):
    user = require_staff()
    if not user:
        return jsonify({"error": "Please sign in with a staff account."}), 401
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    description = data.get("description")
    if status is not None and status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status."}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor()
        if user["role"] == "technician":
            cursor.execute("SELECT id FROM tickets WHERE id=%s AND LOWER(assignee)=LOWER(%s)", (ticket_id, user["name"]))
        else:
            cursor.execute("SELECT id FROM tickets WHERE id=%s", (ticket_id,))
        if not cursor.fetchone():
            cursor.close()
            connection.close()
            return jsonify({"error": "Ticket not found or not assigned to you."}), 404
        updates, values = [], []
        if status is not None:
            updates.append("status=%s"); values.append(status)
        if description is not None:
            updates.append("description=%s"); values.append(str(description).strip())
        if not updates:
            cursor.close(); connection.close()
            return jsonify({"error": "No supported fields to update."}), 400
        cursor.execute(f"UPDATE tickets SET {', '.join(updates)} WHERE id=%s", (*values, ticket_id))
        connection.commit()
        cursor.close()
        connection.close()
        return jsonify({"message": "Ticket updated"})
    except Error as exc:
        return jsonify({"error": "Could not update ticket.", "details": str(exc)}), 503

@app.get("/api/health")
def health():
    try:
        connection = get_connection()
        connection.ping(reconnect=True, attempts=1, delay=0)
        connection.close()
        return jsonify({"status": "ok", "database": "connected"})
    except Error as exc:
        return jsonify({"status": "error", "database": "disconnected", "message": str(exc)}), 503

@app.get("/api/tickets")
def list_tickets():
    try:
        connection = get_connection()
        cursor = connection.cursor()
        requester_email = request.args.get("requester_email", "").strip()
        cursor.execute("""
            SELECT id, title, description, category, priority, status, assignee, requester_name, requester_email, created_at, updated_at
            FROM tickets WHERE (%s = '' OR LOWER(requester_email) = LOWER(%s)) ORDER BY created_at DESC, id DESC
        """, (requester_email, requester_email))
        tickets = [ticket_dict(row) for row in cursor.fetchall()]
        cursor.close()
        connection.close()
        return jsonify(tickets)
    except Error as exc:
        return jsonify({"error": "Could not load tickets. Check MySQL settings.", "details": str(exc)}), 503

@app.get("/api/tickets/<int:ticket_id>")
def get_ticket(ticket_id):
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id, title, description, category, priority, status, assignee, requester_name, requester_email, created_at, updated_at
            FROM tickets WHERE id = %s
        """, (ticket_id,))
        row = cursor.fetchone()
        cursor.close()
        connection.close()
        if not row:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify(ticket_dict(row))
    except Error as exc:
        return jsonify({"error": str(exc)}), 503

@app.post("/api/tickets")
def create_ticket():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    priority = data.get("priority", "Medium")
    status = data.get("status", "Open")
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": "Invalid priority"}), 400
    if status not in VALID_STATUSES:
        return jsonify({"error": "Invalid status"}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO tickets (title, description, category, priority, status, assignee, requester_name, requester_email)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            title,
            str(data.get("description", "")).strip(),
            str(data.get("category", "General")).strip() or "General",
            priority,
            status,
            str(data.get("assignee", "Unassigned")).strip() or "Unassigned",
            str(data.get("requester_name", "")).strip(),
            str(data.get("requester_email", "")).strip().lower(),
        ))
        connection.commit()
        ticket_id = cursor.lastrowid
        cursor.close()
        connection.close()
        return jsonify({"message": "Ticket created", "id": ticket_id}), 201
    except Error as exc:
        return jsonify({"error": "Could not create ticket. Check MySQL settings.", "details": str(exc)}), 503

@app.patch("/api/tickets/<int:ticket_id>")
def update_ticket(ticket_id):
    data = request.get_json(silent=True) or {}
    allowed = {"title", "description", "category", "priority", "status", "assignee"}
    updates = {key: value for key, value in data.items() if key in allowed}
    if not updates:
        return jsonify({"error": "No supported fields to update"}), 400
    if "title" in updates and not str(updates["title"]).strip():
        return jsonify({"error": "Title cannot be empty"}), 400
    if "priority" in updates and updates["priority"] not in VALID_PRIORITIES:
        return jsonify({"error": "Invalid priority"}), 400
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        return jsonify({"error": "Invalid status"}), 400
    try:
        connection = get_connection()
        cursor = connection.cursor()
        columns = ", ".join(f"{key} = %s" for key in updates)
        values = [str(value).strip() if isinstance(value, str) else value for value in updates.values()]
        cursor.execute(f"UPDATE tickets SET {columns} WHERE id = %s", (*values, ticket_id))
        connection.commit()
        changed = cursor.rowcount
        cursor.close()
        connection.close()
        if not changed:
            return jsonify({"error": "Ticket not found or no changes made"}), 404
        return jsonify({"message": "Ticket updated"})
    except Error as exc:
        return jsonify({"error": "Could not update ticket.", "details": str(exc)}), 503

@app.delete("/api/tickets/<int:ticket_id>")
def delete_ticket(ticket_id):
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
        connection.commit()
        deleted = cursor.rowcount
        cursor.close()
        connection.close()
        if not deleted:
            return jsonify({"error": "Ticket not found"}), 404
        return jsonify({"message": "Ticket deleted"})
    except Error as exc:
        return jsonify({"error": "Could not delete ticket.", "details": str(exc)}), 503

@app.get("/api/stats")
def stats():
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT COUNT(*) AS total,
              SUM(status = 'Open') AS open_count,
              SUM(status = 'In Progress') AS in_progress_count,
              SUM(status = 'Resolved') AS resolved_count,
              SUM(priority = 'Critical') AS critical_count
            FROM tickets
        """)
        result = cursor.fetchone()
        cursor.close()
        connection.close()
        return jsonify({key: int(value or 0) for key, value in result.items()})
    except Error as exc:
        return jsonify({"error": "Could not load stats.", "details": str(exc)}), 503

if __name__ == "__main__":
    try:
        initialize_database()
        print("MySQL connected; tickets table is ready.")
    except Error as exc:
        print("\nCould not connect to MySQL.")
        print("1. Start MySQL Server.")
        print("2. Create the ticket_tracker database.")
        print("3. Check backend/.env credentials.")
        print(f"Details: {exc}\n")
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=True)
