"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useAppStore } from "@/lib/store";
import { useCallback, useMemo } from "react";

interface KeyboardShortcutCallbacks {
  openCommandPalette: () => void;
  openHelpDialog: () => void;
  openSettings?: () => void;
}

export function useKeyboardShortcuts({
  openCommandPalette,
  openHelpDialog,
  openSettings,
}: KeyboardShortcutCallbacks) {
  // ---- Store selectors (stable references) ----
  const risks = useAppStore((s) => s.risks);
  const paragraphs = useAppStore((s) => s.paragraphs);
  const selectedParaId = useAppStore((s) => s.selectedParaId);
  const bottomSheetOpen = useAppStore((s) => s.bottomSheetOpen);

  // Build sorted list of paragraph IDs that have risks
  const riskParaIds = useMemo(() => {
    const riskIds = new Set(risks.map((r) => r.para_id));
    return paragraphs
      .filter((p) => p.type === "paragraph" && riskIds.has(p.id))
      .map((p) => p.id);
  }, [risks, paragraphs]);

  // Navigation helpers
  const goNext = useCallback(() => {
    if (riskParaIds.length === 0) return;
    const currentIdx = selectedParaId
      ? riskParaIds.indexOf(selectedParaId)
      : -1;
    const nextIdx =
      currentIdx >= riskParaIds.length - 1 ? 0 : currentIdx + 1;
    useAppStore.getState().selectParagraph(riskParaIds[nextIdx]);
  }, [riskParaIds, selectedParaId]);

  const goPrev = useCallback(() => {
    if (riskParaIds.length === 0) return;
    const currentIdx = selectedParaId
      ? riskParaIds.indexOf(selectedParaId)
      : -1;
    const prevIdx =
      currentIdx <= 0 ? riskParaIds.length - 1 : currentIdx - 1;
    useAppStore.getState().selectParagraph(riskParaIds[prevIdx]);
  }, [riskParaIds, selectedParaId]);

  // --- Modifier shortcuts (safe in form fields by default) ---

  // Cmd/Ctrl+K: Open command palette
  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      openCommandPalette();
    },
    { preventDefault: true }
  );

  // Cmd/Ctrl+,: Open settings
  useHotkeys(
    "mod+comma",
    (e) => {
      e.preventDefault();
      openSettings?.();
    },
    { preventDefault: true }
  );

  // Cmd/Ctrl+\: Toggle revision bottom sheet
  useHotkeys(
    "mod+backslash",
    (e) => {
      e.preventDefault();
      useAppStore.getState().toggleBottomSheet();
    },
    { preventDefault: true }
  );

  // --- Single-char shortcuts (disabled in form fields) ---
  const singleCharOpts = {
    enableOnFormTags: false as const,
    enableOnContentEditable: false,
  };

  // ? (Shift+/): Open keyboard help
  useHotkeys(
    "shift+/",
    () => {
      openHelpDialog();
    },
    singleCharOpts
  );

  // [: Toggle navigator panel
  useHotkeys(
    "[",
    () => {
      useAppStore.getState().toggleNavPanel();
    },
    singleCharOpts
  );

  // ]: Toggle sidebar
  useHotkeys(
    "]",
    () => {
      useAppStore.getState().toggleSidebar();
    },
    singleCharOpts
  );

  // J: Navigate to next risk paragraph
  useHotkeys("j", goNext, singleCharOpts);

  // K: Navigate to previous risk paragraph
  useHotkeys("k", goPrev, singleCharOpts);

  // F: Open flag dialog for current paragraph (only when paragraph selected)
  useHotkeys(
    "f",
    () => {
      const paraId = useAppStore.getState().selectedParaId;
      if (!paraId) return;
      // Dispatch a custom event that the sidebar flag button can listen to
      window.dispatchEvent(
        new CustomEvent("keyboard:flag", { detail: { paraId } })
      );
    },
    { ...singleCharOpts, enabled: !!selectedParaId }
  );

  // G: Generate revision for current paragraph (only when paragraph selected)
  useHotkeys(
    "g",
    () => {
      const paraId = useAppStore.getState().selectedParaId;
      if (!paraId) return;
      // Open the bottom sheet for revision generation
      const store = useAppStore.getState();
      store.setRevisionSheetParaId(paraId);
      if (!store.bottomSheetOpen) {
        store.toggleBottomSheet();
      }
    },
    { ...singleCharOpts, enabled: !!selectedParaId }
  );

  // Escape: Close current dialog/panel/sheet (priority order)
  useHotkeys(
    "escape",
    () => {
      const store = useAppStore.getState();
      // Priority: bottom sheet > sidebar > nav panel
      if (store.bottomSheetOpen) {
        store.toggleBottomSheet();
        return;
      }
      // Note: Escape for dialogs (command palette, help) is handled by Dialog component natively
    },
    { enableOnFormTags: true, enableOnContentEditable: true }
  );
}
