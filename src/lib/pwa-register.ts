// Register the service worker that precaches the site, so it works offline after the first visit.
// New versions take over on their own (skipWaiting + clientsClaim in the generated worker).
const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

// The Android app ships its files in the APK; a service worker could serve stale ones after an update.
if (import.meta.env.PUBLIC_NATIVE !== '1' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  const register = () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* offline support unavailable in this browser; the site still works online */
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

// Android app: back button, deep links and notification taps, on every page.
if (import.meta.env.PUBLIC_NATIVE === '1') void import('../native/runtime');
