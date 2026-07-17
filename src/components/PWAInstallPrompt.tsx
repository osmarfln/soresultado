import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user dismissed recently
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 24 * 60 * 60 * 1000) return;

    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isiOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Always show the banner after 3 seconds as fallback
    // (beforeinstallprompt may not fire in iframes, iOS, or Firefox)
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // Can't auto-install on iOS
    } else {
      // Keep installation on the same origin so the browser reads this app's manifest and official icons.
      window.location.href = window.location.origin;
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-fade-in-up sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-card border border-primary/30 rounded-xl p-4 shadow-lg shadow-primary/10 backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="bg-primary/20 rounded-lg p-1.5 shrink-0">
            <img src={logoImg} alt="Só Resultados" className="h-9 w-9 rounded-md object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm text-foreground">
              📲 Instale nosso App!
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tenha os resultados do Jogo do Bicho direto na tela inicial do seu celular. Rápido e sem abrir o navegador!
            </p>

            {isIOS ? (
              <div className="mt-2 p-2 bg-secondary/50 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Share className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>
                    Toque em <strong className="text-foreground">Compartilhar</strong> (📤) e depois em <strong className="text-foreground">"Adicionar à Tela de Início"</strong>
                  </span>
                </p>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleInstall}
                className="mt-2 w-full gap-1.5 text-xs h-9"
              >
                <Download className="h-3.5 w-3.5" />
                {deferredPrompt ? 'Instalar App Agora' : 'Abrir para Instalar'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
