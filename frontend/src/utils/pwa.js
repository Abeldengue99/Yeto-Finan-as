export function getInstallPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  return { isIos, isStandalone };
}

export function activateWaitingServiceWorker(registration) {
  if (!registration?.waiting) return;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker({ onNeedRefresh } = {}) {
  if (!('serviceWorker' in navigator)) return undefined;

  if (import.meta.env.DEV) {
    window.addEventListener('load', async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(key => key.startsWith('yeto-')).map(key => caches.delete(key)));
        }
      } catch (error) {
        console.warn('Nao foi possivel limpar o cache local do aplicativo.', error);
      }
    });

    return undefined;
  }

  let refreshing = false;

  const handleControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (registration.waiting && navigator.serviceWorker.controller) {
        onNeedRefresh?.(registration);
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            onNeedRefresh?.(registration);
          }
        });
      });

      setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (error) {
      console.warn('Nao foi possivel ativar o modo aplicativo.', error);
    }
  });

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  };
}
