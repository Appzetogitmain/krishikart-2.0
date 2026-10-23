import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary, { isChunkError, reloadForNewVersion } from './components/AppErrorBoundary.jsx'

// A page's code from an older deploy is gone: reload once to get the new version instead of crashing
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkError(event.reason)) reloadForNewVersion();
});

// Global handler to prevent number input changes on scroll
document.addEventListener('wheel', (event) => {
  if (document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
