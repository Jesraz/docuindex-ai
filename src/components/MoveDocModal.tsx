import React, { useState } from 'react';
import { ArrowRightLeft, X, Folder, Loader2 } from 'lucide-react';
import { DocumentSummary, TopicCollection } from '../types';

interface MoveDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentSummary | null;
  collections: TopicCollection[];
  onMoveSuccess: () => void;
}

export const MoveDocModal: React.FC<MoveDocModalProps> = ({
  isOpen,
  onClose,
  document,
  collections,
  onMoveSuccess,
}) => {
  const [targetColId, setTargetColId] = useState<string>(
    collections[0]?.id || ''
  );
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !document) return null;

  const currentCollection = collections.find((c) => c.id === document.collectionId);

  const handleMove = async () => {
    if (!targetColId || targetColId === document.collectionId) {
      onClose();
      return;
    }

    setMoving(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${document.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetCollectionId: targetColId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al mover documento');
      }

      onMoveSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al mover');
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-900 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Mover a otro Índice Temático
              </h3>
              <p className="text-[11px] text-zinc-500 truncate max-w-xs">
                {document.originalName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <span className="text-zinc-500">Índice actual: </span>
            <span className="font-semibold text-zinc-800">
              {currentCollection?.name || 'Índice predeterminado'}
            </span>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 mb-1.5">
              Seleccionar nuevo índice de destino:
            </label>
            <select
              value={targetColId}
              onChange={(e) => setTargetColId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === document.collectionId}>
                  {c.name} {c.id === document.collectionId ? '(actual)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            disabled={moving}
            className="px-3.5 py-1.5 text-xs text-zinc-700 hover:text-zinc-900 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={moving || targetColId === document.collectionId}
            className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {moving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Moviendo...</span>
              </>
            ) : (
              <span>Mover documento</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
