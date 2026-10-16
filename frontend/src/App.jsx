import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownUp, Bell, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Filter, LayoutDashboard, ListTodo, Plus, RefreshCw,
  Search, Settings2, ShieldCheck, Ticket, Trash2, Users, X, FileDown,
  BarChart3, PieChart, Timer, UserCheck, UserRound, Camera, AlertTriangle, CalendarDays, BellRing, PlusCircle, Trash, Building2, Mail, CalendarClock, LockKeyhole, Database, Save, Globe2, Palette, MessageCircle, Send, Bot, Minimize2
} from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

const API = `${(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')}/api`;
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
// Public ticket code: fixed prefix AKC10 + the ticket ID's last two digits.
function displayTicketId(id) { return `AKC10${String(id).padStart(2, '0').slice(-2)}`; }
const emptyForm = { title: '', description: '', category: 'General', priority: 'Medium', status: 'Open', assignee: '' };

function prettyDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourStep, setTourStep] = useState(-1);
  const tourSteps = [
    { section: 'Overview', title: 'Welcome to DairyCare 360', body: 'This is your workspace overview. Start here to see ticket totals, urgent issues, daily activity and your support team at a glance.', icon: LayoutDashboard },
    { section: 'All tickets', title: 'Manage every ticket', body: 'Search and filter tickets, review priority and status, assign work, update progress, and export an individual ticket as a PDF.', icon: ListTodo },
    { section: 'Schedule', title: 'Plan work and reminders', body: 'Use the calendar to plan support work. Add a reminder, choose a weekday and time, assign a team member, and enable notifications.', icon: CalendarDays },
    { section: 'Team members', title: 'Understand your team', body: 'Review the people supporting your customers and use the team area to keep track of the team members available in this workspace.', icon: Users },
    { section: 'Activity log', title: 'Review recent changes', body: 'Use the activity log to review recorded ticket and workspace actions. This project currently stores these browser-side logs locally.', icon: Activity },
    { section: 'SLA policies', title: 'Keep deadlines visible', body: 'Review your response-time target and ticket deadline guidance. Confirm backend SLA calculations before relying on them for operational commitments.', icon: ShieldCheck },
    { section: 'Settings', title: 'Configure your workspace', body: 'Manage workspace preferences, working hours, default priority, notification preferences and the Flask API connection test.', icon: Settings2 },
    { section: 'Overview', title: 'Get help whenever you need it', body: 'The Helpdesk button at the bottom-right opens quick guidance. Ask about tickets, staff access, SLA deadlines, schedules or settings whenever you need help.', icon: CircleHelp }
  ];
  const [helpInput, setHelpInput] = useState('');
  const [helpMessages, setHelpMessages] = useState([{ from: 'assistant', text: 'Hi! I’m your DairyCare 360 Helpdesk Assistant. I can guide you through tickets, staff access, schedules, SLA policies and settings. What would you like help with?' }]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hour = currentTime.getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : hour >= 17 && hour < 22 ? 'Good evening' : 'Hello';
  const weekday = currentTime.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open_count: 0, in_progress_count: 0, resolved_count: 0, critical_count: 0 });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [managedUsers, setManagedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userActionId, setUserActionId] = useState(null);
  const [adminLoginEmail, setAdminLoginEmail] = useState('');
  const [adminLoginPassword, setAdminLoginPassword] = useState('');
  const [adminLoginBusy, setAdminLoginBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [priorityFilter, setPriorityFilter] = useState('All priorities');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(() => {
    const defaults = { name: 'Workspace Admin', email: 'admin@dairycare360.com', title: 'Administrator', phone: '', photo: '' };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('dairycare-admin-profile') || '{}') }; }
    catch { return defaults; }
  });
  const [profileDraft, setProfileDraft] = useState(profile);
  const [activeSection, setActiveSection] = useState('Overview');
  const [selectedIds, setSelectedIds] = useState([]);
  const [teamMembers, setTeamMembers] = useState(() => { try { return JSON.parse(localStorage.getItem('orbitdesk-team') || '["Workspace Admin","Support Team"]'); } catch { return ['Workspace Admin','Support Team']; } });
  const [newMember, setNewMember] = useState('');
  // SLA targets are stored per priority in this browser and loaded on startup.
  const [slaHours, setSlaHours] = useState(() => localStorage.getItem('orbitdesk-sla-hours') || '24');
  const [slaCriticalHours, setSlaCriticalHours] = useState(() => localStorage.getItem('dairycare-sla-critical-hours') || '4');
  const [slaHighHours, setSlaHighHours] = useState(() => localStorage.getItem('dairycare-sla-high-hours') || '8');
  const [slaLowHours, setSlaLowHours] = useState(() => localStorage.getItem('dairycare-sla-low-hours') || '72');
  const [workspaceName, setWorkspaceName] = useState(() => localStorage.getItem('orbitdesk-workspace') || 'DairyCare 360');
  const [settingsPrefs, setSettingsPrefs] = useState(() => { try { return { companyEmail: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata', dateFormat: 'DD MMM YYYY', businessStart: '09:00', businessEnd: '18:00', notifyAssignment: true, notifyOverdue: true, notifySchedule: true, notifyResolution: false, weeklyBackupReminder: true, defaultPriority: 'Medium', ...JSON.parse(localStorage.getItem('dairycare-settings') || '{}') }; } catch { return { companyEmail: '', timezone: 'Asia/Kolkata', dateFormat: 'DD MMM YYYY', businessStart: '09:00', businessEnd: '18:00', notifyAssignment: true, notifyOverdue: true, notifySchedule: true, notifyResolution: false, weeklyBackupReminder: true, defaultPriority: 'Medium' }; } });
  const [activityLogs, setActivityLogs] = useState(() => { try { return JSON.parse(localStorage.getItem('dairycare-activity-logs') || '[]'); } catch { return []; } });
  const [scheduleItems, setScheduleItems] = useState(() => { try { return JSON.parse(localStorage.getItem('dairycare-schedules') || '[]'); } catch { return []; } });
  const [scheduleForm, setScheduleForm] = useState({ title: 'Daily ticket review', day: 'Every day', time: '09:00', notification: true, assignee: 'Workspace Admin' });
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState('Day');
  const [calendarSearch, setCalendarSearch] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [miniMonth, setMiniMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketResponse, statsResponse] = await Promise.all([
        fetch(`${API}/tickets`), fetch(`${API}/stats`)
      ]);
      if (!ticketResponse.ok) {
        const detail = await ticketResponse.json().catch(() => ({}));
        throw new Error(detail.details || detail.error || 'Unable to load tickets');
      }
      const ticketData = await ticketResponse.json();
      setTickets(Array.isArray(ticketData) ? ticketData : []);
      if (statsResponse.ok) setStats(await statsResponse.json());
      setApiError('');
    } catch (error) {
      setApiError(error.message || 'Could not reach Flask API. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTickets = useMemo(() => tickets.filter(ticket => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [ticket.title, ticket.description, ticket.assignee, ticket.category, String(ticket.id)]
      .some(value => String(value || '').toLowerCase().includes(q));
    return matchesSearch &&
      (statusFilter === 'All statuses' || ticket.status === statusFilter) &&
      (priorityFilter === 'All priorities' || ticket.priority === priorityFilter);
  }), [tickets, search, statusFilter, priorityFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(ticket) {
    setEditing(ticket);
    setForm({
      title: ticket.title || '', description: ticket.description || '',
      category: ticket.category || 'General', priority: ticket.priority || 'Medium',
      status: ticket.status || 'Open', assignee: ticket.assignee === 'Unassigned' ? '' : (ticket.assignee || '')
    });
    setShowModal(true);
  }

  const loadManagedUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await fetch(`${API}/admin/users`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load user accounts. Sign in as an administrator.');
      setManagedUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsersError(error.message || 'Could not load user accounts.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'Settings') loadManagedUsers();
  }, [activeSection, loadManagedUsers]);

  async function signInAdminForUserManagement(event) {
    event.preventDefault(); setAdminLoginBusy(true); setUsersError('');
    try {
      const response = await fetch(`${API}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminLoginEmail, password: adminLoginPassword }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sign in failed.');
      if (data.user?.role !== 'admin') { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); throw new Error('This account is not an administrator. Sign in with your admin account.'); }
      setAdminLoginPassword('');
      await loadManagedUsers();
    } catch (error) { setUsersError(error.message || 'Could not sign in.'); }
    finally { setAdminLoginBusy(false); }
  }

  async function setUserActiveStatus(user, isActive) {
    const action = isActive ? 'reactivate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name} (${user.email})? ${isActive ? 'They will be able to sign in again.' : 'They will no longer be able to sign in.'}`)) return;
    setUserActionId(user.id);
    try {
      const response = await fetch(`${API}/admin/users/${user.id}/status`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update this account.');
      setManagedUsers(current => current.map(item => item.id === user.id ? { ...item, is_active: isActive } : item));
      notify(data.message || `Account ${isActive ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      notify(error.message || 'Could not update this account.');
    } finally {
      setUserActionId(null);
    }
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }

  function logActivity(action, ticket, details = '') {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, ticketId: ticket?.id ?? null, title: ticket?.title || 'Workspace', details, at: new Date().toISOString() };
    setActivityLogs(current => { const next = [entry, ...current].slice(0, 300); localStorage.setItem('dairycare-activity-logs', JSON.stringify(next)); return next; });
  }

  function addSchedule(event) {
    event.preventDefault();
    const item = { id: `${Date.now()}`, ...scheduleForm, enabled: true, createdAt: new Date().toISOString() };
    setScheduleItems(current => { const next = [item, ...current]; localStorage.setItem('dairycare-schedules', JSON.stringify(next)); return next; });
    logActivity('Schedule reminder added', null, `${item.title} · ${item.day} at ${item.time}`);
    notify('Schedule reminder saved.');
  }
  function toggleSchedule(id) {
    setScheduleItems(current => { const next = current.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item); localStorage.setItem('dairycare-schedules', JSON.stringify(next)); return next; });
  }
  function deleteSchedule(id) {
    const item = scheduleItems.find(entry => entry.id === id);
    setScheduleItems(current => { const next = current.filter(entry => entry.id !== id); localStorage.setItem('dairycare-schedules', JSON.stringify(next)); return next; });
    if (item) logActivity('Schedule reminder deleted', null, item.title);
    notify('Schedule reminder deleted.');
  }
  async function enableBrowserNotifications() {
    if (!('Notification' in window)) return notify('Browser notifications are not supported in this browser.');
    const permission = await Notification.requestPermission();
    notify(permission === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications were not enabled. In-app reminders will still work while this page is open.');
  }

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
      const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayKey = now.toLocaleDateString('en-CA');
      let fired = {};
      try { fired = JSON.parse(localStorage.getItem('dairycare-schedule-fired') || '{}'); } catch { fired = {}; }
      scheduleItems.forEach(item => {
        const dayMatches = item.day === 'Every day' || item.day === dayName;
        const fireKey = `${todayKey}-${item.id}-${timeNow}`;
        if (item.enabled && item.notification && dayMatches && item.time === timeNow && !fired[fireKey]) {
          fired[fireKey] = true;
          notify(`Reminder: ${item.title}`);
          if ('Notification' in window && Notification.permission === 'granted') new Notification('DairyCare 360 reminder', { body: item.title });
          logActivity('Schedule reminder triggered', null, `${item.title} · ${dayName} ${timeNow}`);
        }
      });
      localStorage.setItem('dairycare-schedule-fired', JSON.stringify(fired));
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [scheduleItems]);

  function slaTargetHours(ticket) {
    const targets = {
      Critical: slaCriticalHours,
      High: slaHighHours,
      Medium: slaHours,
      Low: slaLowHours,
    };
    return Math.min(720, Math.max(1, Number(targets[ticket.priority] ?? slaHours) || 24));
  }
  function getSlaInfo(ticket) {
    if (['Resolved', 'Closed'].includes(ticket.status)) return { label: 'Completed', state: 'completed', remaining: 0 };
    const created = new Date(String(ticket.created_at || '').replace(' ', 'T'));
    if (Number.isNaN(created.getTime())) return { label: 'No deadline', state: 'unknown', remaining: null };
    const deadline = created.getTime() + slaTargetHours(ticket) * 3600000;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { label: 'Overdue', state: 'overdue', remaining };
    const hours = Math.floor(remaining / 3600000); const minutes = Math.floor((remaining % 3600000) / 60000);
    return { label: hours > 0 ? `${hours}h ${minutes}m left` : `${Math.max(1, minutes)}m left`, state: remaining < 4 * 3600000 ? 'warning' : 'on-track', remaining };
  }

  async function saveTicket(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, assignee: form.assignee.trim() || 'Unassigned' };
      const response = await fetch(editing ? `${API}/tickets/${editing.id}` : `${API}/tickets`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.details || result.error || 'Could not save ticket');
      setShowModal(false);
      logActivity(editing ? 'Ticket updated' : 'Ticket created', editing || { id: result.id, title: form.title }, editing ? `Status: ${form.status}; Priority: ${form.priority}; Assignee: ${payload.assignee}` : `Priority: ${form.priority}; Assignee: ${payload.assignee}`);
      await loadData();
      notify(editing ? 'Ticket updated successfully' : `Ticket #${result.id} created successfully`);
    } catch (error) {
      notify(error.message || 'Could not save ticket');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(ticket, status) {
    try {
      const response = await fetch(`${API}/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.details || result.error || 'Could not update status');
      logActivity('Status changed', ticket, `${ticket.status} → ${status}`);
      await loadData();
      notify(`Ticket #${ticket.id} moved to ${status}`);
    } catch (error) {
      notify(error.message || 'Status update failed');
    }
  }

  async function deleteTicket(ticket) {
    if (!window.confirm(`Delete ticket #${ticket.id}: "${ticket.title}"?`)) return;
    try {
      const response = await fetch(`${API}/tickets/${ticket.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.details || result.error || 'Could not delete ticket');
      logActivity('Ticket deleted', ticket, 'Ticket record deleted');
      await loadData();
      notify(`Ticket #${ticket.id} deleted`);
    } catch (error) {
      notify(error.message || 'Delete failed');
    }
  }

  function navigate(section) {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function toggleSelected(id, checked) { setSelectedIds(current => checked ? [...new Set([...current, id])] : current.filter(item => item !== id)); }
  async function deleteSelected() {
    if (!selectedIds.length) return notify('Select at least one ticket first.');
    if (!window.confirm(`Delete ${selectedIds.length} selected ticket(s)?`)) return;
    try {
      const responses = await Promise.all(selectedIds.map(id => fetch(`${API}/tickets/${id}`, { method: 'DELETE' })));
      if (responses.some(response => !response.ok)) throw new Error('One or more tickets could not be deleted.');
      setSelectedIds([]); await loadData(); notify('Selected tickets deleted.');
    } catch (error) { notify(error.message); }
  }
  function exportTicketPdf(ticket) {
    if (!ticket) return notify('Ticket details are unavailable.');
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const printWindow = window.open('', '_blank');
    if (!printWindow) return notify('Please allow pop-ups to save a ticket PDF.');
    const fields = [
      ['Ticket ID', displayTicketId(ticket.id)],
      ['Title', ticket.title],
      ['Raised by', ticket.requester_name || ticket.requester_email || 'Unknown user'],
      ['Description', ticket.description || 'No description'],
      ['Category', ticket.category || 'General'],
      ['Status', ticket.status],
      ['Priority', ticket.priority],
      ['Assignee', ticket.assignee || 'Unassigned'],
      ['Created', prettyDate(ticket.created_at)],
      ['Last updated', prettyDate(ticket.updated_at || ticket.created_at)],
    ];
    const rows = fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
    printWindow.document.write(`<!doctype html><html><head><title>DairyCare 360 - Ticket ${escapeHtml(displayTicketId(ticket.id))}</title><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18324b;padding:32px;max-width:900px;margin:auto}header{border-bottom:3px solid #2676b8;padding-bottom:18px;margin-bottom:24px}h1{font-size:26px;margin:0 0 6px;color:#15598c}h2{font-size:18px;margin:0 0 5px}p{margin:0;color:#60758a;font-size:13px}.meta{margin-top:12px;font-size:12px;color:#60758a}table{border-collapse:collapse;width:100%;font-size:14px}th{width:180px;background:#eaf4fb;color:#164d73;text-align:left}th,td{border:1px solid #d8e5ee;padding:13px;vertical-align:top;overflow-wrap:anywhere}footer{margin-top:24px;padding-top:12px;border-top:1px solid #d8e5ee;font-size:11px;color:#718397}@media print{body{padding:0;max-width:none}@page{size:A4;margin:18mm}tr{break-inside:avoid}}
      </style></head><body><header><h1>DairyCare 360</h1><h2>Support Ticket Details — ${escapeHtml(displayTicketId(ticket.id))}</h2><p>Individual ticket record</p><div class="meta">PDF prepared ${escapeHtml(new Date().toLocaleString())}</div></header><table><tbody>${rows}</tbody></table><footer>Confidential workspace record · DairyCare 360</footer><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
    printWindow.document.close();
  }

  function addMember(event) {
    event.preventDefault(); const name = newMember.trim(); if (!name) return;
    if (teamMembers.some(member => member.toLowerCase() === name.toLowerCase())) return notify('That team member already exists.');
    const next = [...teamMembers, name]; setTeamMembers(next); localStorage.setItem('orbitdesk-team', JSON.stringify(next)); logActivity('Technician added', null, name); setNewMember(''); notify('Team member added.');
  }
  function removeMember(name) {
    const next = teamMembers.filter(member => member !== name); setTeamMembers(next); localStorage.setItem('orbitdesk-team', JSON.stringify(next)); logActivity('Technician removed', null, name); notify('Team member removed.');
  }
  function getHelpAnswer(question) {
    const q = question.toLowerCase();
    if (q.includes('ticket') && (q.includes('create') || q.includes('new'))) return 'To create a ticket, open All tickets and select New ticket (or Create ticket on Overview). Add a clear title and description, choose category and priority, assign a team member if known, then save.';
    if (q.includes('assign') || q.includes('technician')) return 'Open All tickets, use the edit/settings action for the ticket, and choose a name in Assign to. The technician should sign in with a staff account and the ticket assignee should match their account/team name.';
    if (q.includes('staff') || q.includes('access') || q.includes('role') || q.includes('login')) return 'Staff access requires a registered account with a Support or Technician role configured in the backend. Use an administrator-managed staff setup where available. Avoid changing password_hash values in MySQL; if sign-in is rejected, check the users table schema and the role values accepted by Flask.';
    if (q.includes('sla') || q.includes('deadline') || q.includes('overdue')) return 'Open SLA policies to review response targets. The Settings page contains the default resolution target and working-hours preferences. In this version, browser preferences do not automatically enforce business-hour calculations on the backend, so verify Flask SLA logic before relying on deadlines.';
    if (q.includes('schedule') || q.includes('calendar') || q.includes('reminder') || q.includes('notification')) return 'Open Schedule to view and manage planned support work. Use the notification controls to enable browser reminders when prompted. Browser notifications require permission, and email alerts need a configured backend email service.';
    if (q.includes('setting') || q.includes('workspace') || q.includes('email') || q.includes('timezone')) return 'Open Settings to adjust workspace name, support contact, default priority, SLA target, timezone, working hours and notification preferences. Select Save all settings. Some preferences are stored only in this browser until backend persistence is implemented.';
    if (q.includes('pdf') || q.includes('export')) return 'In All tickets, use the small PDF/download icon on a ticket row to export that individual ticket as a PDF. This is per-ticket export, not a combined export of all tickets.';
    if (q.includes('database') || q.includes('mysql') || q.includes('api') || q.includes('connect')) return `The application uses a Flask API at ${API} and your MySQL database is named ticket_tracker. Keep the database name separate from the DairyCare 360 website branding. Check that MySQL and Flask are running, then use Test API connection in Settings.`;
    if (q.includes('team') || q.includes('member')) return 'Open Team members to review the workspace team list. Adding a name to this list may only update the local workspace list; creating a real login account and granting staff permissions must be handled by the backend.';
    if (q.includes('hello') || q.includes('hi') || q.includes('help')) return 'I can help with creating tickets, assigning technicians, staff access, PDFs, schedules, SLA policies, settings and API/database connection. Try one of the quick questions below or type your question.';
    return 'I don’t have a configured live AI service connected yet, but I can guide you with the built-in DairyCare 360 help topics. Try asking about creating a ticket, staff access, assigning a technician, SLA deadlines, schedule notifications, settings, PDF reports or the MySQL/API connection.';
  }

  function sendHelpMessage(text = helpInput) {
    const question = text.trim();
    if (!question) return;
    setHelpMessages(current => [...current, { from: 'user', text: question }, { from: 'assistant', text: getHelpAnswer(question) }]);
    setHelpInput('');
  }

  function saveSettings(event) {
    event.preventDefault();
    const safeName = workspaceName.trim() || 'DairyCare 360';
    localStorage.setItem('orbitdesk-workspace', safeName);
    localStorage.setItem('orbitdesk-sla-hours', String(slaHours));
    localStorage.setItem('dairycare-sla-critical-hours', String(slaCriticalHours));
    localStorage.setItem('dairycare-sla-high-hours', String(slaHighHours));
    localStorage.setItem('dairycare-sla-low-hours', String(slaLowHours));
    localStorage.setItem('dairycare-settings', JSON.stringify(settingsPrefs));
    logActivity('SLA and workspace settings updated', null, `Workspace: ${safeName}; Critical: ${slaCriticalHours}h, High: ${slaHighHours}h, Medium: ${slaHours}h, Low: ${slaLowHours}h`);
    notify('Settings saved on this browser. SLA deadlines have been recalculated.');
  }
  function openProfileEditor() {
    setProfileDraft(profile);
    setProfileOpen(true);
  }
  function updateProfilePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Choose an image file for your profile photo.');
    if (file.size > 1024 * 1024) return notify('Choose a profile photo smaller than 1 MB.');
    const reader = new FileReader();
    reader.onload = () => setProfileDraft(current => ({ ...current, photo: String(reader.result) }));
    reader.onerror = () => notify('Could not read that profile photo.');
    reader.readAsDataURL(file);
  }
  function saveProfile(event) {
    event.preventDefault();
    const nextProfile = {
      ...profileDraft,
      name: profileDraft.name.trim() || 'Workspace Admin',
      email: profileDraft.email.trim(),
      title: profileDraft.title.trim(),
      phone: profileDraft.phone.trim()
    };
    try {
      localStorage.setItem('dairycare-admin-profile', JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setProfileOpen(false);
      notify('Profile saved in this browser.');
    } catch {
      notify('Profile could not be saved. Try a smaller photo.');
    }
  }
  function updatePreference(key, value) {
    setSettingsPrefs(current => ({ ...current, [key]: value }));
  }

  const overdueTickets = tickets.filter(ticket => getSlaInfo(ticket).state === 'overdue');
  const activeTickets = tickets.filter(ticket => !['Resolved', 'Closed'].includes(ticket.status));
  const resolutionDurations = tickets.filter(ticket => ['Resolved', 'Closed'].includes(ticket.status) && ticket.created_at && ticket.updated_at).map(ticket => {
    const start = new Date(String(ticket.created_at).replace(' ', 'T')).getTime();
    const end = new Date(String(ticket.updated_at).replace(' ', 'T')).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 3600000 : null;
  }).filter(value => value !== null);
  const avgResolutionHours = resolutionDurations.length ? resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length : null;
  const statusCounts = STATUSES.map(status => ({ status, count: tickets.filter(ticket => ticket.status === status).length }));
  const dailyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1);
    const created = tickets.filter(ticket => { const d = new Date(String(ticket.created_at || '').replace(' ', 'T')); return !Number.isNaN(d.getTime()) && d >= date && d < nextDay; }).length;
    const resolved = tickets.filter(ticket => ['Resolved', 'Closed'].includes(ticket.status) && (() => { const d = new Date(String(ticket.updated_at || '').replace(' ', 'T')); return !Number.isNaN(d.getTime()) && d >= date && d < nextDay; })()).length;
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), created, resolved };
  });
  const maxDaily = Math.max(1, ...dailyActivity.flatMap(day => [day.created, day.resolved]));
  const technicianStats = teamMembers.map(name => ({ name, assigned: tickets.filter(ticket => (ticket.assignee || '').toLowerCase() === name.toLowerCase()).length, resolved: tickets.filter(ticket => (ticket.assignee || '').toLowerCase() === name.toLowerCase() && ['Resolved', 'Closed'].includes(ticket.status)).length })).sort((a, b) => b.assigned - a.assigned);
  const profileInitials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'WA';
  const profileDraftInitials = profileDraft.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'WA';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Ticket size={21} /></div><div><strong>DairyCare <span>360</span></strong><small>WORKSPACE</small></div></div>
        <div className="workspace"><div className="workspace-mark">O</div><div><b>{workspaceName}</b><small>Starter plan</small></div><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-menu">
          <button className={`nav-item ${activeSection === "Overview" ? "active" : ""}`} onClick={() => navigate("Overview")}><LayoutDashboard size={17} /> Overview <span className="nav-dot" /></button>
          <button className={`nav-item ${activeSection === "All tickets" ? "active" : ""}`} onClick={() => navigate("All tickets")}><ListTodo size={17} /> All tickets <span className="nav-count">{tickets.length}</span></button>
          <button className={`nav-item ${activeSection === "Schedule" ? "active" : ""}`} onClick={() => navigate("Schedule")}><CalendarDays size={17} /> Schedule</button>
          <button className={`nav-item ${activeSection === "Team members" ? "active" : ""}`} onClick={() => navigate("Team members")}><Users size={17} /> Team members</button>
          <button className={`nav-item ${activeSection === "Activity log" ? "active" : ""}`} onClick={() => navigate("Activity log")}><Activity size={17} /> Activity log</button>
        </nav>
        <div className="nav-label second-label">TOOLS</div>
        <nav className="nav-menu">
          <button className={`nav-item ${activeSection === "SLA policies" ? "active" : ""}`} onClick={() => navigate("SLA policies")}><ShieldCheck size={17} /> SLA policies</button>
          <button className={`nav-item ${activeSection === "Settings" ? "active" : ""}`} onClick={() => navigate("Settings")}><Settings2 size={17} /> Settings</button>
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="/staff"> <ShieldCheck size={17} /> Staff Portal ↗</a><a className="nav-item" href="/portal"> <Users size={17} /> Open User Portal ↗</a>
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><b>Need a hand?</b><p>Check your workspace guide for tips and shortcuts.</p><button onClick={() => { setTourStep(0); navigate('Overview'); }}>Start portal tour <span>↗</span></button></div>
          <button type="button" className="profile profile-trigger" onClick={openProfileEditor} aria-label={`Edit profile for ${profile.name}`}><span className="avatar">{profile.photo ? <img src={profile.photo} alt="" /> : profileInitials}</span><span className="profile-name"><b>{profile.name}</b><small>{profile.email}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <b>{activeSection}</b></div>
          <div className="top-actions"><span className="system-status"><i /> System operational</span><ThemeToggle /><button className="icon-button" title="Notifications" onClick={() => notify('You are all caught up!')}><Bell size={18} /><em /></button><button type="button" className="top-avatar profile-avatar-button" title="Edit profile" aria-label={`Edit profile for ${profile.name}`} onClick={openProfileEditor}>{profile.photo ? <img src={profile.photo} alt="" /> : profileInitials}</button></div>
        </header>
        <div className="page-content" id="dashboard">
          {activeSection === 'Overview' && <>
          <div className="welcome-row"><div><div className="eyebrow">{weekday}, YOUR WORKSPACE AT A GLANCE</div><h1>{greeting}, {profile.name || 'Admin'} <span>✦</span></h1><p>Here’s what’s happening with your support team today.</p></div><div className="welcome-actions"><button className="button secondary" onClick={loadData}><RefreshCw size={15} /> Refresh</button><button className="button primary" onClick={openCreate}><Plus size={17} /> Create ticket</button></div></div>

          {apiError && <div className="error-banner"><AlertCircle size={19} /><div><b>Can't connect to the backend</b><p>{apiError}. Start Flask in the backend terminal, then click Refresh.</p></div><button onClick={loadData}>Retry</button></div>}

          <section className="stat-grid">
            <StatCard label="Total tickets" value={stats.total} note="Across all statuses" icon={<Ticket size={19} />} tone="blue" />
            <StatCard label="Open tickets" value={stats.open_count} note="Waiting for a response" icon={<Clock3 size={19} />} tone="orange" />
            <StatCard label="In progress" value={stats.in_progress_count} note="Currently being worked on" icon={<Activity size={19} />} tone="purple" />
            <StatCard label="Resolved" value={stats.resolved_count} note="Successfully completed" icon={<CheckCircle2 size={19} />} tone="green" />
          </section>
          <section className="stat-grid analytics-extra-stats">
            <StatCard label="Average resolution" value={avgResolutionHours === null ? '—' : avgResolutionHours < 1 ? `${Math.round(avgResolutionHours * 60)}m` : `${avgResolutionHours.toFixed(1)}h`} note="Based on resolved tickets" icon={<Timer size={19} />} tone="blue" />
            <StatCard label="Overdue tickets" value={overdueTickets.length} note="Past their SLA target" icon={<AlertTriangle size={19} />} tone={overdueTickets.length ? 'orange' : 'green'} />
          </section>

          {overdueTickets.length > 0 && <section className="sla-alert-panel"><div className="sla-alert-icon"><AlertTriangle size={20} /></div><div className="sla-alert-copy"><b>{overdueTickets.length} ticket{overdueTickets.length === 1 ? '' : 's'} overdue</b><p>Review the SLA deadlines and assign an available technician.</p></div><button className="button secondary" onClick={() => { setStatusFilter('All statuses'); setPriorityFilter('All priorities'); setSearch(''); document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth' }); }}>Review tickets</button></section>}

          <section className="analytics-grid">
            <article className="analytics-card"><div className="analytics-heading"><div><h2><BarChart3 size={18} /> Tickets created vs resolved</h2><p>Daily activity over the last 7 days</p></div><span className="chart-legend"><i className="legend-created" /> Created <i className="legend-resolved" /> Resolved</span></div><div className="daily-chart">{dailyActivity.map(day => <div className="daily-chart-group" key={day.label}><div className="daily-bars"><span className="bar-created" title={`${day.created} created`} style={{ height: `${Math.max(4, day.created / maxDaily * 100)}%` }} /><span className="bar-resolved" title={`${day.resolved} resolved`} style={{ height: `${Math.max(4, day.resolved / maxDaily * 100)}%` }} /></div><small>{day.label}</small></div>)}</div></article>
            <article className="analytics-card"><div className="analytics-heading"><div><h2><PieChart size={18} /> Ticket status</h2><p>Current distribution</p></div></div><div className="status-chart-layout"><div className="status-donut" style={{ background: `conic-gradient(#f59e0b 0 ${(tickets.filter(t => t.status === 'Open').length / Math.max(1, tickets.length)) * 100}%, #7667e8 0 ${((tickets.filter(t => t.status === 'Open').length + tickets.filter(t => t.status === 'In Progress').length) / Math.max(1, tickets.length)) * 100}%, #17a673 0 ${((tickets.filter(t => ['Open', 'In Progress', 'Resolved'].includes(t.status)).length) / Math.max(1, tickets.length)) * 100}%, #9aa9ba 0 100%)` }}><div><b>{tickets.length}</b><small>tickets</small></div></div><div className="status-legend">{statusCounts.map(item => <div key={item.status}><span className={`status-legend-dot ${item.status.toLowerCase().replace(' ', '-')}`} /><span>{item.status}</span><b>{item.count}</b></div>)}</div></div></article>
            <article className="analytics-card technician-analytics"><div className="analytics-heading"><div><h2><UserCheck size={18} /> Technician workload</h2><p>Assigned and resolved tickets</p></div><button className="text-action" onClick={() => navigate('Team members')}>Manage team</button></div>{technicianStats.length ? technicianStats.map(person => <div className="technician-row" key={person.name}><div className="technician-row-label"><span className="mini-avatar">{person.name.slice(0, 1).toUpperCase()}</span><b>{person.name}</b><small>{person.resolved}/{person.assigned} resolved</small></div><div className="workload-track"><span style={{ width: `${person.assigned ? person.resolved / person.assigned * 100 : 0}%` }} /></div></div>) : <p className="empty-chart-note">Add technicians to see workload and performance.</p>}</article>
          </section>

          </>}

          {activeSection !== 'Overview' && <div className="welcome-row section-page-heading"><div><div className="eyebrow">DAIRYCARE 360 WORKSPACE</div><h1>{activeSection}</h1><p>{({ 'All tickets': 'Search, assign, update and export individual support tickets.', Schedule: 'Plan recurring reminders by weekday and time, and manage notifications.', 'Team members': 'Manage the technicians and people supporting your customers.', 'Activity log': 'Review recent changes made in your workspace.', 'SLA policies': 'Configure service targets and monitor ticket deadlines.', Settings: 'Manage workspace preferences and API connection.' })[activeSection] || 'Manage your workspace.'}</p></div>{activeSection === 'All tickets' && <div className="welcome-actions"><button className="button primary" onClick={openCreate}><Plus size={17} /> New ticket</button></div>}</div>}

          {(activeSection === 'Overview' || activeSection === 'All tickets') && <section className="tickets-panel" id="tickets">
            <div className="panel-heading"><div><h2>{activeSection === 'All tickets' ? 'All tickets' : 'Recent tickets'} <span className="count-pill">{filteredTickets.length}</span></h2><p>{activeSection === 'All tickets' ? 'Search, filter, assign, update and export individual support tickets.' : 'Track, prioritize, and resolve support requests.'}</p></div><div className="panel-heading-actions"><button className="button primary small-button" onClick={openCreate}><Plus size={16} /> New ticket</button></div></div>
            <div className="filter-bar">
              <label className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tickets..." /></label>
              <label className="select-box"><Filter size={15} /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All statuses</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select><ChevronDown size={14} /></label>
              <label className="select-box"><ArrowDownUp size={15} /><select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option>All priorities</option>{PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select><ChevronDown size={14} /></label>
              <div className="results-label">{filteredTickets.length} results</div>
            </div>
            {selectedIds.length > 0 && <div className="bulk-toolbar"><span>{selectedIds.length} selected</span><button className="button secondary" onClick={() => setSelectedIds([])}>Clear selection</button><button className="button danger-button" onClick={deleteSelected}><Trash2 size={14} /> Delete selected</button></div>}
            <div className="table-wrap">
              <table>
                <thead><tr><th><input type="checkbox" aria-label="Select all tickets" checked={filteredTickets.length > 0 && filteredTickets.every(ticket => selectedIds.includes(ticket.id))} onChange={event => setSelectedIds(event.target.checked ? filteredTickets.map(ticket => ticket.id) : [])} /></th><th>TICKET ID</th><th>NAME</th><th>TICKET</th><th>STATUS</th><th>PRIORITY</th><th>ASSIGNEE</th><th>SLA</th><th>CREATED</th><th className="pdf-action-heading">PDF / ACTIONS</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="10" className="empty-state">Loading tickets…</td></tr> :
                    filteredTickets.length === 0 ? <tr><td colSpan="10" className="empty-state"><div className="empty-icon"><ListTodo size={23} /></div><b>{apiError ? 'Backend connection needed' : 'No tickets found'}</b><p>{apiError ? 'Start Flask and refresh to load tickets.' : 'Create your first ticket or adjust your filters.'}</p>{!apiError && <button className="button primary" onClick={openCreate}><Plus size={15} /> Create first ticket</button>}</td></tr> :
                    filteredTickets.map(ticket => <tr key={ticket.id}>
                      <td><input type="checkbox" aria-label={`Select ticket ${ticket.id}`} checked={selectedIds.includes(ticket.id)} onChange={event => toggleSelected(ticket.id, event.target.checked)} /></td>
                      <td className="ticket-id-cell">{displayTicketId(ticket.id)}</td>
                      <td className="requester-name-cell">{ticket.requester_name || ticket.requester_email || 'Unknown user'}</td>
                      <td><button className="ticket-title" onClick={() => openEdit(ticket)}><b>{ticket.title}</b></button><div className="ticket-subtitle">{ticket.category} · {ticket.description || 'No description'}</div></td>
                      <td><StatusBadge status={ticket.status} /></td>
                      <td><PriorityBadge priority={ticket.priority} /></td>
                      <td><div className="assignee"><span className="mini-avatar">{(ticket.assignee || 'U').slice(0, 1).toUpperCase()}</span>{ticket.assignee || 'Unassigned'}</div></td>
                      <td><span className={`sla-badge ${getSlaInfo(ticket).state}`} title={`Target: ${slaTargetHours(ticket)} hours`}>{getSlaInfo(ticket).label}</span></td>
                      <td className="date-cell">{prettyDate(ticket.created_at)}</td>
                      <td><div className="row-actions"><button className="tiny-icon pdf-ticket-button" title={`Save ticket ${displayTicketId(ticket.id)} as PDF`} aria-label={`Save ticket ${displayTicketId(ticket.id)} as PDF`} onClick={() => exportTicketPdf(ticket)}><FileDown size={15} /></button><select aria-label={`Change status for ticket ${ticket.id}`} value={ticket.status} onChange={event => changeStatus(ticket, event.target.value)}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select><button className="tiny-icon" title="Edit ticket" onClick={() => openEdit(ticket)}><Settings2 size={15} /></button><button className="tiny-icon danger" title="Delete ticket" onClick={() => deleteTicket(ticket)}><Trash2 size={15} /></button></div></td>
                    </tr>)
                  }
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <b>{filteredTickets.length}</b> of <b>{tickets.length}</b> tickets</span><span>Changes save to MySQL <i className={apiError ? 'offline-dot' : ''} /></span></div>
          </section>}
          {activeSection === 'Schedule' && <section className="calendar-page">
            <aside className="calendar-sidebar">
              <div className="calendar-sidebar-top"><div className="calendar-app-icon"><CalendarDays size={18} /></div><button className="button secondary today-button" onClick={() => { setCalendarDate(new Date()); setMiniMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}>Today</button><button className="icon-button calendar-settings" title="Enable notifications" onClick={enableBrowserNotifications}><BellRing size={16} /></button></div>
              <div className="mini-calendar-head"><b>{miniMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><div><button onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth()-1, 1))}>‹</button><button onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth()+1, 1))}>›</button></div></div>
              <div className="mini-calendar-grid">{['S','M','T','W','T','F','S'].map((day,i)=><span className="mini-weekday" key={day+i}>{day}</span>)}{Array.from({length:new Date(miniMonth.getFullYear(),miniMonth.getMonth(),1).getDay()},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:new Date(miniMonth.getFullYear(),miniMonth.getMonth()+1,0).getDate()},(_,i)=>{const day=i+1;const date=new Date(miniMonth.getFullYear(),miniMonth.getMonth(),day);const selected=date.toDateString()===calendarDate.toDateString();const today=date.toDateString()===new Date().toDateString();return <button key={day} className={`${selected?'selected':''} ${today?'today':''}`} onClick={()=>setCalendarDate(date)}>{day}</button>})}</div>
              <div className="employee-calendar-title">Team calendars</div>
              <div className="employee-calendar-list">{teamMembers.map((member,i)=><label key={member}><input type="checkbox" defaultChecked/><span className={`calendar-person-dot person-${i%5}`}/><span>{member}</span></label>)}</div>
              <div className="calendar-sidebar-note"><BellRing size={16}/><b>Notifications</b><p>Get reminders for scheduled ticket reviews and support tasks.</p><button onClick={enableBrowserNotifications}>Enable notifications ↗</button></div>
            </aside>
            <div className="calendar-main">
              <div className="calendar-toolbar"><div className="calendar-search"><Search size={15}/><input placeholder="Search schedule..." onChange={event=>setCalendarSearch(event.target.value)}/></div><div className="calendar-date-nav"><button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth(),calendarDate.getDate()-1))}>‹</button><b>{calendarDate.toLocaleDateString(undefined,{weekday:'short',month:'long',day:'numeric',year:'numeric'})}</b><button onClick={()=>setCalendarDate(new Date(calendarDate.getFullYear(),calendarDate.getMonth(),calendarDate.getDate()+1))}>›</button></div><div className="calendar-toolbar-actions"><select aria-label="Calendar view" value={calendarView} onChange={e=>setCalendarView(e.target.value)}><option>Day</option><option>Week</option></select><button className="calendar-add-button" onClick={()=>setShowScheduleForm(!showScheduleForm)} title="Add schedule">+</button></div></div>
              {showScheduleForm && <section className="calendar-add-panel"><form className="calendar-inline-form" onSubmit={event=>{addSchedule(event);setShowScheduleForm(false);}}><label>Reminder title<input value={scheduleForm.title} onChange={e=>setScheduleForm({...scheduleForm,title:e.target.value})} required placeholder="e.g. Review urgent tickets"/></label><label>Repeat day<select value={scheduleForm.day} onChange={e=>setScheduleForm({...scheduleForm,day:e.target.value})}>{['Every day','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=><option key={day}>{day}</option>)}</select></label><label>Time<select value={scheduleForm.time} onChange={e=>setScheduleForm({...scheduleForm,time:e.target.value})}>{[{value:'07:00',label:'7:00 AM'},{value:'08:00',label:'8:00 AM'},{value:'09:00',label:'9:00 AM'},{value:'10:00',label:'10:00 AM'},{value:'11:00',label:'11:00 AM'},{value:'12:00',label:'12:00 PM'},{value:'13:00',label:'1:00 PM'},{value:'14:00',label:'2:00 PM'},{value:'15:00',label:'3:00 PM'},{value:'16:00',label:'4:00 PM'},{value:'17:00',label:'5:00 PM'},{value:'18:00',label:'6:00 PM'},{value:'19:00',label:'7:00 PM'}].map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><label>Assign to<select value={scheduleForm.assignee} onChange={e=>setScheduleForm({...scheduleForm,assignee:e.target.value})}>{teamMembers.map(member=><option key={member}>{member}</option>)}</select></label><label className="calendar-notify-check"><input type="checkbox" checked={scheduleForm.notification} onChange={e=>setScheduleForm({...scheduleForm,notification:e.target.checked})}/> Notify me</label><button className="button primary" type="submit"><PlusCircle size={15}/> Add event</button></form></section>}
              <div className={`calendar-grid-wrap ${calendarView==='Week'?'week-view':''}`}><div className="calendar-grid" style={{'--calendar-columns':calendarView==='Week'?7:Math.max(1,teamMembers.length)}}><div className="calendar-time-head"></div>{(calendarView==='Week'?Array.from({length:7},(_,i)=>{const d=new Date(calendarDate);d.setDate(d.getDate()-d.getDay()+i);return {name:d.toLocaleDateString(undefined,{weekday:'short'}),sub:d.toLocaleDateString(undefined,{month:'short',day:'numeric'}),member:null,date:d};}):teamMembers.map((member,i)=>({name:member,sub:'Team calendar',member,date:calendarDate,index:i}))).map((col,i)=><div className="calendar-column-head" key={col.name+i}><span className={`calendar-person-dot person-${i%5}`}/><b>{col.name}</b><small>{col.sub}</small></div>)}
                <div className="calendar-time-column">{Array.from({length:12},(_,i)=><div key={i}>{new Date(2000,0,1,8+i).toLocaleTimeString(undefined,{hour:'numeric',hour12:true}).toLowerCase()}</div>)}</div>
                {(calendarView==='Week'?Array.from({length:7},(_,i)=>{const d=new Date(calendarDate);d.setDate(d.getDate()-d.getDay()+i);return {name:d.toLocaleDateString(undefined,{weekday:'short'}),member:null,date:d,index:i};}):teamMembers.map((member,i)=>({name:member,member,date:calendarDate,index:i}))).map((col,i)=><div className="calendar-day-column" key={col.name+i}>{Array.from({length:12},(_,hour)=><div className="calendar-hour-line" key={hour}/>)}{scheduleItems.filter(item=>{const dayName=col.date.toLocaleDateString(undefined,{weekday:'long'});const dayMatch=item.day==='Every day'||item.day===dayName;const personMatch=calendarView==='Week'||!item.assignee||item.assignee===col.member;const queryMatch=!calendarSearch||item.title.toLowerCase().includes(calendarSearch.toLowerCase());return dayMatch&&personMatch&&queryMatch;}).map(item=>{const [h,m]=item.time.split(':').map(Number);const top=Math.max(0,(h-8)*62+(m/60)*62);return <div key={item.id} className={`calendar-event event-${item.enabled?'active':'paused'}`} style={{top:`${top}px`}}><b>{item.title}</b><small>{new Date(`2000-01-01T${item.time}:00`).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</small><small>{item.assignee||'Workspace'}</small><div className="calendar-event-actions"><button onClick={()=>toggleSchedule(item.id)} title={item.enabled?'Pause':'Enable'}>{item.enabled?'Pause':'Resume'}</button><button onClick={()=>deleteSchedule(item.id)} title="Delete event"><Trash size={12}/></button></div></div>})}</div>)}
              </div></div>
              <div className="calendar-footer"><span>{scheduleItems.length} scheduled event{scheduleItems.length===1?'':'s'}</span><span>Local time · {calendarDate.toLocaleDateString(undefined,{weekday:'long'})}</span></div>
            </div>
          </section>}
          {activeSection === 'Team members' && <section className="tickets-panel extra-panel"><div className="panel-heading"><div><h2>Team members</h2><p>Manage members for this workspace.</p></div></div><form className="member-form" onSubmit={addMember}><input value={newMember} onChange={event => setNewMember(event.target.value)} placeholder="Team member name" required /><button className="button primary" type="submit"><Plus size={15} /> Add member</button></form><div className="simple-list">{teamMembers.map(member => <div className="simple-list-row" key={member}><span className="mini-avatar">{member.slice(0,1).toUpperCase()}</span><b>{member}</b><button className="button secondary" onClick={() => removeMember(member)}>Remove</button></div>)}</div><p className="muted-note">Team list is stored in this browser; ticket data is stored in MySQL.</p></section>}
          {activeSection === 'Activity log' && <section className="tickets-panel extra-panel"><div className="panel-heading"><div><h2>Activity log</h2><p>Audit trail of ticket and team changes on this browser.</p></div><div className="panel-heading-actions"><button className="button secondary" onClick={() => { setActivityLogs([]); localStorage.removeItem('dairycare-activity-logs'); notify('Activity log cleared.'); }}><Trash2 size={14} /> Clear log</button><button className="button secondary" onClick={loadData}><RefreshCw size={15} /> Refresh tickets</button></div></div><div className="simple-list">{activityLogs.map(entry => <div className="simple-list-row" key={entry.id}><span className="activity-dot" /><div className="activity-copy"><b>{entry.action}{entry.ticketId ? ` · Ticket #${entry.ticketId}: ${entry.title}` : ''}</b>{entry.details && <small>{entry.details}</small>}<small>{new Date(entry.at).toLocaleString()}</small></div>{entry.ticketId && tickets.some(ticket => ticket.id === entry.ticketId) && <button className="button secondary" onClick={() => openEdit(tickets.find(ticket => ticket.id === entry.ticketId))}>Open</button>}</div>)}{activityLogs.length === 0 && <p className="empty-state">No activity recorded yet. Creating or updating tickets will appear here.</p>}</div><p className="muted-note">Activity history is stored in this browser. For a shared, tamper-resistant audit trail across users, connect these events to a backend database table.</p></section>}
          {activeSection === 'SLA policies' && <section className="tickets-panel extra-panel"><div className="panel-heading"><div><h2>SLA policies</h2><p>Configure response-time targets for each ticket priority.</p></div></div><form className="settings-form sla-policy-form" onSubmit={saveSettings}>
            <label className="field-label">Critical priority (hours)<input type="number" min="1" max="720" step="1" value={slaCriticalHours} onChange={event => setSlaCriticalHours(event.target.value)} required /></label>
            <label className="field-label">High priority (hours)<input type="number" min="1" max="720" step="1" value={slaHighHours} onChange={event => setSlaHighHours(event.target.value)} required /></label>
            <label className="field-label">Medium priority (hours)<input type="number" min="1" max="720" step="1" value={slaHours} onChange={event => setSlaHours(event.target.value)} required /></label>
            <label className="field-label">Low priority (hours)<input type="number" min="1" max="720" step="1" value={slaLowHours} onChange={event => setSlaLowHours(event.target.value)} required /></label>
            <button className="button primary" type="submit">Save SLA targets</button>
          </form><p className="muted-note">Targets are saved in this browser and immediately used to recalculate ticket deadlines. Existing tickets use the target for their current priority; resolved and closed tickets show Completed. Values must be between 1 and 720 hours.</p></section>}
          {activeSection === 'Settings' && <div className="settings-page">
            <section className="settings-hero"><div className="settings-hero-icon"><Settings2 size={23}/></div><div><div className="eyebrow">WORKSPACE CONFIGURATION</div><h2>Settings & preferences</h2><p>Manage your DairyCare 360 workspace, notifications, business hours and ticket defaults in one place.</p></div><span className={`connection-pill ${apiError ? 'offline' : 'online'}`}><i/> {apiError ? 'API disconnected' : 'API connected'}</span></section>
            <form onSubmit={saveSettings} className="settings-grid">
              <section className="settings-card settings-card-wide"><div className="settings-card-heading"><span className="settings-icon blue"><Building2 size={19}/></span><div><h3>Workspace profile</h3><p>Branding and contact details for your support workspace.</p></div></div><div className="settings-fields"><label className="field-label">Workspace name<input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} maxLength="80" required placeholder="DairyCare 360"/><small>This name appears in the workspace interface.</small></label><label className="field-label">Support contact email<input type="email" value={settingsPrefs.companyEmail} onChange={event => updatePreference('companyEmail', event.target.value)} placeholder="support@yourcompany.com"/><small>Used as a reference contact; email delivery needs backend configuration.</small></label></div></section>
              <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon amber"><Timer size={19}/></span><div><h3>SLA & ticket defaults</h3><p>Choose default targets for new support work.</p></div></div><div className="settings-fields single"><label className="field-label">Default resolution target (hours)<input type="number" min="1" max="720" value={slaHours} onChange={event => setSlaHours(event.target.value)} required/><small>Medium priority uses this target; Critical and High retain their configured targets.</small></label><label className="field-label">Default ticket priority<select value={settingsPrefs.defaultPriority} onChange={event => updatePreference('defaultPriority', event.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label></div><p className="settings-inline-note">For priority-specific targets and breach rules, use the SLA Policies page.</p></section>
              <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon teal"><CalendarClock size={19}/></span><div><h3>Business hours & locale</h3><p>Set your team's working window and display preferences.</p></div></div><div className="settings-fields single"><label className="field-label">Timezone<select value={settingsPrefs.timezone} onChange={event => updatePreference('timezone', event.target.value)}><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="Europe/London">UK time</option><option value="Asia/Singapore">Singapore time</option></select></label><div className="settings-two-fields"><label className="field-label">Work starts<input type="time" value={settingsPrefs.businessStart} onChange={event => updatePreference('businessStart', event.target.value)}/></label><label className="field-label">Work ends<input type="time" value={settingsPrefs.businessEnd} onChange={event => updatePreference('businessEnd', event.target.value)}/></label></div><label className="field-label">Date format<select value={settingsPrefs.dateFormat} onChange={event => updatePreference('dateFormat', event.target.value)}><option>DD MMM YYYY</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></label></div><p className="settings-inline-note">These preferences are saved locally; connect them to backend SLA calculations to enforce business-hour deadlines.</p></section>
              <section className="settings-card settings-card-wide"><div className="settings-card-heading"><span className="settings-icon violet"><BellRing size={19}/></span><div><h3>Notification preferences</h3><p>Choose which events should be highlighted in your workspace.</p></div></div><div className="settings-toggle-list">
                {[['notifyAssignment','Ticket assigned','Notify when a ticket is assigned to a support agent or technician.'],['notifyOverdue','SLA deadline warnings','Highlight tickets approaching or passing their SLA deadline.'],['notifySchedule','Schedule reminders','Enable reminders for upcoming technician visits and recurring tasks.'],['notifyResolution','Ticket resolved','Show a notification when a ticket is marked resolved.'],['weeklyBackupReminder','Weekly backup reminder','Show a reminder to review database backup status.']].map(([key,title,description])=><label className="settings-toggle-row" key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={Boolean(settingsPrefs[key])} onChange={event => updatePreference(key, event.target.checked)}/></label>)}
              </div><p className="settings-inline-note">These preferences save in this browser. Actual email and background notifications require a configured backend notification service.</p></section>
              <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon slate"><LockKeyhole size={19}/></span><div><h3>Access & security</h3><p>Keep staff access controlled.</p></div></div><div className="settings-info-list"><div><ShieldCheck size={17}/><span><b>Role-based staff access</b><small>Manage Support and Technician roles through staff account configuration.</small></span></div><div><LockKeyhole size={17}/><span><b>Backend authorization</b><small>Protect privileged actions in Flask, not only by hiding frontend controls.</small></span></div></div></section>
              <section className="settings-card settings-card-wide admin-users-card"><div className="settings-card-heading"><span className="settings-icon violet"><Users size={19}/></span><div><h3>User accounts</h3><p>Review registered customers and deactivate accounts that submit fake or abusive tickets.</p></div><button type="button" className="button secondary" onClick={loadManagedUsers} disabled={usersLoading}><RefreshCw size={15}/> Refresh</button></div>
                {usersError && <p className="settings-inline-note text-danger">{usersError}</p>}
                {usersError.toLowerCase().includes('administrator access') || usersError.toLowerCase().includes('signed-in administrator') || usersError.toLowerCase().includes('administrator') ? <div className="settings-fields" role="group" aria-label="Administrator sign in"><label className="field-label">Administrator email<input type="email" value={adminLoginEmail} onChange={e => setAdminLoginEmail(e.target.value)} required autoComplete="username" placeholder="Admin email" /></label><label className="field-label">Administrator password<input type="password" value={adminLoginPassword} onChange={e => setAdminLoginPassword(e.target.value)} required autoComplete="current-password" placeholder="Admin password" /></label><button className="button primary" type="button" disabled={adminLoginBusy} onClick={() => signInAdminForUserManagement({ preventDefault() {} })}>{adminLoginBusy ? 'Signing in…' : 'Sign in as administrator'}</button></div> : null}
                {usersLoading ? <p className="muted-note">Loading registered accounts…</p> : managedUsers.length === 0 ? <p className="muted-note">No accounts to display. Refresh after signing in as an administrator.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Account status</th><th>Action</th></tr></thead><tbody>{managedUsers.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.created_at ? prettyDate(user.created_at) : '—'}</td><td><span className={`status-pill ${user.is_active ? 'status-resolved' : 'status-closed'}`}>{user.is_active ? 'Active' : 'Deactivated'}</span></td><td><button type="button" className={`button ${user.is_active ? 'secondary danger-button' : 'primary'}`} disabled={userActionId === user.id || (user.role === 'admin' && managedUsers.filter(item => item.role === 'admin' && item.is_active).length <= 1 && user.is_active)} onClick={() => setUserActiveStatus(user, !user.is_active)}>{userActionId === user.id ? 'Saving…' : user.is_active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody></table></div>}
                <p className="settings-inline-note">Deactivated users cannot log in, and active sessions are rejected by the backend on their next API request. Your own admin account and the last active administrator are protected.</p>
              </section>
              <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon green"><Database size={19}/></span><div><h3>System & connection</h3><p>Check the live API connection.</p></div></div><div className="connection-detail"><span>Flask API endpoint</span><code>{API}</code><span>Current status</span><b className={apiError ? 'text-danger' : 'text-success'}>{apiError ? 'Disconnected' : 'Connected to API'}</b></div><div className="settings-actions"><button className="button secondary" type="button" onClick={loadData}><RefreshCw size={15}/> Test API connection</button></div><p className="settings-inline-note">Database backups and credentials should be configured securely on the backend, not in this page.</p></section>
              <div className="settings-savebar"><span><ShieldCheck size={16}/> Preferences are stored in this browser.</span><button className="button primary" type="submit"><Save size={16}/> Save all settings</button></div>
            </form>
          </div>}
          <footer className="page-footer"><span>© 2026 DairyCare 360 · Support Management</span><span><i /> All changes synced when backend is connected</span></footer>
        </div>
      </main>

      {showModal && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowModal(false); }}>
        <form className="ticket-modal" onSubmit={saveTicket}>
          <div className="modal-heading"><div><div className="modal-icon"><Ticket size={20} /></div><h2>{editing ? `Edit ticket #${editing.id}` : 'Create a new ticket'}</h2><p>Fill in the details below to {editing ? 'update this request' : 'create a support request'}.</p></div><button type="button" className="icon-button" onClick={() => setShowModal(false)} aria-label="Close"><X size={19} /></button></div>
          <label className="field-label">Ticket title <span>*</span><input required autoFocus maxLength={200} placeholder="e.g. Unable to connect to office Wi-Fi" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
          <label className="field-label">Description<textarea rows="3" placeholder="Add more details about the issue..." value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
          <div className="form-grid"><label className="field-label">Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{['General', 'Network', 'Hardware', 'Software', 'Access', 'Email', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label className="field-label">Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select></label><label className="field-label">Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></label><label className="field-label">Assign to<select value={form.assignee} onChange={event => setForm({ ...form, assignee: event.target.value })}><option value="">Unassigned</option>{teamMembers.map(member => <option key={member} value={member}>{member}</option>)}{form.assignee && !teamMembers.includes(form.assignee) && <option value={form.assignee}>{form.assignee}</option>}</select></label></div>
          <div className="modal-footer"><span><ShieldCheck size={15} /> Saved to your workspace database</span><div><button type="button" className="button secondary" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : <><Plus size={16} /> Create ticket</>}</button></div></div>
        </form>
      </div>}
      {profileOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
        <form className="ticket-modal profile-modal" onSubmit={saveProfile}>
          <div className="modal-heading"><div><div className="modal-icon"><UserRound size={20} /></div><h2>My profile</h2><p>Update the details shown in your admin workspace.</p></div><button type="button" className="icon-button" onClick={() => setProfileOpen(false)} aria-label="Close profile editor"><X size={19} /></button></div>
          <div className="profile-photo-row"><div className="profile-photo-preview">{profileDraft.photo ? <img src={profileDraft.photo} alt="Profile preview" /> : profileDraftInitials}</div><div className="profile-photo-actions"><label className="button secondary"><Camera size={15} /> Upload photo<input type="file" accept="image/*" onChange={updateProfilePhoto} /></label>{profileDraft.photo && <button type="button" className="text-action" onClick={() => setProfileDraft(current => ({ ...current, photo: '' }))}>Remove photo</button>}<small>Image file, up to 1 MB. Saved only in this browser.</small></div></div>
          <div className="form-grid profile-fields"><label className="field-label">Full name<input required maxLength={100} autoFocus value={profileDraft.name} onChange={event => setProfileDraft(current => ({ ...current, name: event.target.value }))} /></label><label className="field-label">Email address<input required type="email" maxLength={160} value={profileDraft.email} onChange={event => setProfileDraft(current => ({ ...current, email: event.target.value }))} /></label><label className="field-label">Job title<input maxLength={80} value={profileDraft.title} onChange={event => setProfileDraft(current => ({ ...current, title: event.target.value }))} placeholder="Administrator" /></label><label className="field-label">Phone number<input type="tel" maxLength={40} value={profileDraft.phone} onChange={event => setProfileDraft(current => ({ ...current, phone: event.target.value }))} placeholder="Optional" /></label></div>
          <p className="profile-storage-note">These profile details are stored in this browser and do not change your sign-in credentials.</p>
          <div className="modal-footer"><span><UserRound size={15} /> Admin profile</span><div><button type="button" className="button secondary" onClick={() => setProfileOpen(false)}>Cancel</button><button type="submit" className="button primary"><Save size={16} /> Save profile</button></div></div>
        </form>
      </div>}
      {tourStep >= 0 && tourStep < tourSteps.length && (() => { const step = tourSteps[tourStep]; const StepIcon = step.icon; return <div className="portal-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="portal-tour-title"><section className="portal-tour-card"><button className="portal-tour-close" onClick={() => setTourStep(-1)} aria-label="Close portal tour"><X size={18}/></button><div className="portal-tour-topline"><span className="portal-tour-icon"><StepIcon size={23}/></span><span>DAIRYCARE 360 · QUICK TOUR</span></div><div className="portal-tour-progress"><span style={{width:`${((tourStep+1)/tourSteps.length)*100}%`}}/></div><p className="portal-tour-count">STEP {tourStep+1} OF {tourSteps.length}</p><h2 id="portal-tour-title">{step.title}</h2><p className="portal-tour-body">{step.body}</p><div className="portal-tour-current"><span>Current area</span><b>{step.section}</b></div><div className="portal-tour-actions"><button className="button secondary" onClick={() => { if(tourStep===0) setTourStep(-1); else { const next=tourStep-1; setTourStep(next); navigate(tourSteps[next].section); } }}>{tourStep===0?'Exit tour':'Back'}</button><button className="button primary" onClick={() => { if(tourStep===tourSteps.length-1) { setTourStep(-1); setHelpOpen(true); } else { const next=tourStep+1; setTourStep(next); navigate(tourSteps[next].section); } }}>{tourStep===tourSteps.length-1?'Finish & open help':'Next'} <span aria-hidden="true">→</span></button></div><button className="portal-tour-skip" onClick={() => setTourStep(-1)}>Skip tour for now</button></section></div>; })()}
      <div className="helpdesk-widget">
        {helpOpen && <section className="helpdesk-panel" aria-label="DairyCare 360 helpdesk assistant">
          <header className="helpdesk-header"><span className="helpdesk-bot-icon"><Bot size={20}/></span><div><strong>Helpdesk Assistant</strong><small><i/> DairyCare 360 quick guide</small></div><button className="helpdesk-close" onClick={() => setHelpOpen(false)} aria-label="Minimize helpdesk"><Minimize2 size={17}/></button></header>
          <div className="helpdesk-messages" aria-live="polite">{helpMessages.map((message, index) => <div key={index} className={`helpdesk-message ${message.from}`}><span>{message.from === 'assistant' ? <Bot size={14}/> : 'You'}</span><p>{message.text}</p></div>)}</div>
          <div className="helpdesk-quick-questions"><small>QUICK HELP</small><div><button onClick={() => sendHelpMessage('How do I create a ticket?')}>Create ticket</button><button onClick={() => sendHelpMessage('How do I give staff access?')}>Staff access</button><button onClick={() => sendHelpMessage('How do SLA deadlines work?')}>SLA deadlines</button><button onClick={() => sendHelpMessage('How do I use the schedule and notifications?')}>Schedule</button></div></div>
          <form className="helpdesk-input-row" onSubmit={event => { event.preventDefault(); sendHelpMessage(); }}><input value={helpInput} onChange={event => setHelpInput(event.target.value)} placeholder="Ask how to use DairyCare 360…" aria-label="Ask helpdesk a question"/><button type="submit" disabled={!helpInput.trim()} aria-label="Send question"><Send size={17}/></button></form>
          <p className="helpdesk-disclaimer">Quick in-app guidance · No live AI service connected</p>
        </section>}
        <button className={`helpdesk-launcher ${helpOpen ? 'is-open' : ''}`} onClick={() => setHelpOpen(open => !open)} aria-label={helpOpen ? 'Close helpdesk assistant' : 'Open helpdesk assistant'} title="Helpdesk assistant">{helpOpen ? <X size={22}/> : <><MessageCircle size={21}/><span>Helpdesk</span></>}</button>
      </div>
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function StatCard({ label, value, note, icon, tone }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note"><span className={`note-dot ${tone}`} />{note}</div></article>;
}
function StatusBadge({ status }) {
  const cls = status.toLowerCase().replace(' ', '-');
  return <span className={`status-badge ${cls}`}><i />{status}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`priority-badge ${priority.toLowerCase()}`}><i />{priority}</span>;
}

export default App;
