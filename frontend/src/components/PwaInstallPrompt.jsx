import { useEffect, useMemo, useState } from 'react';
import { activateWaitingServiceWorker, getInstallPlatform, registerServiceWorker } from '../utils/pwa';

const INSTALL_DISMISS_KEY = 'yeto_pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PwaInstallPrompt() {
  const platform = useMemo(() => getInstallPlatform(), []);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const [isInstalled, setIsInstalled] = useState(platform.isStandalone);

  useEffect(() => {
    const unregister = registerServiceWorker({
      onNeedRefresh: registration => setUpdateRegistration(registration)
    });

    const handleBeforeInstallPrompt = event => {
      event.preventDefault();
      setDeferredPrompt(event);
      if (!wasRecentlyDismissed()) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (platform.isIos && !platform.isStandalone && !wasRecentlyDismissed()) {
      setShowInstallPrompt(true);
    }

    return () => {
      unregister?.();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platform.isIos, platform.isStandalone]);

  const dismissInstallPrompt = () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setShowInstallPrompt(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
  };

  return (
    <>
      {updateRegistration && (
        <div className="pwa-banner pwa-banner-update" role="status">
          <div>
            <strong>Nova versão disponível</strong>
            <span>Atualize para receber as melhorias mais recentes do Yeto.</span>
          </div>
          <button type="button" onClick={() => activateWaitingServiceWorker(updateRegistration)}>
            Atualizar
          </button>
        </div>
      )}

      {showInstallPrompt && !isInstalled && (
        <div className="pwa-banner pwa-banner-install" role="dialog" aria-label="Instalar Yeto">
          <div>
            <strong>Instalar Yeto no telefone</strong>
            {platform.isIos && !deferredPrompt ? (
              <span>No iPhone, toque em Partilhar e escolha Adicionar ao Ecrã Principal.</span>
            ) : (
              <span>Aceda ao Yeto como aplicativo, direto no ecrã principal.</span>
            )}
          </div>
          <div className="pwa-banner-actions">
            {deferredPrompt && (
              <button type="button" onClick={handleInstall}>
                Instalar
              </button>
            )}
            <button type="button" className="pwa-banner-secondary" onClick={dismissInstallPrompt}>
              Depois
            </button>
          </div>
        </div>
      )}
    </>
  );
}
