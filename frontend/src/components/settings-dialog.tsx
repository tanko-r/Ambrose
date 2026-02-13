"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  usePreferences,
  type ThemePreference,
  type SidebarTab,
} from "@/hooks/use-preferences";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
];

const SIDEBAR_TAB_OPTIONS: { value: SidebarTab; label: string }[] = [
  { value: "risks", label: "Risks" },
  { value: "related", label: "Related Clauses" },
  { value: "definitions", label: "Definitions" },
  { value: "flags", label: "Flags" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    preferences,
    loaded,
    setThemePreference,
    setCompactMode,
    setDefaultSidebarTab,
    setNavPanelVisibleDefault,
  } = usePreferences();

  if (!loaded) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your workspace appearance and behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Theme */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-1 rounded-md border p-1">
              {THEME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={preferences.theme === opt.value ? "default" : "ghost"}
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setThemePreference(opt.value)}
                >
                  {opt.icon}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Compact Mode</label>
              <p className="text-xs text-muted-foreground">
                Reduce spacing between cards and panels
              </p>
            </div>
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>

          <Separator />

          {/* Default Sidebar Tab */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Sidebar Tab</label>
            <p className="text-xs text-muted-foreground">
              Tab shown when selecting a paragraph
            </p>
            <Select
              value={preferences.defaultSidebarTab}
              onValueChange={(v) => setDefaultSidebarTab(v as SidebarTab)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIDEBAR_TAB_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Navigator Panel Default */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Navigator Panel</label>
              <p className="text-xs text-muted-foreground">
                Show document navigator by default on session load
              </p>
            </div>
            <Switch
              checked={preferences.navPanelVisibleDefault}
              onCheckedChange={setNavPanelVisibleDefault}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
