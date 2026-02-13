"use client";

import { useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  PanelLeft,
  PanelRight,
  ChevronDown,
  ChevronUp,
  Flag,
  Pencil,
  FileDown,
  Mail,
  Columns2,
  Settings,
  Keyboard,
  LayoutList,
  PanelBottom,
} from "lucide-react";

// Detect platform for modifier key display
function useModKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  return navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl";
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 text-xs font-mono border rounded bg-muted text-muted-foreground">
      {children}
    </kbd>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const mod = useModKey();
  const modSymbol = mod === "Cmd" ? "\u2318" : "Ctrl";

  const store = useAppStore();

  const runAction = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  // Navigation group actions
  const navigationItems = useMemo(
    () => [
      {
        id: "toggle-nav",
        label: "Toggle Navigator Panel",
        icon: PanelLeft,
        shortcut: "[",
        action: () => useAppStore.getState().toggleNavPanel(),
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        icon: PanelRight,
        shortcut: "]",
        action: () => useAppStore.getState().toggleSidebar(),
      },
      {
        id: "next-risk",
        label: "Next Risk",
        icon: ChevronDown,
        shortcut: "J",
        action: () => {
          // Dispatch to let the hook handle it
          window.dispatchEvent(new CustomEvent("keyboard:next-risk"));
        },
      },
      {
        id: "prev-risk",
        label: "Previous Risk",
        icon: ChevronUp,
        shortcut: "K",
        action: () => {
          window.dispatchEvent(new CustomEvent("keyboard:prev-risk"));
        },
      },
      {
        id: "toggle-revision-sheet",
        label: "Toggle Revision Sheet",
        icon: PanelBottom,
        shortcut: `${modSymbol}+\\`,
        action: () => useAppStore.getState().toggleBottomSheet(),
      },
    ],
    [modSymbol]
  );

  const actionItems = useMemo(
    () => [
      {
        id: "flag-clause",
        label: "Flag Current Clause",
        icon: Flag,
        shortcut: "F",
        action: () => {
          const paraId = useAppStore.getState().selectedParaId;
          if (paraId) {
            window.dispatchEvent(
              new CustomEvent("keyboard:flag", { detail: { paraId } })
            );
          }
        },
        disabled: !store.selectedParaId,
      },
      {
        id: "generate-revision",
        label: "Generate Revision",
        icon: Pencil,
        shortcut: "G",
        action: () => {
          const s = useAppStore.getState();
          if (s.selectedParaId) {
            s.setRevisionSheetParaId(s.selectedParaId);
            if (!s.bottomSheetOpen) s.toggleBottomSheet();
          }
        },
        disabled: !store.selectedParaId,
      },
      {
        id: "finalize-redline",
        label: "Finalize Redline",
        icon: FileDown,
        shortcut: undefined,
        action: () => {
          window.dispatchEvent(new CustomEvent("command:finalize"));
        },
      },
      {
        id: "generate-transmittal",
        label: "Generate Transmittal",
        icon: Mail,
        shortcut: undefined,
        action: () => {
          window.dispatchEvent(new CustomEvent("command:transmittal"));
        },
      },
    ],
    [store.selectedParaId]
  );

  const viewItems = useMemo(
    () => [
      {
        id: "toggle-compact",
        label: "Toggle Compact Mode",
        icon: LayoutList,
        shortcut: undefined,
        action: () => useAppStore.getState().toggleCompactMode(),
      },
      {
        id: "toggle-precedent",
        label: "Toggle Precedent Panel",
        icon: Columns2,
        shortcut: undefined,
        action: () => useAppStore.getState().togglePrecedentPanel(),
      },
      {
        id: "open-settings",
        label: "Open Settings",
        icon: Settings,
        shortcut: `${modSymbol}+,`,
        action: () => {
          // Settings not yet implemented - placeholder
        },
      },
    ],
    [modSymbol]
  );

  const helpItems = useMemo(
    () => [
      {
        id: "keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        icon: Keyboard,
        shortcut: "?",
        action: () => {
          // Close palette, then fire help dialog
          // We dispatch an event since onOpenChange(false) must happen first
          window.dispatchEvent(new CustomEvent("command:open-help"));
        },
      },
    ],
    []
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search for a command to run..."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runAction(item.action)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem
              key={item.id}
              disabled={item.disabled}
              onSelect={() => runAction(item.action)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          {viewItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runAction(item.action)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          {helpItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runAction(item.action)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
