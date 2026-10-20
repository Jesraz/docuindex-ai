import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ExternalLink,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// Configure the local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfCanvasViewerProps {
  documentId: string;
  documentName: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  documentId,
  documentName,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  // 1. Load the PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const pdfUrl = `/api/documents/${documentId}/file`;
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/',
      cMapPacked: true,
    });

    loadingTask.promise
      .then((doc) => {
        if (!isCancelled) {
          setPdfDoc(doc);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Error loading PDF document:', err);
          setError('No se pudo cargar el archivo PDF en el visor interactivo.');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadingTask.destroy();
      } catch {}
    };
  }, [documentId]);

  // 2. Render the specific page onto the Canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
    }

    setRendering(true);

    try {
      const pageNum = Math.min(Math.max(1, currentPage), pdfDoc.numPages);
      const page = await pdfDoc.getPage(pageNum);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale, rotation });

      // Handle High DPI displays for crisp text
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        canvas,
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      setRendering(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
      }
      setRendering(false);
    }
  }, [pdfDoc, currentPage, scale, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(3.0, +(s + 0.2).toFixed(1)));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)));
  const handleResetZoom = () => setScale(1.0);
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleFitWidth = () => {
    if (!containerRef.current || !canvasRef.current || !pdfDoc) return;
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    if (containerWidth > 300) {
      pdfDoc.getPage(currentPage).then((page) => {
        const standardViewport = page.getViewport({ scale: 1.0 });
        const targetScale = +(containerWidth / standardViewport.width).toFixed(2);
        setScale(Math.max(0.5, Math.min(2.5, targetScale)));
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-100/90 rounded-xl overflow-hidden border border-zinc-200">
      {/* Viewer Sub-Toolbar */}
      <div className="bg-zinc-50 border-b border-zinc-200/90 px-3 py-2 flex items-center justify-between text-xs text-zinc-700 select-none">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-zinc-900 truncate max-w-[180px] sm:max-w-xs">
            {documentName}
          </span>
          <span className="text-zinc-400">·</span>
          <span className="font-mono text-zinc-500">
            {currentPage} / {totalPages}
          </span>
        </div>

        {/* Zoom & Canvas controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.6}
            className="p-1 hover:bg-zinc-200/80 rounded transition-colors text-zinc-600 disabled:opacity-30 cursor-pointer"
            title="Reducir zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span
            onClick={handleResetZoom}
            className="text-[11px] font-mono px-1.5 py-0.5 rounded hover:bg-zinc-200/60 cursor-pointer text-zinc-700"
            title="Restablecer zoom al 100%"
          >
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            className="p-1 hover:bg-zinc-200/80 rounded transition-colors text-zinc-600 disabled:opacity-30 cursor-pointer"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleFitWidth}
            className="p-1 hover:bg-zinc-200/80 rounded transition-colors text-zinc-600 cursor-pointer ml-1"
            title="Ajustar al ancho de la ventana"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-1 hover:bg-zinc-200/80 rounded transition-colors text-zinc-600 cursor-pointer"
            title="Rotar 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-zinc-300 mx-1" />

          <a
            href={`/api/documents/${documentId}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-zinc-200/80 rounded transition-colors text-zinc-600"
            title="Abrir PDF en pestaña nueva"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center relative min-h-[400px]"
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/70 z-10 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-800" />
            <p className="text-xs text-zinc-600 font-medium">Cargando documento PDF...</p>
          </div>
        )}

        {rendering && !loading && (
          <div className="absolute top-4 right-4 bg-zinc-900/80 text-white text-[11px] px-2 py-1 rounded-md flex items-center gap-1.5 shadow-sm z-10">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Renderizando pág. {currentPage}...</span>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center max-w-sm my-auto space-y-3 bg-white rounded-xl border border-red-200 shadow-xs">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-xs font-semibold text-zinc-900">Visor de PDF no disponible</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{error}</p>
            <div className="pt-2 flex justify-center gap-2">
              <a
                href={`/api/documents/${documentId}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en navegador</span>
              </a>
              <a
                href={`/api/documents/${documentId}/file`}
                download={documentName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="shadow-lg rounded-sm bg-white overflow-hidden transition-transform">
            <canvas ref={canvasRef} className="block max-w-none" />
          </div>
        )}
      </div>
    </div>
  );
};
