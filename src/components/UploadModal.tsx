import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2, HardDrive, Sparkles, Folder, FolderPlus } from 'lucide-react';
import { TopicCollection } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  onSeedSamples: () => Promise<void>;
  collections: TopicCollection[];
  activeCollectionId: string;
  onOpenCreateCollection: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  onSeedSamples,
  collections,
  activeCollectionId,
  onOpenCreateCollection,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string>(
    activeCollectionId !== 'all' ? activeCollectionId : (collections[0]?.id || '')
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeCollectionId !== 'all') {
      setTargetCollectionId(activeCollectionId);
    } else if (collections.length > 0) {
      setTargetCollectionId(collections[0].id);
    }
  }, [activeCollectionId, collections, isOpen]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Por favor, selecciona un archivo en formato .PDF');
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError('El tamaño máximo permitido es de 40 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadStatus('Guardando archivo en almacenamiento local...');

    const formData = new FormData();
    formData.append('pdf', selectedFile);
    if (targetCollectionId) {
      formData.append('collectionId', targetCollectionId);
    }

    try {
      setUploadStatus('Extrayendo texto y páginas del PDF...');
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => null);
      }

      if (!response.ok) {
        let errorMsg = data?.error;
        if (!errorMsg) {
          if (response.status === 413) {
            errorMsg = 'El archivo supera el tamaño máximo permitido por el servidor (40 MB).';
          } else if (response.status === 504 || response.status === 502) {
            errorMsg = 'Tiempo de espera agotado al indexar el PDF en el servidor. Por favor, reintenta.';
          } else {
            errorMsg = 'Error al procesar el archivo en el servidor.';
          }
        }
        throw new Error(errorMsg);
      }

      if (!data) {
        throw new Error('La respuesta del servidor no fue un JSON válido (posible reinicio momentáneo del servicio).');
      }

      setUploadStatus('¡Documento indexado con éxito!');
      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        onUploadSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Upload error:', err);
      let msg = err.message || 'Error al subir el documento PDF';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('load failed')
      ) {
        msg = 'No se pudo conectar con el servidor local (posible reconexión momentánea tras una actualización). Por favor, pulsa "Reintentar subida".';
      } else if (
        msg.includes('is not valid JSON') ||
        msg.includes('Unexpected token') ||
        msg.includes('<!doctype')
      ) {
        msg = 'El servidor devolvió una página web temporal en lugar de datos JSON (reinicio del servicio durante el envío). Pulsa "Reintentar subida".';
      }
      setError(msg);
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleSeedSamples = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      await onSeedSamples();
      setIsSeeding(false);
      onUploadSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al generar documentos de ejemplo');
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Subir Documento PDF</h2>
            <p className="text-xs text-zinc-500">
              Se almacenará localmente para indexación y consultas
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading || isSeeding}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Collection Destination Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-zinc-700 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-emerald-600" />
                <span>Guardar en el Índice Temático:</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateCollection();
                }}
                className="text-[11px] text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer underline"
              >
                <FolderPlus className="w-3 h-3 text-emerald-600" />
                <span>+ Crear nuevo tema</span>
              </button>
            </div>
            <select
              value={targetCollectionId}
              onChange={(e) => setTargetCollectionId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs bg-zinc-50 text-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.documentCount || 0} documentos)
                </option>
              ))}
            </select>
          </div>

          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-zinc-900 bg-zinc-50'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-50/20'
                : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-zinc-900 max-w-xs truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Clic para cambiar archivo
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-zinc-900">
                  Arrastra tu archivo PDF aquí o haz clic para explorar
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Formatos admitidos: .pdf (hasta 40 MB)
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span className="flex-1 leading-relaxed">{error}</span>
              </div>
              <div className="pl-6">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading || !selectedFile}
                  className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded font-medium transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3 h-3" />
                  <span>Reintentar subida</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload Status */}
          {isUploading && (
            <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-900 shrink-0" />
              <span className="font-medium">{uploadStatus}</span>
            </div>
          )}

          {/* Privacy & Storage Guarantee Note */}
          <div className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg text-xs text-zinc-600 border border-zinc-200/60">
            <HardDrive className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-900">Privacidad y Almacenamiento Local:</span>{' '}
              El archivo se almacenará directamente en el directorio local del servidor. La indexación y búsqueda permanecen disponibles en tu entorno sin dependencias externas.
            </div>
          </div>

          {/* Quick Demo Option */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSeedSamples}
              disabled={isUploading || isSeeding}
              className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando muestras...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cargar documentos de ejemplo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading || isSeeding}
            className="px-4 py-2 text-xs font-medium text-zinc-700 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || isSeeding}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Indexando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Subir e Indexar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
