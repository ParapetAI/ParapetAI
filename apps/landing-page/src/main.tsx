import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

function applyThemeFromPreference() {
  try {
    const stored = window.localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);

    // Update theme-color meta to match current background
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    const bgHsl = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    meta.setAttribute('content', `hsl(${bgHsl})`);

    // If no stored preference, track system changes
    if (!stored && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        const metaEl = document.querySelector('meta[name="theme-color"]');
        if (metaEl) {
          const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
          metaEl.setAttribute('content', `hsl(${bg})`);
        }
      };
      mql.addEventListener('change', handler);
    }
  } catch {
    // ignore
  }
}

applyThemeFromPreference();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


