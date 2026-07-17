import { useEffect, useState } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import logoImg from '@/assets/logo.png';

const STORAGE_DISMISSED_KEY = 'pwa-icon-update-notice-dismissed-version';
const STORAGE_INSTALLED_VERSION_KEY = 'pwa-installed-version';
const VERSION_URL = '/pwa-version.json';

type VersionInfo = {
  version: string;
  releasedAt?: string;
  notes?: string;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  // iOS Safari uses navigator.standalone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(mql?.matches) || iosStandalone;
}

export function PWAUpdateNotice() {
  const [visible, setVisible] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        setChecking(true);
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        if (cancelled || !data?.version) return;

        setRemoteVersion(data);

        const installed = window.localStorage.getItem(STORAGE_INSTALLED_VERSION_KEY);
        const dismissed = window.localStorage.getItem(STORAGE_DISMISSED_KEY);
        const standalone = isStandalone();

        // First time seeing this browser: record current version, don't nag.
        if (!installed) {
          window.localStorage.setItem(STORAGE_INSTALLED_VERSION_KEY, data.version);
          return;
        }

        // New version detected AND user hasn't dismissed it for this version.
        if (installed !== data.version && dismissed !== data.version) {
          // Only show to installed PWA users — reinstall advice is only relevant there.
          if (standalone) setVisible(true);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    check();
    // Re-check when the tab regains focus
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleDismiss = () => {
    if (remoteVersion) {
      window.localStorage.setItem(STORAGE_DISMISSED_KEY, remoteVersion.version);
    }
    setVisible(false);
  };

  if (!visible || !remoteVersion) return null;

  return (
    <div className="container mx-auto px-4 pt-3">
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3 shadow-[0_0_24px_rgba(251,191,36,0.14)]">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950/80 ring-1 ring-amber-400/25">
            <img src={logoImg} alt="Ícone oficial Só Resultados" className="h-10 w-10 object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-black uppercase tracking-wider text-amber-300">
                Nova versão do app disponível
              </p>
              {checking && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
            </div>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-300 sm:text-sm">
              Versão detectada: <span className="text-amber-200">{remoteVersion.version}</span>
              {remoteVersion.releasedAt ? ` · ${remoteVersion.releasedAt}` : ''}. Para atualizar o ícone oficial, desinstale o app antigo e instale novamente pela página inicial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
