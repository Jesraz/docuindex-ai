import React, { useState, useEffect } from 'react';
import { FolderPlus, Edit3, X, Check, Loader2, Sparkles } from 'lucide-react';
import { TopicCollection } from '../types';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionToEdit?: TopicCollection | null;
  onSave: (name: string, description: string, color?: string) => Promise<void>;
}

const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Esmeralda', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-500', ring: 'ring-indigo-500' },
  { id: 'violet', label: 'Violeta', bg: 'bg-violet-500', ring: 'ring-violet-500' },
  { id: 'amber', label: 'Ámbar', bg: 'bg-amber-500', ring: 'ring-amber-500' },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-500', ring: 'ring-rose-500' },
];

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  collectionToEdit,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('emerald');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collectionToEdit) {
      setName(collectionToEdit.name);
      setDescription(collectionToEdit.description || '');
      setColor(collectionToEdit.color || 'emerald');
    } else {
      setName('');
      setDescription('');
      setColor('indigo');
    }
    setError(null);
  }, [collectionToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor introduce un nombre para el índice o tema.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim(), color);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el índice');
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(collectionToEdit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              {isEditing ? <Edit3 className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {isEditing ? 'Editar Nombre del Índice' : 'Crear Nuevo Índice Temático'}
              </h2>
              <p className="text-xs text-zinc-500">
                {isEditing
                  ? 'Modifica el nombre y descripción de este archivo'
                  : 'Organiza un nuevo tema con sus propios documentos y consultas'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Nombre descriptivo del tema o índice <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Actualizaciones VinfoPOL, Manuales Técnicos, Normativa..."
              autoFocus
              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Descripción o propósito (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Documentación de versiones, cambios del sistema y registros de despliegue..."
              rows={3}
              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Distintivo de color
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all cursor-pointer flex items-center justify-center ${
                    color === c.id ? `ring-2 ring-offset-2 ${c.ring} scale-110` : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.label}
                >
                  {color === c.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-medium text-zinc-700 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Índice'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
