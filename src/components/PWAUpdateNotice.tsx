import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import logoImg from '@/assets/logo.png';

const PWA_ICON_VERSION = 'so-resultados-logo-oficial-2026-07-17';
const STORAGE_KEY = 'pwa-icon-update-notice-dismissed-version';

export function PWAUpdateNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedVersion = window.localStorage.getItem(STORAGE_KEY);
    if (dismissedVersion !== PWA_ICON_VERSION) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, PWA_ICON_VERSION);
    setVisible(false);
  };

  if (!visible) return null;

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
            </div>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-300 sm:text-sm">
              Para atualizar o ícone oficial no Android, desktop ou celular, desinstale o app antigo e instale novamente pela página inicial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}