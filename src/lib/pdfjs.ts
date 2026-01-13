/**
 * PDF.js shared initializer
 *
 * Ensures PDF.js uses a locally-bundled worker (no CDN fallback).
 * Import `pdfjs` from this file instead of importing from "pdfjs-dist" directly.
 */

// IMPORTANT: Use the ESM build entry; the generic "pdfjs-dist" entry can trigger
// CDN-based fallback logic in some bundlers.
import * as pdfjs from "pdfjs-dist/build/pdf.mjs";

// Vite-friendly worker URL (bundled, same-origin)
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Strongest guarantee: provide an actual Worker instance so PDF.js never tries
// to set up a fake worker via dynamic import (which is where cdnjs can appear).
if (typeof window !== "undefined") {
  try {
    const anyPdfjs = pdfjs as unknown as {
      GlobalWorkerOptions: {
        workerSrc?: string;
        workerPort?: Worker;
      };
    };

    if (!anyPdfjs.GlobalWorkerOptions.workerPort) {
      anyPdfjs.GlobalWorkerOptions.workerPort = new Worker(pdfWorkerUrl, {
        type: "module",
      });
    }
  } catch {
    // If module workers aren't supported in the environment, PDF.js will fall back.
    // Keeping workerSrc set to a local URL still prevents CDN usage.
  }
}

export { pdfjs };

