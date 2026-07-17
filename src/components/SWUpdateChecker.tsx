import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h

export function SWUpdateChecker() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const wireRegistration = (reg: ServiceWorkerRegistration) => {
      const checkWaiting = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }
      };
      checkWaiting();

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });

      const runUpdate = () => {
        reg.update().catch(() => {});
      };

      intervalId = window.setInterval(runUpdate, CHECK_INTERVAL_MS);
      window.addEventListener('focus', runUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') runUpdate();
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;
      wireRegistration(reg);
    });

    // If a new SW takes control mid-session, offer reload.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      // Don't force reload; surface the banner instead.
      setUpdateReady(true);
    });

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  if (!updateReady) return null;

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[101] sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="relative overflow-hidden rounded-xl border border-emerald-400/40 bg-slate-950/95 p-3 shadow-[0_0_24px_rgba(16,185,129,0.18)] backdrop-blur">
        <button
          type="button"
          onClick={() => setUpdateReady(false)}
          className="absolute right-2 top-2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-lg bg-emerald-500/15 p-2">
            <RefreshCw className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-wider text-emerald-300">
              Atualização disponível
            </p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-300">
              Uma nova versão do app foi baixada. Recarregue para aplicar.
            </p>
            <button
              type="button"
              onClick={handleReload}
              className="mt-2 w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Recarregar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
