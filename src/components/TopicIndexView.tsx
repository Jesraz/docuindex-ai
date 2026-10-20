import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  BookOpen,
  Download,
  Trash2,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  Sparkles,
  ArrowUpRight,
  Database,
  ExternalLink,
  Folder,
  FolderPlus,
  Edit2,
  ArrowRightLeft,
  ShieldCheck,
} from 'lucide-react';
import { DocumentSummary, TopicGroup, SearchResultItem, TopicCollection } from '../types';

interface TopicIndexViewProps {
  documents: DocumentSummary[];
  topics: TopicGroup[];
  onOpenDocument: (documentId: string, pageNumber?: number) => void;
  onDeleteDocument: (documentId: string) => void;
  onOpenUpload: () => void;
  onSelectTopicDetail: (topic: TopicGroup) => void;
  onSwitchToQueryWithTopic?: (topicName: string) => void;
  onOpenExportDocument: (docId?: string, format?: 'md' | 'txt' | 'json') => void;
  onOpenBackup?: (colId?: string) => void;
  collections: TopicCollection[];
  activeCollection: TopicCollection | null;
  onOpenCreateCollection: () => void;
  onOpenEditCollection: (col: TopicCollection) => void;
  onOpenMoveDoc: (doc: DocumentSummary) => void;
}

export const TopicIndexView: React.FC<TopicIndexViewProps> = ({
  documents,
  topics,
  onOpenDocument,
  onDeleteDocument,
  onOpenUpload,
  onSelectTopicDetail,
  onSwitchToQueryWithTopic,
  onOpenExportDocument,
  onOpenBackup,
  collections,
  activeCollection,
  onOpenCreateCollection,
  onOpenEditCollection,
  onOpenMoveDoc,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'topics' | 'documents'>('both');

  // Filter topics
  const filteredTopics = useMemo(() => {
    let list = topics;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.documents.some((d) => d.documentName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [topics, searchQuery]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let list = documents;

    if (selectedTopicFilter) {
      list = list.filter((d) =>
        d.topics.some((t) => t.name.toLowerCase() === selectedTopicFilter.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.originalName.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q) ||
          d.topics.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [documents, selectedTopicFilter, searchQuery]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Active Collection Workspace Banner */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                  Índice Actual
                </span>
                <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                  {activeCollection ? activeCollection.name : 'Todos los Índices Temáticos (Vista Global)'}
                </h2>
                {activeCollection && (
                  <button
                    type="button"
                    onClick={() => onOpenEditCollection(activeCollection)}
                    className="p-1 text-zinc-400 hover:text-zinc-800 rounded transition-colors cursor-pointer"
                    title="Editar nombre y descripción de este índice"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {activeCollection
                  ? (activeCollection.description || 'Índice temático y archivo local de documentos.')
                  : `Visualizando documentos de todas las ${collections.length} colecciones existentes.`}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600 font-medium">
                <span>{filteredDocuments.length} documentos</span>
                <span className="text-zinc-300">·</span>
                <span>{filteredTopics.length} temas indexados</span>
                <span className="text-zinc-300">·</span>
                <span>
                  {filteredDocuments.reduce((acc, d) => acc + d.pageCount, 0)} páginas
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenBackup ? onOpenBackup(activeCollection?.id || 'all') : onOpenExportDocument(undefined, 'json')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              title="Exportar y respaldar la base de datos de este índice a un archivo JSON descargable"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Respaldar JSON</span>
            </button>

            <button
              type="button"
              onClick={onOpenCreateCollection}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-700" />
              <span>+ Nuevo Índice / Tema</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hero / Intro Bar */}
      <div className="border-b border-zinc-200/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Catálogo de Temas y Documentos
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Búsqueda local indexada, citas precisas de página y clasificación automática.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg text-xs">
              <button
                onClick={() => setViewMode('both')}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'both' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Vista General
              </button>
              <button
                onClick={() => setViewMode('topics')}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'topics' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Temas ({filteredTopics.length})
              </button>
              <button
                onClick={() => setViewMode('documents')}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'documents' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Archivos ({filteredDocuments.length})
              </button>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mt-5 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por tema, palabra clave o nombre de archivo PDF..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Active Filter pill if any */}
        {selectedTopicFilter && (
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
            <span>Filtrando por tema:</span>
            <span className="font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 flex items-center gap-1.5">
              {selectedTopicFilter}
              <button
                onClick={() => setSelectedTopicFilter(null)}
                className="text-zinc-400 hover:text-zinc-900 ml-1"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Thematic Index Cloud & Categories */}
        {(viewMode === 'both' || viewMode === 'topics') && (
          <div className={viewMode === 'both' ? 'lg:col-span-5 space-y-4' : 'lg:col-span-12 space-y-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-700" />
                <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                  Índice de Temas Tratados
                </h2>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredTopics.length} identificados
              </span>
            </div>

            {filteredTopics.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 rounded-xl border border-zinc-200/80">
                <p className="text-xs text-zinc-500">
                  No se encontraron temas coincidentes con la búsqueda.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTopics.map((topic) => {
                  const isSelected = selectedTopicFilter === topic.name;
                  return (
                    <div
                      key={topic.name}
                      className={`p-3.5 rounded-xl border transition-all text-left bg-white ${
                        isSelected
                          ? 'border-zinc-900 ring-1 ring-zinc-900/10'
                          : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => onSelectTopicDetail(topic)}
                          className="text-left flex-1 cursor-pointer group"
                        >
                          <div className="text-sm font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors flex items-center gap-1.5">
                            <span>{topic.name}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {topic.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                              {topic.description}
                            </p>
                          )}
                        </button>

                        <button
                          onClick={() =>
                            setSelectedTopicFilter(isSelected ? null : topic.name)
                          }
                          className={`text-xs px-2 py-0.5 rounded transition-colors shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                          title="Filtrar documentos por este tema"
                        >
                          Filtrar
                        </button>
                      </div>

                      {/* Clean typographic metadata without pill boxes */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                          <span>{topic.documents.length} doc(s)</span>
                          <span aria-hidden="true">·</span>
                          <span>{topic.totalMentions} menciones</span>
                          <span aria-hidden="true">·</span>
                          <span>Relevancia {topic.relevanceAvg}%</span>
                        </div>

                        {onSwitchToQueryWithTopic && (
                          <button
                            onClick={() => onSwitchToQueryWithTopic(topic.name)}
                            className="text-zinc-600 hover:text-zinc-900 text-xs flex items-center gap-1 font-medium cursor-pointer"
                            title="Preguntar a la IA sobre este tema"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Consultar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Right Column: Documents Database Cards */}
        {(viewMode === 'both' || viewMode === 'documents') && (
          <div className={viewMode === 'both' ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-700" />
                <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                  Documentos en Base de Datos Local
                </h2>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredDocuments.length} archivos
              </span>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-300 space-y-3">
                <FileText className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-sm font-medium text-zinc-900">
                  No hay documentos coincidentes
                </p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Sube un archivo PDF o limpia el término de búsqueda para ver los documentos indexados en el disco local.
                </p>
                <button
                  onClick={onOpenUpload}
                  className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Subir nuevo PDF
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 rounded-xl border border-zinc-200/90 hover:border-zinc-300 bg-white transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                  >
                    {/* Header: Title and Actions */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1">
                          {!activeCollection && (
                            <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                              {collections.find((c) => c.id === doc.collectionId)?.name || 'Índice General'}
                            </span>
                          )}
                          <span>{formatDate(doc.uploadDate)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{doc.pageCount} pág{doc.pageCount > 1 ? 's' : ''}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                        </div>
                        <h3 className="text-base font-semibold text-zinc-900 tracking-tight">
                          {doc.originalName}
                        </h3>
                      </div>

                      {/* Primary Action Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onOpenDocument(doc.id, 1)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                          title="Abrir en el visor interactivo"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Abrir Lector</span>
                        </button>
                      </div>
                    </div>

                    {/* Extracted Summary */}
                    {doc.summary && (
                      <p className="text-xs text-zinc-600 mt-3 leading-relaxed bg-zinc-50/70 p-3 rounded-lg border border-zinc-100">
                        {doc.summary}
                      </p>
                    )}

                    {/* Topics Row (unboxed metadata with page links) */}
                    {doc.topics && doc.topics.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-zinc-100">
                        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                          Temas indexados en este documento:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {doc.topics.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                const targetPage = t.pageNumbers[0] || 1;
                                onOpenDocument(doc.id, targetPage);
                              }}
                              className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                              title={`Ver páginas: ${t.pageNumbers.join(', ')}`}
                            >
                              <span className="font-medium">{t.name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                p.{t.pageNumbers.join(',')}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bottom Actions Bar */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenExportDocument(doc.id)}
                          className="hover:text-zinc-900 transition-colors flex items-center gap-1 cursor-pointer text-zinc-600"
                          title="Exportar resumen y temas de este documento (.md / .txt)"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Exportar Resumen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenMoveDoc(doc)}
                          className="hover:text-zinc-900 transition-colors flex items-center gap-1 cursor-pointer text-zinc-600"
                          title="Mover documento a otro índice o tema"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Mover</span>
                        </button>
                        <a
                          href={`/api/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-zinc-900 transition-colors flex items-center gap-1"
                          title="Abrir archivo PDF original en nueva pestaña"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>PDF Original</span>
                        </a>
                        <a
                          href={`/api/documents/${doc.id}/file`}
                          download={doc.originalName}
                          className="hover:text-zinc-900 transition-colors flex items-center gap-1"
                          title="Descargar copia del almacenamiento local"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar</span>
                        </a>
                      </div>

                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        className="hover:text-red-700 transition-colors flex items-center gap-1 cursor-pointer text-zinc-400"
                        title="Eliminar documento del almacenamiento local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
