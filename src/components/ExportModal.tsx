import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  Copy,
  Check,
  FileText,
  FileCode,
  Database,
  ShieldCheck,
  Loader2,
  Filter,
  UploadCloud,
  RefreshCw,
  Folder,
  AlertTriangle,
} from 'lucide-react';
import { DocumentSummary, TopicCollection } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  initialDocumentId?: string;
  initialFormat?: 'md' | 'txt' | 'json';
  collections?: TopicCollection[];
  activeCollectionId?: string;
  onBackupRestored?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documents,
  initialDocumentId,
  initialFormat = 'md',
  collections = [],
  activeCollectionId = 'all',
  onBackupRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');
  const [format, setFormat] = useState<'md' | 'txt' | 'json'>(initialFormat);
  const [selectedColId, setSelectedColId] = useState<string>(activeCollectionId);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocumentId || 'all');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreData, setRestoreData] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedColId(activeCollectionId);
  }, [activeCollectionId]);

  useEffect(() => {
    if (initialDocumentId) {
      setSelectedDocId(initialDocumentId);
    }
  }, [initialDocumentId]);

  useEffect(() => {
    if (initialFormat) {
      setFormat(initialFormat);
    }
  }, [initialFormat, isOpen]);

  // Fetch preview content when format or selected document/collection changes
  useEffect(() => {
    if (!isOpen || activeTab !== 'export') return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const docParam = selectedDocId !== 'all' ? `&documentId=${encodeURIComponent(selectedDocId)}` : '';
    const colParam = selectedColId !== 'all' && selectedDocId === 'all' ? `&collectionId=${encodeURIComponent(selectedColId)}` : '';
    
    fetch(`/api/export?format=${format}${docParam}${colParam}`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al generar la vista previa de exportación');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setPreviewContent(data.content || '');
          setFilename(data.filename || `respaldo.${format}`);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, format, selectedDocId, selectedColId, activeTab]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectDownload = () => {
    const docParam = selectedDocId !== 'all' ? `&documentId=${encodeURIComponent(selectedDocId)}` : '';
    const colParam = selectedColId !== 'all' && selectedDocId === 'all' ? `&collectionId=${encodeURIComponent(selectedColId)}` : '';
    const downloadUrl = `/api/export?format=${format}&download=true${docParam}${colParam}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);
    setRestoreSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.documents || !Array.isArray(parsed.documents)) {
          throw new Error('El archivo no contiene una estructura de base de datos válida (falta la lista de documentos).');
        }
        setRestoreData(parsed);
      } catch (err: any) {
        setRestoreError(err.message || 'Error al procesar el archivo JSON.');
        setRestoreData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreData) return;

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restoreData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Error al restaurar la base de datos.');
      }

      setRestoreSuccess(result.message || 'Respaldo restaurado con éxito.');
      setRestoreData(null);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onBackupRestored) {
        onBackupRestored();
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Error inesperado al restaurar.');
    } finally {
      setIsRestoring(false);
    }
  };

  const activeColObj = collections.find((c) => c.id === selectedColId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
              format === 'json' ? 'bg-emerald-700' : 'bg-zinc-900'
            }`}>
              {format === 'json' ? <ShieldCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <span>Exportación y Respaldo de Base de Datos</span>
                {format === 'json' && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Respaldo Seguro
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500">
                Descarga de seguridad completa en JSON para el índice seleccionado o resúmenes en Markdown/Texto.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: Exportar / Respaldar vs Restaurar */}
        <div className="flex items-center border-b border-zinc-200/80 px-6 bg-zinc-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'export'
                ? 'border-zinc-900 text-zinc-900 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Respaldo / Exportación</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'restore'
                ? 'border-zinc-900 text-zinc-900 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
            <span>Restaurar Copia de Seguridad JSON</span>
          </button>
        </div>

        {activeTab === 'export' ? (
          <>
            {/* Configuration Bar */}
            <div className="px-6 py-3 bg-zinc-50/80 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Format Selector */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-700">Formato:</span>
                <div className="flex items-center gap-1 p-0.5 bg-zinc-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormat('json')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                      format === 'json'
                        ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60 font-semibold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                    title="Copia de seguridad completa de la base de datos en formato JSON"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Respaldo JSON (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('md')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                      format === 'md'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Markdown (.md)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('txt')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                      format === 'txt'
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Texto (.txt)</span>
                  </button>
                </div>
              </div>

              {/* Scope & Index Selector */}
              <div className="flex items-center gap-3">
                {/* Index / Collection Selector */}
                {collections.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-medium text-zinc-700">Índice:</span>
                    <select
                      value={selectedColId}
                      onChange={(e) => {
                        setSelectedColId(e.target.value);
                        setSelectedDocId('all');
                      }}
                      className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 max-w-[190px] truncate"
                    >
                      <option value="all">Todas las colecciones ({collections.length})</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Document filter if in md/txt or single doc JSON */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">Documento:</span>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 max-w-[180px] truncate"
                  >
                    <option value="all">
                      {selectedColId !== 'all' ? 'Todos los del índice' : 'Todos los documentos'}
                    </option>
                    {documents
                      .filter((d) => selectedColId === 'all' || d.collectionId === selectedColId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.originalName}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Explanatory callout for JSON Backup */}
            {format === 'json' && (
              <div className="px-6 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Respaldo de Seguridad Integral:</strong> Incluye metadatos, textos completos de todas las páginas, citas, clasificaciones temáticas y estructura para restaurar o migrar el índice en cualquier momento.
                  </span>
                </div>
                {activeColObj && (
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded shrink-0">
                    Índice: {activeColObj.name}
                  </span>
                )}
              </div>
            )}

            {/* Preview Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-2 bg-[#fdfdfd]">
              <div className="flex items-center justify-between text-xs text-zinc-500 pb-1">
                <span className="font-mono text-[11px] text-zinc-700 font-medium">{filename}</span>
                <span>
                  {previewContent ? `${previewContent.split('\n').length} líneas · ${(previewContent.length / 1024).toFixed(1)} KB` : ''}
                </span>
              </div>

              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
                  <p className="text-xs">
                    {format === 'json' ? 'Generando paquete de respaldo JSON de la base de datos...' : 'Generando compendio estructurado...'}
                  </p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 text-red-800 rounded-lg text-xs">
                  {error}
                </div>
              ) : (
                <div className="border border-zinc-200 rounded-lg bg-white p-4 shadow-inner max-h-[44vh] overflow-y-auto">
                  <pre className="text-xs font-mono text-zinc-800 whitespace-pre-wrap leading-relaxed select-text">
                    {previewContent}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-xs text-zinc-500 hidden sm:inline">
                {format === 'json'
                  ? 'Archivo JSON estándar exportable y compatible con copias de seguridad de DocuIndex.'
                  : 'Compatible con Obsidian, Notion, VSCode y lectores de texto.'}
              </span>

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={loading || !previewContent}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar contenido</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDirectDownload}
                  disabled={loading || !previewContent}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
                    format === 'json'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {format === 'json' ? 'Descargar Respaldo JSON' : `Descargar ${format.toUpperCase()}`}
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Restore View */
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-emerald-950">
                    Restauración de Copia de Seguridad
                  </h3>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Puedes restaurar una base de datos o índice temático previamente exportado a formato JSON.
                    Todos los documentos, textos indexados, resúmenes y temas asociados serán incorporados de forma segura a tu biblioteca local.
                  </p>
                </div>
              </div>
            </div>

            {/* File dropzone / picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 hover:border-emerald-600 rounded-xl p-8 text-center cursor-pointer transition-colors bg-zinc-50/50 hover:bg-emerald-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-600">
                <UploadCloud className="w-6 h-6 text-zinc-700" />
              </div>
              <p className="text-sm font-semibold text-zinc-800">
                {restoreFile ? restoreFile.name : 'Haz clic para seleccionar el archivo de respaldo JSON'}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Archivos respaldados generados por DocuIndex (.json)
              </p>
            </div>

            {restoreError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
                <Check className="w-4 h-4 shrink-0 text-emerald-700" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {restoreData && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Detalles del archivo de respaldo detectado:</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-zinc-50 rounded-lg">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Índice</span>
                    <span className="font-semibold text-zinc-800 truncate block">
                      {restoreData.collection?.name || 'General / Varios'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 rounded-lg">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Documentos</span>
                    <span className="font-semibold text-zinc-800">
                      {restoreData.documents?.length || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 rounded-lg">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Páginas Totales</span>
                    <span className="font-semibold text-zinc-800">
                      {restoreData.summaryStats?.totalPages || restoreData.documents?.reduce((acc: number, d: any) => acc + (d.pageCount || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 rounded-lg">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Fecha de Respaldo</span>
                    <span className="font-semibold text-zinc-800">
                      {restoreData.exportedAt ? new Date(restoreData.exportedAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Restaurando datos...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Confirmar e Importar Respaldo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
