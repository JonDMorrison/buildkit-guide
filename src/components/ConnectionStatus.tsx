import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Keep banner briefly to show reconnection, then dismiss
      setTimeout(() => setShowBanner(false), 2000);
    };
    const goOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Show banner immediately if offline on mount
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300",
        isOnline
          ? "bg-status-complete text-status-complete-foreground animate-fade-out"
          : "bg-status-warning text-status-warning-foreground animate-slide-up"
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        "Back online"
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          You're offline. Changes will sync when connected.
        </>
      )}
    </div>
  );
};

