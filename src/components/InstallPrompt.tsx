import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo.png';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'sr_install_dismissed_at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-ignore iOS
    window.navigator.standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS não dispara beforeinstallprompt — mostrar dica manual
    if (isIOS()) {
      const t = setTimeout(() => {
        setIosHint(true);
        setOpen(true);
      }, 1500);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBIP);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1rem)] max-w-md">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl shadow-2xl p-4 flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
        <img src={logoImg} alt="Só Resultados" className="h-12 w-12 rounded-xl shrink-0 shadow-lg" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Instale o Só Resultados</p>
          {iosHint ? (
            <p className="text-xs text-slate-300 mt-1 leading-snug">
              Toque em <Share className="inline h-3.5 w-3.5 mx-0.5 text-blue-400" /> <b>Compartilhar</b> e depois em <b>“Adicionar à Tela de Início”</b>.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1 leading-snug">
              Acesso rápido pelo ícone no celular, sem abrir o navegador.
            </p>
          )}
          {!iosHint && (
            <Button
              onClick={handleInstall}
              size="sm"
              className="mt-2 h-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Instalar agora
            </Button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="text-slate-500 hover:text-white transition-colors p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
