import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { TopicIndexView } from './components/TopicIndexView';
import { AIQueryView } from './components/AIQueryView';
import { DocumentReader } from './components/DocumentReader';
import { UploadModal } from './components/UploadModal';
import { TopicDetailModal } from './components/TopicDetailModal';
import { ExportModal } from './components/ExportModal';
import { CollectionModal } from './components/CollectionModal';
import { MoveDocModal } from './components/MoveDocModal';
import { DocumentSummary, TopicGroup, SystemStats, TopicCollection } from './types';
import { Loader2, HardDrive, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'index' | 'query' | 'reader'>('index');
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [topics, setTopics] = useState<TopicGroup[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Collections / Workspaces state
  const [collections, setCollections] = useState<TopicCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>(() => {
    try {
      return localStorage.getItem('docuindex_active_col') || 'col-vinfopol';
    } catch {
      return 'col-vinfopol';
    }
  });

  // Collection modal state
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [colToEdit, setColToEdit] = useState<TopicCollection | null>(null);

  // Move document modal state
  const [docToMove, setDocToMove] = useState<DocumentSummary | null>(null);

  // Active document and page for reader
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [highlightSnippet, setHighlightSnippet] = useState<string | undefined>(undefined);

  // Topic detail modal
  const [selectedTopicDetail, setSelectedTopicDetail] = useState<TopicGroup | null>(null);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Export modal
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportTargetDocId, setExportTargetDocId] = useState<string | undefined>(undefined);
  const [exportInitialFormat, setExportInitialFormat] = useState<'md' | 'txt' | 'json'>('md');

  // Prefilled query for AI tab
  const [initialTopicQuery, setInitialTopicQuery] = useState<string | undefined>(undefined);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };


  // Fetch initial data scoped by active collection
  const loadData = useCallback(async () => {
    try {
      const colParam =
        activeCollectionId && activeCollectionId !== 'all'
          ? `?collectionId=${encodeURIComponent(activeCollectionId)}`
          : '';

      const [colRes, docsRes, topicsRes, statsRes] = await Promise.all([
        fetch('/api/collections'),
        fetch(`/api/documents${colParam}`),
        fetch(`/api/topics${colParam}`),
        fetch('/api/stats'),
      ]);

      if (colRes.ok) {
        const colData = await colRes.json();
        const cols: TopicCollection[] = colData.collections || [];
        setCollections(cols);

        // Fallback if activeCollectionId doesn't exist anymore and isn't 'all'
        if (cols.length > 0 && activeCollectionId !== 'all' && !cols.some((c) => c.id === activeCollectionId)) {
          setActiveCollectionId(cols[0].id);
          try {
            localStorage.setItem('docuindex_active_col', cols[0].id);
          } catch {}
        }
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        const docsList: DocumentSummary[] = docsData.documents || [];
        setDocuments(docsList);

        // Set default active doc if current active is not in the list
        if (docsList.length > 0) {
          if (!activeDocId || !docsList.some((d) => d.id === activeDocId)) {
            setActiveDocId(docsList[0].id);
          }
        } else {
          setActiveDocId(null);
        }
      }

      if (topicsRes.ok) {
        const topicsData = await topicsRes.json();
        setTopics(topicsData.topics || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCollectionId, activeDocId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Select collection / index handler
  const handleSelectCollection = (colId: string) => {
    setActiveCollectionId(colId);
    try {
      localStorage.setItem('docuindex_active_col', colId);
    } catch {}
  };

  // Open modal to create new collection
  const handleOpenCreateCollection = () => {
    setColToEdit(null);
    setIsColModalOpen(true);
  };

  // Open modal to edit existing collection
  const handleOpenEditCollection = (col: TopicCollection) => {
    setColToEdit(col);
    setIsColModalOpen(true);
  };

  // Save (create or update) collection
  const handleSaveCollection = async (name: string, description: string, color?: string) => {
    if (colToEdit) {
      const res = await fetch(`/api/collections/${colToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar el índice');
      }
      showToast(`Índice "${name}" actualizado correctamente`);
    } else {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al crear el índice');
      }
      const data = await res.json();
      if (data.collection?.id) {
        handleSelectCollection(data.collection.id);
      }
      showToast(`Nuevo tema "${name}" creado. Ya puedes añadir documentos.`);
    }
    await loadData();
  };

  // Open modal to move document between collections
  const handleOpenMoveDoc = (doc: DocumentSummary) => {
    setDocToMove(doc);
  };

  const handleMoveDocSuccess = () => {
    showToast('Documento movido al nuevo tema');
    loadData();
  };

  // Open a document at a specific page in reader
  const handleOpenDocumentPage = (docId: string, pageNumber: number = 1, snippet?: string) => {
    setActiveDocId(docId);
    setActivePage(pageNumber);
    setHighlightSnippet(snippet);
    setActiveTab('reader');
  };

  // Open export modal
  const handleOpenExport = (docId?: string, format: 'md' | 'txt' | 'json' = 'md') => {
    setExportTargetDocId(docId);
    setExportInitialFormat(format);
    setIsExportOpen(true);
  };

  // Switch to query tab with a pre-filled topic question
  const handleSwitchToQueryWithTopic = (topicName: string) => {
    setInitialTopicQuery(topicName);
    setActiveTab('query');
  };

  // Custom confirmation modal for document deletion
  const [docToDelete, setDocToDelete] = useState<DocumentSummary | null>(null);

  // Delete document handler
  const handleDeleteDocument = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setDocToDelete(doc);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    const docId = docToDelete.id;

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Documento eliminado correctamente');
        if (activeDocId === docId) {
          const remaining = documents.filter((d) => d.id !== docId);
          setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
          setActivePage(1);
        }
        loadData();
      } else {
        showToast('No se pudo eliminar el documento');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Error de conexión al eliminar el archivo');
    } finally {
      setDocToDelete(null);
    }
  };

  // Seed sample demo documents
  const handleSeedSamples = async () => {
    const res = await fetch('/api/seed-samples', { method: 'POST' });
    if (!res.ok) throw new Error('Error al generar documentos de ejemplo');
    await loadData();
    showToast('Documentos de ejemplo generados e indexados');
  };

  const activeCollection =
    activeCollectionId === 'all'
      ? null
      : collections.find((c) => c.id === activeCollectionId) || collections[0] || null;

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => handleOpenExport()}
        stats={stats}
        hasActiveDoc={Boolean(activeDocId)}
        collections={collections}
        activeCollectionId={activeCollectionId}
        onSelectCollection={handleSelectCollection}
        onOpenCreateCollection={handleOpenCreateCollection}
        onOpenEditCollection={handleOpenEditCollection}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
            <p className="text-xs text-zinc-500">Cargando base de conocimiento y temas indexados...</p>
          </div>
        ) : (
          <>
            {activeTab === 'index' && (
              <TopicIndexView
                documents={documents}
                topics={topics}
                onOpenDocument={handleOpenDocumentPage}
                onDeleteDocument={handleDeleteDocument}
                onOpenUpload={() => setIsUploadOpen(true)}
                onSelectTopicDetail={(topic) => setSelectedTopicDetail(topic)}
                onSwitchToQueryWithTopic={handleSwitchToQueryWithTopic}
                onOpenExportDocument={(docId, format) => handleOpenExport(docId, format || 'md')}
                onOpenBackup={(colId) => {
                  if (colId && colId !== 'all') {
                    setActiveCollectionId(colId);
                  }
                  handleOpenExport(undefined, 'json');
                }}
                collections={collections}
                activeCollection={activeCollection}
                onOpenCreateCollection={handleOpenCreateCollection}
                onOpenEditCollection={handleOpenEditCollection}
                onOpenMoveDoc={handleOpenMoveDoc}
              />
            )}

            {activeTab === 'query' && (
              <AIQueryView
                documents={documents}
                onOpenDocumentPage={handleOpenDocumentPage}
                initialTopicQuery={initialTopicQuery}
                collections={collections}
                activeCollectionId={activeCollectionId}
              />
            )}

            {activeTab === 'reader' && (
              <>
                {activeDocId ? (
                  <DocumentReader
                    documentId={activeDocId}
                    initialPage={activePage}
                    highlightSnippet={highlightSnippet}
                    documents={documents}
                    onBackToIndex={() => setActiveTab('index')}
                    onSelectDocument={(id, page) => {
                      setActiveDocId(id);
                      setActivePage(page || 1);
                      setHighlightSnippet(undefined);
                    }}
                    onAskAboutPage={(pageText, pageNum, docName) => {
                      setInitialTopicQuery(`Explica en detalle los puntos de la página ${pageNum} de "${docName}"`);
                      setActiveTab('query');
                    }}
                    onOpenExportDocument={handleOpenExport}
                  />
                ) : (
                  <div className="p-12 text-center bg-white rounded-xl border border-dashed border-zinc-300 space-y-3 max-w-md mx-auto my-12">
                    <p className="text-sm font-semibold text-zinc-900">No hay ningún documento seleccionado en este tema</p>
                    <p className="text-xs text-zinc-500">
                      Sube un documento PDF o selecciona uno desde el Índice Temático para comenzar su lectura.
                    </p>
                    <button
                      onClick={() => setIsUploadOpen(true)}
                      className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Subir Documento a este Tema
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          loadData();
          showToast('Documento subido e indexado con éxito');
        }}
        onSeedSamples={handleSeedSamples}
        collections={collections}
        activeCollectionId={activeCollectionId}
        onOpenCreateCollection={handleOpenCreateCollection}
      />

      {/* Export Summaries & Backup Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        documents={documents}
        initialDocumentId={exportTargetDocId}
        initialFormat={exportInitialFormat}
        collections={collections}
        activeCollectionId={activeCollectionId}
        onBackupRestored={() => {
          loadData();
          showToast('Copia de seguridad restaurada correctamente');
        }}
      />

      {/* Collection Create/Edit Modal */}
      <CollectionModal
        isOpen={isColModalOpen}
        onClose={() => {
          setIsColModalOpen(false);
          setColToEdit(null);
        }}
        collectionToEdit={colToEdit}
        onSave={handleSaveCollection}
      />

      {/* Move Document Modal */}
      <MoveDocModal
        isOpen={Boolean(docToMove)}
        onClose={() => setDocToMove(null)}
        document={docToMove}
        collections={collections}
        onMoveSuccess={handleMoveDocSuccess}
      />

      {/* Topic Detail Modal */}
      <TopicDetailModal
        topic={selectedTopicDetail}
        onClose={() => setSelectedTopicDetail(null)}
        onOpenDocumentPage={handleOpenDocumentPage}
      />

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">
              ¿Eliminar documento?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              El archivo <span className="font-semibold text-zinc-900">"{docToDelete.originalName}"</span> y todos sus temas indexados serán eliminados permanentemente del almacenamiento local.
            </p>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-200/80 py-5 bg-white text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900">DocuIndex</span>
            <span aria-hidden="true">·</span>
            <span>Indexador Temático y Base de Datos Local de Documentos PDF</span>
          </div>

          <div className="flex items-center gap-3 text-zinc-500">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span>Privacidad Garantizada: Almacenamiento local en disco</span>
            </div>
            {stats && (
              <>
                <span aria-hidden="true">·</span>
                <span>{stats.totalPages} páginas indexadas en {collections.length} tema(s)</span>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
