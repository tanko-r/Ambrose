"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { intake, loadSession } from "@/lib/api";
import type { Approach, Aggressiveness, Representation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  X,
  Loader2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

const REPRESENTATIONS: { value: Representation; label: string }[] = [
  { value: "seller", label: "Seller" },
  { value: "buyer", label: "Buyer" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "lender", label: "Lender" },
  { value: "borrower", label: "Borrower" },
  { value: "developer", label: "Developer" },
  { value: "grantor", label: "Grantor" },
  { value: "grantee", label: "Grantee" },
  { value: "other", label: "Other" },
];

const APPROACHES: { value: Approach; label: string; description: string }[] = [
  {
    value: "quick-sale",
    label: "Quick Sale",
    description: "Minimal revisions, close fast",
  },
  {
    value: "competitive-bid",
    label: "Competitive Bid",
    description: "Balanced approach",
  },
  {
    value: "relationship",
    label: "Relationship",
    description: "Preserve goodwill",
  },
  {
    value: "adversarial",
    label: "Adversarial",
    description: "Maximize protections",
  },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: "Light Touch",
  2: "Moderate",
  3: "Balanced",
  4: "Aggressive",
  5: "Maximum",
};

export function IntakeForm() {
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);
  const setView = useAppStore((s) => s.setView);

  // Form state
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [precedentFile, setPrecedentFile] = useState<File | null>(null);
  const [representation, setRepresentation] = useState<Representation>("seller");
  const [approach, setApproach] = useState<Approach>("competitive-bid");
  const [aggressiveness, setAggressiveness] = useState<Aggressiveness>(3);
  const [dealContext, setDealContext] = useState("");
  const [includeExhibits, setIncludeExhibits] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // File input refs
  const targetInputRef = useRef<HTMLInputElement>(null);
  const precedentInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [targetDragOver, setTargetDragOver] = useState(false);
  const [precedentDragOver, setPrecedentDragOver] = useState(false);

  const handleFileDrop = useCallback(
    (e: React.DragEvent, type: "target" | "precedent") => {
      e.preventDefault();
      e.stopPropagation();
      if (type === "target") setTargetDragOver(false);
      else setPrecedentDragOver(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (!file.name.endsWith(".docx")) {
        toast.error("Please upload a .docx file");
        return;
      }

      if (type === "target") setTargetFile(file);
      else setPrecedentFile(file);
    },
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "target" | "precedent") => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (type === "target") setTargetFile(file);
      else setPrecedentFile(file);
    },
    []
  );

  const clearFile = useCallback(
    (type: "target" | "precedent", e: React.MouseEvent) => {
      e.stopPropagation();
      if (type === "target") {
        setTargetFile(null);
        if (targetInputRef.current) targetInputRef.current.value = "";
      } else {
        setPrecedentFile(null);
        if (precedentInputRef.current) precedentInputRef.current.value = "";
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetFile) {
      toast.error("Please upload a target contract");
      return;
    }

    setSubmitting(true);
    try {
      const result = await intake({
        targetFile,
        precedentFile: precedentFile ?? undefined,
        representation,
        dealContext,
        approach,
        aggressiveness,
        includeExhibits,
      });

      toast.success(
        `Document loaded: ${result.paragraph_count} paragraphs, ${result.section_count} sections`
      );

      setSession({
        sessionId: result.session_id,
        status: result.status,
        contractType: result.contract_type,
        representation,
        approach,
        aggressiveness,
        dealContext,
        includeExhibits,
        targetFilename: targetFile.name,
        hasPrecedent: result.has_precedent,
      });
      setView("review");

      router.push(`/review/${result.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start review"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadTest = async () => {
    setSubmitting(true);
    try {
      const result = await loadSession("test-sample-psa");
      toast.success(
        `Test session loaded: ${result.target_filename}`
      );

      setSession({
        sessionId: result.session_id,
        status: result.session_status as "analyzed",
        targetFilename: result.target_filename,
      });
      setView("review");

      router.push(`/review/${result.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No test data available. Run: python fixtures/seed_test_session.py"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          New Contract Review
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload your contract and configure the review parameters.
        </p>
      </div>

      <Separator />

      {/* File uploads */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Target file */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Target Contract <span className="text-destructive">*</span>
          </label>
          <UploadArea
            file={targetFile}
            dragOver={targetDragOver}
            onDragOver={() => setTargetDragOver(true)}
            onDragLeave={() => setTargetDragOver(false)}
            onDrop={(e) => handleFileDrop(e, "target")}
            onClick={() => targetInputRef.current?.click()}
            onClear={(e) => clearFile("target", e)}
          />
          <input
            ref={targetInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, "target")}
          />
        </div>

        {/* Precedent file */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Precedent{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </label>
          <UploadArea
            file={precedentFile}
            dragOver={precedentDragOver}
            onDragOver={() => setPrecedentDragOver(true)}
            onDragLeave={() => setPrecedentDragOver(false)}
            onDrop={(e) => handleFileDrop(e, "precedent")}
            onClick={() => precedentInputRef.current?.click()}
            onClear={(e) => clearFile("precedent", e)}
          />
          <input
            ref={precedentInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => handleFileSelect(e, "precedent")}
          />
        </div>
      </div>

      {/* Settings row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Representation */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Representation</label>
          <Select
            value={representation}
            onValueChange={(v) => setRepresentation(v as Representation)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPRESENTATIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Approach */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Review Approach</label>
          <Select
            value={approach}
            onValueChange={(v) => setApproach(v as Approach)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROACHES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Aggressiveness */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Intensity:{" "}
            <span className="text-primary font-semibold">
              {aggressiveness} — {INTENSITY_LABELS[aggressiveness]}
            </span>
          </label>
          <Slider
            min={1}
            max={5}
            step={1}
            value={[aggressiveness]}
            onValueChange={([v]) => setAggressiveness(v as Aggressiveness)}
            className="py-2"
          />
        </div>
      </div>

      {/* Deal context */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Deal Context{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          value={dealContext}
          onChange={(e) => setDealContext(e.target.value)}
          placeholder="Key deal points, client concerns, special considerations..."
        />
      </div>

      <Separator />

      {/* Bottom row: checkbox + actions */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeExhibits}
            onChange={(e) => setIncludeExhibits(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Include exhibits
        </label>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleLoadTest}
            disabled={submitting}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Load Test Data
          </Button>
          <Button
            type="submit"
            size="sm"
            className="gap-1.5"
            disabled={submitting || !targetFile}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Start Review
          </Button>
        </div>
      </div>
    </form>
  );
}

// --- Upload area sub-component ---

function UploadArea({
  file,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onClear,
}: {
  file: File | null;
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  onClear: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
        file
          ? "border-primary/40 bg-primary/5"
          : dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent"
      }`}
    >
      {file ? (
        <>
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {file.name}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Drop or click to upload
          </span>
        </>
      )}
    </div>
  );
}
