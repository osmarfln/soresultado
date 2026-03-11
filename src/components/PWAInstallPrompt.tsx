import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user dismissed recently
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS Safari (no beforeinstallprompt), show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // iOS - show instructions
      alert('Para instalar:\n1. Toque no botão de compartilhar (📤)\n2. Selecione "Adicionar à Tela de Início"');
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
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="bg-primary/20 rounded-lg p-2 shrink-0">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm text-foreground">
              Instale o Jogos Online
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse resultados direto da tela inicial, rápido e sem navegador!
            </p>
            <Button
              size="sm"
              onClick={handleInstall}
              className="mt-2 w-full gap-1.5 text-xs h-8"
            >
              <Download className="h-3.5 w-3.5" />
              Instalar App
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
