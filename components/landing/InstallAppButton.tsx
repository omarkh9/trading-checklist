"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallAppButtonProps = {
  className?: string;
  label?: string;
};

export function InstallAppButton({
  className,
  label = "Install App",
}: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(
        (navigator as Navigator & { standalone?: boolean }).standalone
      );
    if (standalone) {
      setInstalled(true);
      return;
    }

    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setHint(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return null;
  }

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    if (ios) {
      setHint("On iPhone, tap Share, then Add to Home Screen.");
      return;
    }

    setHint(
      "Use your browser menu to install Edge Log, or look for the install icon in the address bar."
    );
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-start">
      <button type="button" onClick={() => void handleClick()} className={className}>
        {ios && !deferredPrompt ? (
          <Share className="h-4 w-4" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {label}
      </button>
      {hint && (
        <p className="max-w-xs text-left text-xs leading-relaxed text-zinc-500">
          {hint}
        </p>
      )}
    </div>
  );
}
