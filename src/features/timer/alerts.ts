/**
 * Ways of telling someone their countdown finished when they are not looking
 * at the tab. All of these are best effort: browsers may block any of them.
 */

/** Asks for notification permission. Must be called from a click handler. */
export function requestNotificationPermission(): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  void Notification.requestPermission().catch(() => {});
}

export async function notify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    // Android only allows notifications through the service worker.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, { body, icon: './icon-192.png' });
    else new Notification(title, { body, icon: './icon-192.png' });
  } catch {
    // Not supported here; the toast and chime still happen.
  }
}

/** Two short rising tones. */
export function playChime(): void {
  try {
    const context = new AudioContext();
    const tone = (frequency: number, startsAt: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.2, startsAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.5);
    };
    tone(660, context.currentTime);
    tone(880, context.currentTime + 0.25);
    window.setTimeout(() => void context.close(), 1500);
  } catch {
    // Audio is unavailable or blocked until the user interacts with the page.
  }
}
