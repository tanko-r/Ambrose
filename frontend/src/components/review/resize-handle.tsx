"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ResizeHandleProps {
  /** "left" = panel is on the left, drag right to grow it */
  side: "left" | "right";
  /** Called with cumulative pixel delta from drag start */
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const [hovered, setHovered] = useState(false);
  const draggingRef = useRef(false);
  const originX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    originX.current = e.clientX;
    draggingRef.current = true;
    setHovered(true); // keep visible during drag

    const onMouseMove = (ev: MouseEvent) => {
      const raw = ev.clientX - originX.current;
      onResize(side === "left" ? raw : -raw);
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      setHovered(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="group relative z-10 flex w-0 shrink-0 items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!draggingRef.current) setHovered(false); }}
      onMouseDown={onMouseDown}
      style={{ cursor: "col-resize" }}
    >
      {/* Invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />

      {/* Visible bar on hover/drag */}
      <div
        className={`absolute inset-y-0 w-[3px] rounded-full transition-opacity duration-150 ${
          hovered ? "bg-primary/40 opacity-100" : "opacity-0"
        }`}
      />

      {/* Arrow indicators on hover */}
      {hovered && (
        <div className="pointer-events-none absolute flex items-center gap-0">
          <ChevronLeft className="h-3 w-3 text-primary/60" />
          <ChevronRight className="h-3 w-3 -ml-1 text-primary/60" />
        </div>
      )}
    </div>
  );
}
