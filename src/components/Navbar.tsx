import React from 'react';
import { FileText, Database, MessageSquare, BookOpen, Upload, HardDrive, Sparkles, Download } from 'lucide-react';
import { SystemStats, TopicCollection } from '../types';
import { CollectionSelector } from './CollectionSelector';

interface NavbarProps {
  activeTab: 'index' | 'query' | 'reader';
  setActiveTab: (tab: 'index' | 'query' | 'reader') => void;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  stats: SystemStats | null;
  hasActiveDoc: boolean;
  collections: TopicCollection[];
  activeCollectionId: string;
  onSelectCollection: (id: string) => void;
  onOpenCreateCollection: () => void;
  onOpenEditCollection: (col: TopicCollection) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenUpload,
  onOpenExport,
  stats,
  hasActiveDoc,
  collections,
  activeCollectionId,
  onSelectCollection,
  onOpenCreateCollection,
  onOpenEditCollection,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand with Collection Selector */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-semibold text-lg shadow-sm">
                <FileText className="w-5 h-5 text-zinc-100" />
              </div>
              <div className="hidden xl:block">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 tracking-tight text-base">DocuIndex</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                    Local AI
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Indexación temática de PDFs y base de datos local
                </p>
              </div>
            </div>

            {/* Workspace / Topic Collection Selector */}
            <CollectionSelector
              collections={collections}
              activeCollectionId={activeCollectionId}
              onSelectCollection={onSelectCollection}
              onOpenCreateModal={onOpenCreateCollection}
              onOpenEditModal={onOpenEditCollection}
            />
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200/80">
            <button
              onClick={() => setActiveTab('index')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'index'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Índice Temático</span>
              {stats && stats.totalDocs > 0 && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  ({stats.totalDocs})
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('query')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'query'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Consulta IA</span>
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'reader'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              } ${!hasActiveDoc ? 'opacity-60' : ''}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lector</span>
            </button>
          </nav>

          {/* Right actions: Storage status, Export & Upload button */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 text-xs font-medium py-2 px-3 rounded-lg border border-zinc-200/90 transition-colors shadow-2xs cursor-pointer"
              title="Exportar resúmenes y copia de seguridad JSON de la base de datos"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Exportar / Respaldo</span>
              <span className="sm:hidden">Respaldo</span>
            </button>

            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium py-2 px-3.5 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Subir PDF</span>
              <span className="sm:hidden">Subir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
