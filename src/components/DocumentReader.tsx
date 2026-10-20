import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Search,
  FileText,
  Layers,
  Sparkles,
  Eye,
  AlignLeft,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DocumentDetail, DocumentSummary } from '../types';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface DocumentReaderProps {
  documentId: string;
  initialPage?: number;
  highlightSnippet?: string;
  documents: DocumentSummary[];
  onBackToIndex: () => void;
  onSelectDocument: (docId: string, page?: number) => void;
  onAskAboutPage?: (pageText: string, pageNum: number, docName: string) => void;
  onOpenExportDocument?: (docId: string) => void;
}

export const DocumentReader: React.FC<DocumentReaderProps> = ({
  documentId,
  initialPage = 1,
  highlightSnippet,
  documents,
  onBackToIndex,
  onSelectDocument,
  onAskAboutPage,
  onOpenExportDocument,
}) => {
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [viewFormat, setViewFormat] = useState<'split' | 'pdf' | 'text'>('split');
  const [inDocSearch, setInDocSearch] = useState('');
  const [copiedPage, setCopiedPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch full document details (pages & topics)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/documents/${documentId}`)
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el documento');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setDocDetail(data.document);
          setCurrentPage(Math.min(initialPage, data.document.pageCount || 1));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Error al cargar el documento');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [documentId]);

  // Update currentPage if initialPage prop changes
  useEffect(() => {
    if (initialPage) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  const totalPages = docDetail?.pageCount || 1;
  const activePageData = docDetail?.pages.find((p) => p.pageNumber === currentPage);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const handleCopyPageText = () => {
    if (!activePageData?.text) return;
    navigator.clipboard.writeText(activePageData.text);
    setCopiedPage(true);
    setTimeout(() => setCopiedPage(false), 2000);
  };

  // Filter or highlight text
  const renderedPageText = activePageData?.text || '';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Navigation & Controls Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Back & Document Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToIndex}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Índice</span>
          </button>

          <div className="h-4 w-px bg-zinc-200" />

          {/* Document switcher */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={documentId}
              onChange={(e) => onSelectDocument(e.target.value, 1)}
              className="text-xs font-semibold text-zinc-900 bg-transparent border-0 focus:ring-0 cursor-pointer max-w-[200px] sm:max-w-xs truncate"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.originalName} ({d.pageCount} pág.)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center: Page Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 transition-colors cursor-pointer"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
            <span>Página</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= totalPages) {
                  setCurrentPage(val);
                }
              }}
              className="w-12 text-center py-0.5 px-1 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-900 font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            <span>de {totalPages}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-700 transition-colors cursor-pointer"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: View mode & External actions */}
        <div className="flex items-center justify-end gap-2">
          {/* Format buttons */}
          <div className="hidden sm:flex items-center gap-1 p-0.5 bg-zinc-100 rounded-lg text-xs">
            <button
              onClick={() => setViewFormat('split')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'split' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Vista dual: PDF y Texto extraído"
            >
              Dual
            </button>
            <button
              onClick={() => setViewFormat('pdf')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'pdf' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Solo PDF original"
            >
              PDF
            </button>
            <button
              onClick={() => setViewFormat('text')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewFormat === 'text' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Solo texto extraído"
            >
              Texto
            </button>
          </div>

          <a
            href={`/api/documents/${documentId}/file#page=${currentPage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            title="Abrir en pestaña independiente"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {onOpenExportDocument && (
            <button
              type="button"
              onClick={() => onOpenExportDocument(documentId)}
              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              title="Exportar resumen temático de este documento (.md / .txt)"
            >
              <FileText className="w-4 h-4 text-blue-600" />
            </button>
          )}

          <a
            href={`/api/documents/${documentId}/file`}
            download={docDetail?.originalName || 'documento.pdf'}
            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            title="Descargar PDF original"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main Reader Viewports */}
      {loading ? (
        <div className="h-[70vh] bg-white rounded-xl border border-zinc-200 flex items-center justify-center">
          <p className="text-xs text-zinc-500">Cargando documento y páginas...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs">
          {error}
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            viewFormat === 'split'
              ? 'grid-cols-1 lg:grid-cols-12'
              : 'grid-cols-1'
          }`}
        >
          {/* PDF Visual Viewer using Canvas */}
          {(viewFormat === 'split' || viewFormat === 'pdf') && (
            <div
              className={`${
                viewFormat === 'split' ? 'lg:col-span-7' : 'w-full'
              } h-[76vh] flex flex-col`}
            >
              <PdfCanvasViewer
                documentId={documentId}
                documentName={docDetail?.originalName || 'Documento.pdf'}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}

          {/* Extracted Text & Thematic Annotations View */}
          {(viewFormat === 'split' || viewFormat === 'text') && (
            <div
              className={`${
                viewFormat === 'split' ? 'lg:col-span-5' : 'w-full'
              } h-[76vh] bg-white rounded-xl border border-zinc-200/90 shadow-xs flex flex-col overflow-hidden`}
            >
              {/* Header with Search & Copy */}
              <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-900">
                    Contenido Extraído (Pág. {currentPage})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPageText}
                    className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200/60 transition-colors cursor-pointer"
                    title="Copiar texto de esta página"
                  >
                    {copiedPage ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="text-[11px]">{copiedPage ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  {onAskAboutPage && activePageData?.text && (
                    <button
                      onClick={() =>
                        onAskAboutPage(
                          activePageData.text,
                          currentPage,
                          docDetail?.originalName || 'Documento'
                        )
                      }
                      className="text-xs text-zinc-900 hover:text-black flex items-center gap-1 px-2 py-1 rounded bg-zinc-200/70 hover:bg-zinc-200 font-medium transition-colors cursor-pointer"
                      title="Consultar a la IA sobre esta página"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span className="text-[11px]">Preguntar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Topics on this page */}
              {activePageData?.topics && activePageData.topics.length > 0 && (
                <div className="px-4 py-2.5 bg-amber-50/40 border-b border-amber-100/70 flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider shrink-0">
                    Temas en esta página:
                  </span>
                  <div className="flex flex-wrap gap-1.5 overflow-hidden">
                    {activePageData.topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-medium text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Text content area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {highlightSnippet && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <span className="font-semibold block mb-0.5">Cita referenciada:</span>
                    <span className="italic">"{highlightSnippet}"</span>
                  </div>
                )}

                {renderedPageText ? (
                  <div className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-mono whitespace-pre-wrap select-text">
                    {renderedPageText}
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-400 text-xs">
                    Esta página no contiene texto seleccionable directo o es una imagen.
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="px-4 py-2.5 border-t border-zinc-100 bg-zinc-50 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>{activePageData?.wordCount || 0} palabras en esta página</span>
                <span className="font-mono">Página {currentPage} de {totalPages}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
