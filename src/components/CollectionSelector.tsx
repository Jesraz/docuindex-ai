import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  ChevronDown,
  Check,
  Edit2,
  Layers,
  FileText,
} from 'lucide-react';
import { TopicCollection } from '../types';

interface CollectionSelectorProps {
  collections: TopicCollection[];
  activeCollectionId: string; // 'all' or collection ID
  onSelectCollection: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (col: TopicCollection) => void;
}

export const CollectionSelector: React.FC<CollectionSelectorProps> = ({
  collections,
  activeCollectionId,
  onSelectCollection,
  onOpenCreateModal,
  onOpenEditModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCollection =
    activeCollectionId === 'all'
      ? null
      : collections.find((c) => c.id === activeCollectionId) || collections[0];

  const totalAllDocs = collections.reduce((acc, c) => acc + (c.documentCount || 0), 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border border-zinc-200/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer shadow-2xs max-w-[280px]"
        title="Cambiar de tema o índice de documentos"
      >
        <Folder className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span className="truncate">
          {activeCollection ? activeCollection.name : 'Todos los Índices'}
        </span>
        <span className="text-[11px] font-mono text-zinc-500 bg-zinc-200/60 px-1.5 py-0.2 rounded shrink-0">
          {activeCollection ? activeCollection.documentCount ?? 0 : totalAllDocs}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-0.5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3.5 py-2 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Índices y Temas Creados
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreateModal();
              }}
              className="text-xs text-zinc-900 hover:text-zinc-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nuevo Índice</span>
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {collections.map((col) => {
              const isActive = activeCollectionId === col.id;
              return (
                <div
                  key={col.id}
                  className={`px-3 py-2 flex items-center justify-between hover:bg-zinc-50 transition-colors group ${
                    isActive ? 'bg-zinc-50/80 font-medium' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCollection(col.id);
                      setIsOpen(false);
                    }}
                    className="flex-1 flex items-start gap-2.5 text-left cursor-pointer mr-2 overflow-hidden"
                  >
                    <div className="mt-0.5 shrink-0">
                      {isActive ? (
                        <Check className="w-3.5 h-3.5 text-zinc-900 stroke-[3]" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs text-zinc-900 truncate">{col.name}</div>
                      {col.description && (
                        <div className="text-[11px] text-zinc-500 truncate font-normal">
                          {col.description}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5 font-normal">
                        {col.documentCount ?? 0} docs · {col.pageCount ?? 0} págs
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      onOpenEditModal(col);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                    title="Editar nombre y descripción"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Option to view all */}
            <div className="pt-1 mt-1 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  onSelectCollection('all');
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-zinc-50 transition-colors cursor-pointer text-xs ${
                  activeCollectionId === 'all' ? 'bg-zinc-50 font-medium text-zinc-900' : 'text-zinc-600'
                }`}
              >
                {activeCollectionId === 'all' ? (
                  <Check className="w-3.5 h-3.5 text-zinc-900 stroke-[3]" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Ver todos los índices combinados ({totalAllDocs} docs)</span>
              </button>
            </div>
          </div>

          <div className="px-3 pt-2 pb-1 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreateModal();
              }}
              className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Iniciar Nuevo Tema / Índice</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
