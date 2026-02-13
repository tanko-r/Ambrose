"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { getTransmittal } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Mail } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TransmittalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// TransmittalDialog - Email preview, editing, copy, and mailto
// ---------------------------------------------------------------------------

export function TransmittalDialog({
  open,
  onOpenChange,
}: TransmittalDialogProps) {
  const sessionId = useAppStore((s) => s.sessionId);

  const [emailContent, setEmailContent] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeRevisions, setIncludeRevisions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flagCount, setFlagCount] = useState(0);
  const [revisionCount, setRevisionCount] = useState(0);

  // Fetch transmittal on open and when includeRevisions toggles
  useEffect(() => {
    if (!open || !sessionId) {
      // Clear state when dialog closes
      if (!open) {
        setEmailContent("");
        setSubject("");
        setFlagCount(0);
        setRevisionCount(0);
      }
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    getTransmittal(sessionId, { includeRevisions })
      .then((res) => {
        if (controller.signal.aborted) return;
        setEmailContent(res.body);
        setSubject(res.subject);
        setFlagCount(res.flag_count);
        setRevisionCount(res.revision_count);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Failed to generate transmittal"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, sessionId, includeRevisions]);

  // Copy to clipboard with fallback
  const handleCopy = async () => {
    const fullText = `Subject: ${subject}\n\n${emailContent}`;
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = fullText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Open in email client via mailto
  const handleMailto = () => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(emailContent);
    const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;

    if (mailtoUrl.length > 2000) {
      // Mailto URLs have length limits; copy full content to clipboard instead
      handleCopy();
      // Still try to open email client with truncated body
      const truncatedBody = encodeURIComponent(
        emailContent.slice(0, 800) +
          "\n\n[Full content copied to clipboard -- paste to complete the email]"
      );
      const truncatedUrl = `mailto:?subject=${encodedSubject}&body=${truncatedBody}`;
      window.location.href = truncatedUrl;
      toast.info(
        "Email was too long for mailto. Full content copied to clipboard."
      );
    } else {
      window.location.href = mailtoUrl;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Transmittal</DialogTitle>
          <DialogDescription>
            Review and send the client communication.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle: include revision summary */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-revisions"
            checked={includeRevisions}
            onChange={(e) => setIncludeRevisions(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <label
            htmlFor="include-revisions"
            className="text-sm text-muted-foreground"
          >
            Include revision summary
          </label>
        </div>

        {/* Subject line */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Subject:
          </span>
          <p className="mt-0.5 text-sm font-medium">{subject || "\u00A0"}</p>
        </div>

        {/* Email textarea */}
        <div>
          <span className="text-xs text-muted-foreground">
            Edit as needed before sending.
          </span>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={16}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>

        {/* Stats */}
        <p className="text-xs text-muted-foreground">
          {flagCount} flag{flagCount !== 1 ? "s" : ""} &middot; {revisionCount}{" "}
          accepted revision{revisionCount !== 1 ? "s" : ""}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleMailto} disabled={loading}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Open in Email Client
          </Button>
          <Button onClick={handleCopy} disabled={loading}>
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
