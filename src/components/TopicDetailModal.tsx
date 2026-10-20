import React from 'react';
import { X, BookOpen, FileText, ArrowRight } from 'lucide-react';
import { TopicGroup } from '../types';

interface TopicDetailModalProps {
  topic: TopicGroup | null;
  onClose: () => void;
  onOpenDocumentPage: (documentId: string, pageNumber: number) => void;
}

export const TopicDetailModal: React.FC<TopicDetailModalProps> = ({
  topic,
  onClose,
  onOpenDocumentPage,
}) => {
  if (!topic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <span>Tema Indexado</span>
              <span aria-hidden="true">·</span>
              <span>Relevancia {topic.relevanceAvg}%</span>
              <span aria-hidden="true">·</span>
              <span>{topic.totalMentions} menciones</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 tracking-tight">
              {topic.name}
            </h2>
            {topic.description && (
              <p className="text-xs text-zinc-600 mt-1">
                {topic.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Occurrences list */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
            Documentos y Páginas donde se trata este tema ({topic.documents.length})
          </div>

          <div className="space-y-3">
            {topic.documents.map((doc, idx) => (
              <div
                key={`${doc.documentId}-${idx}`}
                className="p-4 rounded-xl border border-zinc-200/90 hover:border-zinc-300 bg-white transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {doc.documentName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.pageNumbers.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          onOpenDocumentPage(doc.documentId, p);
                          onClose();
                        }}
                        className="text-xs font-mono text-zinc-700 bg-zinc-100 hover:bg-zinc-900 hover:text-white px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                        title={`Ir a página ${p}`}
                      >
                        <span>Pág. {p}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>

                {doc.sampleQuotes && doc.sampleQuotes.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-zinc-100 pt-2.5">
                    {doc.sampleQuotes.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="text-xs text-zinc-600 bg-zinc-50/70 p-2.5 rounded-lg border border-zinc-100 flex items-start gap-2"
                      >
                        <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                          [Pág. {q.pageNumber}]
                        </span>
                        <span className="italic">"{q.text}"</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic mt-1">
                    Tratado en las páginas especificadas arriba.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Localizado en la base de datos indexada local
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
