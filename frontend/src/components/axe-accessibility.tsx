"use client";

import React, { useEffect } from "react";

/**
 * Development-only accessibility auditing via axe-core.
 * Outputs violations to the browser console.
 * Tree-shaken out of production builds.
 */
export function AxeAccessibility() {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      import("@axe-core/react").then((axe) => {
        import("react-dom").then((ReactDOM) => {
          axe.default(React, ReactDOM, 1000);
        });
      });
    }
  }, []);

  return null;
}
