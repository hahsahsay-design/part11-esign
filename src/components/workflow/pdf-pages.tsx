"use client";

import { useEffect, useRef, useState } from "react";
import { getPdfJs, renderPdfPageToCanvas } from "@/lib/pdfjs-client";

export interface PageSize {
  width: number;
  height: number;
}

export function PdfPages({
  fileUrl,
  pageWidth = 700,
  renderOverlay,
  onPageSizes,
  onPageClick,
}: {
  fileUrl: string;
  pageWidth?: number;
  renderOverlay?: (pageNumber: number, size: PageSize) => React.ReactNode;
  onPageSizes?: (count: number) => void;
  onPageClick?: (pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Step 1: fetch + parse the PDF, learn the page count, mount one canvas per page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fileUrl, { credentials: "include" });
        if (!res.ok) throw new Error("Could not load the document.");
        const buffer = await res.arrayBuffer();
        const pdfjsLib = getPdfJs();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        canvasRefs.current = new Array(doc.numPages).fill(null);
        setNumPages(doc.numPages);
        onPageSizes?.(doc.numPages);

        // Step 2 (after the canvases above have mounted): render each page.
        requestAnimationFrame(async () => {
          const sizes: PageSize[] = [];
          for (let i = 1; i <= doc.numPages; i += 1) {
            const canvas = canvasRefs.current[i - 1];
            if (!canvas) continue;
            const size = await renderPdfPageToCanvas(doc, i, canvas, pageWidth);
            sizes.push(size);
          }
          if (!cancelled) setPageSizes(sizes);
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to render document.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, pageWidth]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {Array.from({ length: numPages }).map((_, i) => {
        const size = pageSizes[i] ?? { width: pageWidth, height: pageWidth * 1.294 };
        return (
          <div
            key={i}
            className="relative shadow-sm"
            style={{ width: size.width, height: size.height }}
            onClick={(e) => onPageClick?.(i + 1, e)}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              className="block border bg-white"
            />
            {pageSizes[i] && renderOverlay?.(i + 1, size)}
          </div>
        );
      })}
    </div>
  );
}
