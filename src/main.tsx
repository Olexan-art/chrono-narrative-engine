import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recover from stale JS chunk 404s (dynamic import fails with wrong MIME type
// after a new Netlify deploy where chunk hashes changed).
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (
    typeof msg === 'string' &&
    (msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch dynamically') ||
      msg.includes('error loading dynamically'))
  ) {
    // Only reload once to avoid infinite reload loops
    const lastReload = Number(sessionStorage.getItem('chunkReloadAt') || '0');
    if (Date.now() - lastReload > 10_000) {
      sessionStorage.setItem('chunkReloadAt', String(Date.now()));
      window.location.reload();
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
