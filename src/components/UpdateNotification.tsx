import { useEffect, useState } from 'react';
import { Download, RefreshCw, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'up-to-date'; version: string }
  | { status: 'error'; message: string };

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  // Check if running inside Electron
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    const api = (window as any).electronAPI;

    api.onUpdateAvailable((info: { version: string }) => {
      setDismissed(false);
      setUpdate({ status: 'available', version: info.version });
    });

    api.onDownloadProgress((progress: { percent: number }) => {
      setUpdate({ status: 'downloading', percent: progress.percent });
    });

    api.onUpdateDownloaded((info: { version: string }) => {
      setUpdate({ status: 'downloaded', version: info.version });
    });

    api.onUpdateNotAvailable((info: { version: string }) => {
      setUpdate({ status: 'up-to-date', version: info.version });
      // Auto-hide "up to date" notice after 4 seconds
      setTimeout(() => setUpdate({ status: 'idle' }), 4000);
    });

    api.onUpdateError((err: { message: string }) => {
      setUpdate({ status: 'error', message: err.message });
    });

    return () => {
      api.removeAllUpdateListeners?.();
    };
  }, [isElectron]);

  const handleCheckNow = () => {
    if (!isElectron) return;
    setUpdate({ status: 'checking' });
    setDismissed(false);
    (window as any).electronAPI.checkForUpdates();
  };

  const handleInstall = () => {
    (window as any).electronAPI.installUpdate();
  };

  if (!isElectron) return null;
  if (dismissed) return null;
  if (update.status === 'idle') return null;

  // ── Banner styles by state ─────────────────────────────────────────────
  const bannerConfig: Record<string, { bg: string; border: string; icon: React.ReactNode; text: string; actions?: React.ReactNode }> = {
    checking: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
      text: 'Checking for updates…',
    },
    available: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <Download className="w-4 h-4 text-amber-500" />,
      text: `Update v${(update as any).version} available — downloading in background…`,
    },
    downloading: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
      text: `Downloading update… ${(update as any).percent}%`,
      actions: (
        <div className="w-32 bg-blue-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(update as any).percent}%` }}
          />
        </div>
      ),
    },
    downloaded: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      text: `v${(update as any).version} ready to install.`,
      actions: (
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Restart & Install
        </button>
      ),
    },
    'up-to-date': {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <CheckCircle className="w-4 h-4 text-green-500" />,
      text: `You're up to date (v${(update as any).version}).`,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      text: `Update check failed: ${(update as any).message}`,
      actions: (
        <button
          onClick={handleCheckNow}
          className="text-xs text-red-600 underline hover:no-underline"
        >
          Retry
        </button>
      ),
    },
  };

  const cfg = bannerConfig[update.status];
  if (!cfg) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md text-sm max-w-sm ${cfg.bg} ${cfg.border}`}
    >
      {cfg.icon}
      <span className="flex-1 text-gray-700 font-medium">{cfg.text}</span>
      {cfg.actions}
      {/* Don't show dismiss on "downloading" — let it finish */}
      {update.status !== 'downloading' && (
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 ml-1"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Hook for "Check for updates" button in Settings ─────────────────────────
export function useManualUpdateCheck() {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const check = () => {
    if (isElectron) (window as any).electronAPI.checkForUpdates();
  };
  return { check, isElectron };
}
