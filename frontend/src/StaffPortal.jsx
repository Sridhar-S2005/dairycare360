import React, { useCallback, useEffect, useState } from 'react';

function displayTicketId(id) { return `AKC10${String(id).padStart(2, '0').slice(-2)}`; }
import { Activity, AlertCircle, ArrowLeft, CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck, Ticket, Users, Wrench } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

const API = `${(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')}/api`;
const requestOptions = { credentials: 'include' };

export default function StaffPortal() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTickets = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`${API}/staff/tickets`, requestOptions);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load tickets');
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message || 'Could not connect to the server'); }
  }, []);

  useEffect(() => {
    fetch(`${API}/auth/me`, requestOptions).then(r => r.json()).then(d => {
      if (d.user && ['admin', 'support', 'technician'].includes(d.user.role)) setUser(d.user);
    }).catch(() => {});
  }, []);
  useEffect(() => { if (user) loadTickets(); }, [user, loadTickets]);

  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/auth/login`, {
        ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      if (!['admin', 'support', 'technician'].includes(data.user?.role)) {
        await fetch(`${API}/auth/logout`, { ...requestOptions, method: 'POST' });
        throw new Error('This portal is for Support Team and Technician accounts. Ask an administrator to configure your staff role.');
      }
      setUser(data.user); setPassword('');
    } catch (err) { setError(err.message || 'Could not sign in'); }
    finally { setBusy(false); }
  }

  async function updateTicket(ticket, status) {
    setError(''); setNotice('');
    try {
      const response = await fetch(`${API}/staff/tickets/${ticket.id}`, {
        ...requestOptions, method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update ticket');
      setNotice(`Ticket ${displayTicketId(ticket.id)} updated to ${status}.`);
      await loadTickets();
    } catch (err) { setError(err.message || 'Could not update ticket'); }
  }

  async function signOut() {
    await fetch(`${API}/auth/logout`, { ...requestOptions, method: 'POST' }).catch(() => {});
    setUser(null); setTickets([]); setEmail(''); setPassword(''); setNotice(''); setError('');
  }

  const technician = user?.role === 'technician';
  const open = tickets.filter(t => t.status === 'Open').length;
  const progress = tickets.filter(t => t.status === 'In Progress').length;
  const resolved = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;

  if (!user) return <div className="staff-portal-page">
    <header className="user-portal-header">
      <a className="brand" href="/"><span className="brand-icon"><Ticket size={21}/></span><span><strong>DairyCare <span>360</span></strong><small>STAFF WORKSPACE</small></span></a>
      <div className="user-header-actions"><ThemeToggle /><a className="button secondary" href="/"><ArrowLeft size={15}/> Admin dashboard</a></div>
    </header>
    <main className="staff-login-wrap">
      <section className="staff-login-card">
        <div className="staff-icon"><ShieldCheck size={28}/></div>
        <p className="eyebrow">DAIRYCARE 360 · INTERNAL ACCESS</p>
        <h1>Staff sign in</h1>
        <p>Sign in to access your team's tickets and service workflow.</p>
        <form onSubmit={signIn} className="staff-login-form">
          <label className="field-label">Work email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@dairycare360.com"/></label>
          <label className="field-label">Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter your password"/></label>
          <button className="button primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'}</button>
        </form>
        {error && <p className="user-error"><AlertCircle size={15}/> {error}</p>}
        <p className="muted-note">Staff accounts must be created or assigned a role by an administrator. Customer accounts cannot access this workspace.</p>
      </section>
    </main>
  </div>;

  return <div className="staff-portal-page">
    <header className="user-portal-header">
      <a className="brand" href="/"><span className="brand-icon"><Ticket size={21}/></span><span><strong>DairyCare <span>360</span></strong><small>{technician ? 'TECHNICIAN PORTAL' : 'SUPPORT TEAM PORTAL'}</small></span></a>
      <div className="user-header-actions"><ThemeToggle /><span className="staff-user-chip">{user.name} · {user.role}</span><button className="button secondary" onClick={signOut}><LogOut size={15}/> Sign out</button></div>
    </header>
    <main className="staff-main">
      <div className="staff-welcome">
        <div><p className="eyebrow">{technician ? 'YOUR SERVICE WORKSPACE' : 'TEAM OPERATIONS'}</p><h1>{technician ? `Hello, ${user.name}` : 'Support operations'}</h1><p>{technician ? 'Review your assigned jobs and update repair progress.' : 'Review incoming issues, monitor priorities and keep tickets moving.'}</p></div>
        <button className="button secondary" onClick={loadTickets}><RefreshCw size={15}/> Refresh tickets</button>
      </div>
      {error && <div className="staff-alert error"><AlertCircle size={17}/>{error}</div>}
      {notice && <div className="staff-alert success"><CheckCircle2 size={17}/>{notice}</div>}
      <div className="staff-stat-grid">
        <article><span><Ticket size={18}/></span><small>{technician ? 'Assigned tickets' : 'Team tickets'}</small><strong>{tickets.length}</strong></article>
        <article><span><Clock3 size={18}/></span><small>Open</small><strong>{open}</strong></article>
        <article><span><Activity size={18}/></span><small>In progress</small><strong>{progress}</strong></article>
        <article><span><CheckCircle2 size={18}/></span><small>Resolved</small><strong>{resolved}</strong></article>
      </div>
      <section className="staff-ticket-panel">
        <div className="staff-panel-heading"><div><h2>{technician ? 'My assigned tickets' : 'All support tickets'}</h2><p>{technician ? 'Only tickets assigned to your staff name are shown.' : 'Manage requests and update their current status.'}</p></div><span>{tickets.length} tickets</span></div>
        {tickets.length ? <div className="staff-ticket-list">{tickets.map(ticket => <article className="staff-ticket" key={ticket.id}>
          <div className="staff-ticket-main"><div className="staff-ticket-title"><span>{displayTicketId(ticket.id)}</span><strong>{ticket.title}</strong></div><p>{ticket.description || 'No description provided.'}</p><div className="staff-ticket-meta"><span>{ticket.category}</span><span className={`priority-badge ${ticket.priority.toLowerCase()}`}><i/>{ticket.priority}</span><span className={`status-badge ${ticket.status.toLowerCase().replace(' ','-')}`}><i/>{ticket.status}</span><span>Assigned: {ticket.assignee || 'Unassigned'}</span></div></div>
          <label className="staff-status-field"><span>Update status</span><select value={ticket.status} onChange={e=>updateTicket(ticket,e.target.value)}><option>Open</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select></label>
        </article>)}</div> : <div className="staff-empty"><Users size={27}/><strong>No tickets to show</strong><p>{technician ? 'Ask the support team to assign a ticket using your staff name.' : 'Tickets created in DairyCare 360 will appear here.'}</p></div>}
      </section>
      <p className="staff-footnote"><Wrench size={14}/> {technician ? 'Update each ticket as you diagnose and repair the equipment.' : 'Coordinate assignments and confirm ticket progress with your technicians.'}</p>
    </main>
  </div>;
}
