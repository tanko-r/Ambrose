"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Detect platform for modifier key display
function useModKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  return navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl";
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-xs font-mono border rounded bg-muted text-muted-foreground">
      {children}
    </kbd>
  );
}

interface ShortcutRowProps {
  label: string;
  keys: React.ReactNode;
}

function ShortcutRow({ label, keys }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-1">{keys}</div>
    </div>
  );
}

function ShortcutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

interface KeyboardHelpProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function KeyboardHelp({ open, onOpenChange }: KeyboardHelpProps) {
  const mod = useModKey();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick access keys for navigating and reviewing contracts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          <ShortcutSection title="Navigation">
            <ShortcutRow
              label="Toggle Navigator Panel"
              keys={<Kbd>[</Kbd>}
            />
            <ShortcutRow
              label="Toggle Sidebar"
              keys={<Kbd>]</Kbd>}
            />
            <ShortcutRow
              label="Next Risk"
              keys={<Kbd>J</Kbd>}
            />
            <ShortcutRow
              label="Previous Risk"
              keys={<Kbd>K</Kbd>}
            />
            <ShortcutRow
              label="Close / Dismiss"
              keys={<Kbd>Esc</Kbd>}
            />
          </ShortcutSection>

          <ShortcutSection title="Actions">
            <ShortcutRow
              label="Flag Current Clause"
              keys={<Kbd>F</Kbd>}
            />
            <ShortcutRow
              label="Generate Revision"
              keys={<Kbd>G</Kbd>}
            />
            <ShortcutRow
              label="Toggle Revision Sheet"
              keys={
                <>
                  <Kbd>{mod}</Kbd>
                  <span className="text-xs text-muted-foreground">+</span>
                  <Kbd>\</Kbd>
                </>
              }
            />
            <ShortcutRow
              label="Command Palette"
              keys={
                <>
                  <Kbd>{mod}</Kbd>
                  <span className="text-xs text-muted-foreground">+</span>
                  <Kbd>K</Kbd>
                </>
              }
            />
          </ShortcutSection>

          <ShortcutSection title="Settings">
            <ShortcutRow
              label="Keyboard Shortcuts"
              keys={<Kbd>?</Kbd>}
            />
            <ShortcutRow
              label="Open Settings"
              keys={
                <>
                  <Kbd>{mod}</Kbd>
                  <span className="text-xs text-muted-foreground">+</span>
                  <Kbd>,</Kbd>
                </>
              }
            />
          </ShortcutSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
