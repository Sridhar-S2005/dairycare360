import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import UserPortal from './UserPortal.jsx';
import StaffPortal from './StaffPortal.jsx';
import './style.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Could not find #root in index.html');
}

const currentPath = window.location.pathname.replace(/\/$/, '');
const isUserPortal = currentPath === '/portal';
const isStaffPortal = currentPath === '/staff';

createRoot(root).render(
  <React.StrictMode>
    {isUserPortal ? <UserPortal /> : isStaffPortal ? <StaffPortal /> : <App />}
  </React.StrictMode>
);
