import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Kill any stale service worker + caches left over from a previous PWA install.
// In dev we want the live code every load, never a cached app shell — this is
// what was serving old JS to the phone ("no changes" after edits).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    let had = false;
    regs.forEach(r => { r.unregister(); had = true; });
    if (had && window.caches) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      // One reload to drop the now-unregistered SW's cached page.
      setTimeout(() => window.location.reload(), 300);
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
