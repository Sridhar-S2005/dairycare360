import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'dairycare-theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const dark = theme === 'dark';
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
    >
      <Icon size={18} />
    </button>
  );
}
