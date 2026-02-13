"use client";

import { useAppStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Plus,
  User,
  FolderOpen,
  Settings,
  HelpCircle,
  UserCircle,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface HeaderProps {
  onNewProject?: () => void;
}

export function Header({ onNewProject }: HeaderProps) {
  const { targetFilename, view } = useAppStore();

  const handleNewProject = () => {
    if (onNewProject) {
      onNewProject();
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 z-40">
      {/* Left: menu + title */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleNewProject}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Document Library
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <h1 className="text-sm font-semibold tracking-tight">
          Contract Review
        </h1>
      </div>

      {/* Center: document filename (only in review view) */}
      {view === "review" && targetFilename && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="max-w-xs truncate text-sm text-muted-foreground">
            {targetFilename}
          </span>
        </div>
      )}

      {/* Right: new button + user menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleNewProject}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4" />
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast.info("Coming soon")}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
