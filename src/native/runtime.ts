import { App } from '@capacitor/app';
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';
import { isNative, PENDING_ACTION } from './is-native';

/** Runs on every page of the Android build: back button, deep links, notification taps. */
const LAUNCH_HANDLED = 'dayline.launchHandled';
const ROUTES: Record<string, string> = { speak: '/speak', dose: '/log/dose', 'help-now': '/help-now' };

declare global {
  interface Window {
    __daylineReminderAction?: (action: { actionId: string; extra: unknown }) => void;
  }
}

function appPath(): string {
  const root = document.documentElement;
  return `${root.dataset.base ?? '/'}${root.lang === 'bn' ? 'bn/' : ''}app/`;
}

const inApp = () => location.pathname === appPath();

function open(route: string) {
  if (inApp()) location.hash = `#${route}`;
  else location.href = `${appPath()}#${route}`;
}

function openUrl(url: string | undefined) {
  if (!url) return;
  try {
    const u = new URL(url);
    const route = u.protocol === 'dayline:' ? ROUTES[u.hostname] : undefined;
    if (route) open(route);
  } catch {
    /* not a link we know */
  }
}

function onBack({ canGoBack }: { canGoBack: boolean }) {
  if (document.querySelector('[role="dialog"]')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }
  const route = location.hash.replace(/^#/, '').split('?')[0] || '/today';
  if (inApp() && (route === '/today' || route === '/')) void App.exitApp();
  else if (canGoBack) history.back();
  else open('/today');
}

function onReminder({ actionId, notification }: ActionPerformed) {
  const action = { actionId, extra: notification.extra };
  if (inApp() && window.__daylineReminderAction) {
    window.__daylineReminderAction(action);
    return;
  }
  try {
    sessionStorage.setItem(PENDING_ACTION, JSON.stringify(action));
  } catch {
    /* storage unavailable: the app still opens */
  }
  if (!inApp()) location.href = appPath();
}

if (isNative()) {
  void App.addListener('backButton', onBack);
  void App.addListener('appUrlOpen', ({ url }) => openUrl(url));
  void LocalNotifications.addListener('localNotificationActionPerformed', onReminder);
  void App.getLaunchUrl().then((launch) => {
    try {
      if (!launch?.url || sessionStorage.getItem(LAUNCH_HANDLED)) return;
      sessionStorage.setItem(LAUNCH_HANDLED, '1');
    } catch {
      /* storage unavailable: treat this as the first load */
    }
    openUrl(launch?.url);
  });
}
