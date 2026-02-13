"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_WIDTH = 1280;

export function SmallScreenWarning() {
  const [isSmall, setIsSmall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function check() {
      setIsSmall(window.innerWidth < MIN_WIDTH);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isSmall || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="false"
      aria-label="Small screen warning"
    >
      <div className="mx-4 max-w-md rounded-xl border bg-card p-8 shadow-2xl text-center">
        <Monitor className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">Desktop Browser Required</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          This application requires a desktop browser with a minimum width of
          1280px for the best experience. Please resize your window or switch to
          a desktop device.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-6"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss small screen warning"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
