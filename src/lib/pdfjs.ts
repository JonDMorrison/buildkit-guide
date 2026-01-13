/**
 * PDF.js shared initializer
 * 
 * This module ensures PDF.js uses a locally-bundled worker (no CDN fallback).
 * Import `pdfjs` from this file instead of directly from "pdfjs-dist".
 */
import * as pdfjs from "pdfjs-dist";

// Create worker URL using Vite's asset handling
const workerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

// Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };
