"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// ErrorDisplay - reusable inline error display (function component)
// ---------------------------------------------------------------------------

interface ErrorDisplayProps {
  error: Error;
  friendlyMessage?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({
  error,
  friendlyMessage = "Something went wrong while loading this content.",
  onRetry,
}: ErrorDisplayProps) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-destructive">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {friendlyMessage}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
              {error.message}
              {error.stack && `\n${error.stack}`}
            </pre>
          </details>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary - class component (required for React error boundaries)
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  friendlyMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4">
          <ErrorDisplay
            error={this.state.error}
            friendlyMessage={this.props.friendlyMessage}
            onRetry={this.resetErrorBoundary}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
