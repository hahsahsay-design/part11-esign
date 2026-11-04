"use client";

// Thin wrapper around pdfjs-dist for client-side rendering (field placement
// in the workflow builder, and the recipient signing viewer). Configuring
// the worker once here keeps every call site simple.
import * as pdfjsLib from "pdfjs-dist";

let configured = false;

export function getPdfJs() {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    configured = true;
  }
  return pdfjsLib;
}

export async function renderPdfPageToCanvas(
  pdfDoc: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
) {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = targetWidth / unscaled.width;
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}
