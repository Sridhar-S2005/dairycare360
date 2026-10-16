import React, { useCallback, useEffect, useState } from 'react';

function displayTicketId(id) { return `AKC10${String(id).padStart(2, '0').slice(-2)}`; }
import { Ticket, Plus, RefreshCw, LogOut, ArrowLeft } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

const API = `${(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '')}/api`;
const emptyForm = { title: '', description: '', category: 'General', priority: 'Medium' };
const requestOptions = { credentials: 'include' };

export default function UserPortal() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      const r = await fetch(`${API}/my/tickets`, requestOptions);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unable to load tickets');
      setTickets(data);
      setError('');
    } catch (e) { setError(e.message || 'Could not connect to server'); }
  }, []);

  useEffect(() => {
    fetch(`${API}/auth/me`, requestOptions).then(r => r.json()).then(d => {
      if (d.user?.role === 'user') { setUser(d.user); }
    }).catch(() => {});
  }, []);
  useEffect(() => { if (user) loadTickets(); }, [user, loadTickets]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const payload = mode === 'register' ? { name, email, password } : { email, password };
      const r = await fetch(`${API}/auth/${endpoint}`, { ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Authentication failed');
      setUser(d.user); setPassword(''); setNotice(mode === 'register' ? 'Account created successfully.' : 'Welcome back.');
    } catch (e) { setError(e.message || 'Could not sign in'); }
    finally { setBusy(false); }
  }

  async function submitTicket(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/my/tickets`, { ...requestOptions, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not create ticket');
      setForm(emptyForm); setShowForm(false); setNotice(`Ticket #${d.id} created successfully.`); await loadTickets();
    } catch (e) { setError(e.message || 'Could not create ticket'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch(`${API}/auth/logout`, { ...requestOptions, method: 'POST' }).catch(() => {});
    setUser(null); setTickets([]); setEmail(''); setPassword(''); setError(''); setNotice('');
  }

  const dateText = value => value ? new Date(value.replace(' ', 'T')).toLocaleDateString() : 'Just now';
  const fieldStyle = { width: '100%', padding: '12px', border: '1px solid #dce1ed', borderRadius: 8, marginTop: 6, boxSizing: 'border-box', font: 'inherit' };
  return <div className="user-portal-shell">
    <header className="user-portal-header">
      <a className="brand" href="/"><span className="brand-icon"><Ticket size={21}/></span><span><strong>DairyCare <span>360</span></strong><small>SUPPORT PORTAL</small></span></a>
      <div className="user-header-actions"><ThemeToggle /><a className="button secondary" href="/"><ArrowLeft size={15}/> Admin portal</a>{user && <button className="button secondary" onClick={signOut}><LogOut size={15}/> Sign out</button>}</div>
    </header>
    <main className="user-portal-main">
      {!user ? <section className="user-connect-card" style={{maxWidth:460, margin:'40px auto'}}>
        <div className="user-hero-icon"><Ticket size={27}/></div>
        <p className="eyebrow">DAIRYCARE 360 SUPPORT</p><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p>{mode === 'login' ? 'Log in to track your support requests.' : 'Register to submit and track support tickets.'}</p>
        <form onSubmit={submitAuth} style={{display:'grid', gap:14, textAlign:'left'}}>
          {mode === 'register' && <label className="field-label">Full name<input style={fieldStyle} value={name} onChange={e=>setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Your name"/></label>}
          <label className="field-label">Email address<input style={fieldStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com"/></label>
          <label className="field-label">Password<input style={fieldStyle} type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters"/></label>
          <button className="button primary" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p style={{marginTop:18}}>{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button className="button secondary" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'Create account':'Log in'}</button></p>
        {error && <p className="user-error">{error}</p>}
        <p className="muted-note">Passwords are hashed before being stored in MySQL.</p>
      </section> : <>
        <div className="user-welcome-row"><div><p className="eyebrow">YOUR SUPPORT WORKSPACE</p><h1>Hello, {user.name}</h1><p>Track your support requests and see the latest status.</p></div><div style={{display:'flex',gap:8}}><button className="button secondary" onClick={loadTickets}><RefreshCw size={15}/> Refresh</button><button className="button primary" onClick={()=>setShowForm(!showForm)}><Plus size={16}/> New ticket</button></div></div>
        {notice && <p className="user-notice">{notice}</p>}{error && <p className="user-error">{error}</p>}
        {showForm && <form className="ticket-modal" style={{position:'relative',marginBottom:24}} onSubmit={submitTicket}>
          <h2>Create a support ticket</h2>
          <label className="field-label">Title<input style={fieldStyle} required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
          <label className="field-label">Description<textarea style={fieldStyle} rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
          <div className="form-grid">
            <label className="field-label">Category<select style={fieldStyle} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['General','Network','Hardware','Software','Access','Email','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="field-label">Priority<select style={fieldStyle} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['Low','Medium','High','Critical'].map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}><button className="button primary" disabled={busy}>Submit ticket</button><button className="button secondary" type="button" onClick={()=>setShowForm(false)}>Cancel</button></div>
        </form>}
        <section className="tickets-panel"><div className="panel-heading"><div><h2>My tickets <span className="count-pill">{tickets.length}</span></h2><p>Tickets submitted from your account.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>Ticket</th><th>Raised by</th><th>Status</th><th>Priority</th><th>Created</th></tr></thead><tbody>
            {tickets.length===0 ? <tr><td colSpan="6" className="empty-state">{error ? 'Unable to load tickets.' : 'No tickets yet. Create your first ticket.'}</td></tr> : tickets.map(t=><tr key={t.id}><td>#{t.id}</td><td><b>{t.title}</b><div className="ticket-subtitle">{t.category} · {t.description || 'No description'}</div></td><td>{t.requester_name || user.name}</td><td><span className={`status-badge ${t.status.toLowerCase().replace(' ','-')}`}>{t.status}</span></td><td><span className={`priority-badge ${t.priority.toLowerCase()}`}>{t.priority}</span></td><td>{dateText(t.created_at)}</td></tr>)}
          </tbody></table></div>
        </section>
      </>}
    </main>
  </div>;
}
