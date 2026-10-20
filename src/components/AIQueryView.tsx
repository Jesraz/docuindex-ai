import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  FileText,
  HelpCircle,
  Copy,
  Check,
  ArrowRight,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { DocumentSummary, CitationReference, QueryHistoryItem, TopicCollection } from '../types';
import { Folder } from 'lucide-react';

interface AIQueryViewProps {
  documents: DocumentSummary[];
  onOpenDocumentPage: (documentId: string, pageNumber: number, highlightSnippet?: string) => void;
  initialTopicQuery?: string;
  collections: TopicCollection[];
  activeCollectionId: string;
}

export const AIQueryView: React.FC<AIQueryViewProps> = ({
  documents,
  onOpenDocumentPage,
  initialTopicQuery,
  collections,
  activeCollectionId,
}) => {
  const [question, setQuestion] = useState(
    initialTopicQuery ? `¿Qué información se detalla sobre "${initialTopicQuery}" en los documentos?` : ''
  );
  const [selectedColId, setSelectedColId] = useState<string>(activeCollectionId);
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync with active collection
  React.useEffect(() => {
    setSelectedColId(activeCollectionId);
  }, [activeCollectionId]);

  const sampleQuestions = [
    '¿Cuáles son las directrices principales de arquitectura y resiliencia?',
    '¿Qué presupuesto o asignación de recursos se detalla en los informes?',
    '¿Cuál es el resumen ejecutivo y los compromisos a 2030?',
    '¿Qué medidas de seguridad y almacenamiento local se recomiendan?',
  ];

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          documentId: selectedDocId === 'all' ? undefined : selectedDocId,
          collectionId: selectedColId === 'all' ? undefined : selectedColId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al procesar la consulta con IA');
      }

      const data = await response.json();

      const newItem: QueryHistoryItem = {
        id: `q-${Date.now()}`,
        question: q,
        answer: data.answer || 'No se obtuvo respuesta del modelo.',
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        documentId: selectedDocId === 'all' ? undefined : selectedDocId,
      };

      setHistory((prev) => [newItem, ...prev]);
      setQuestion('');
    } catch (err: any) {
      console.error('AI Query error:', err);
      setError(err.message || 'Error al consultar la inteligencia artificial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-zinc-200/80 pb-6 text-center sm:text-left">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Motor de Razonamiento Documental</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Consultas en Lenguaje Natural con Citas Exactas
        </h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
          Realiza preguntas sobre el contenido indexado. Cada respuesta cita el documento y la página precisa, permitiendo abrirla de inmediato.
        </p>
      </div>

      {/* Query Input Box */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label htmlFor="question-input" className="text-xs font-semibold text-zinc-700">
            Formula tu pregunta:
          </label>

          {/* Scope Selectors */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            {/* Collection Filter */}
            <div className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-emerald-600" />
              <span>Índice:</span>
              <select
                value={selectedColId}
                onChange={(e) => {
                  setSelectedColId(e.target.value);
                  setSelectedDocId('all');
                }}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 max-w-[170px] truncate"
              >
                <option value="all">Todos los índices</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <span>Documento:</span>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 max-w-[170px] truncate"
              >
                <option value="all">
                  Todos ({selectedColId === 'all' ? documents.length : documents.filter((d) => d.collectionId === selectedColId).length})
                </option>
                {(selectedColId === 'all' ? documents : documents.filter((d) => d.collectionId === selectedColId)).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.originalName.length > 30 ? d.originalName.slice(0, 27) + '...' : d.originalName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Text Input & Submit */}
        <div className="relative">
          <textarea
            id="question-input"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ejemplo: ¿Cuáles son las medidas sobre reducción de emisiones y presupuesto verde?"
            className="w-full p-3.5 bg-zinc-50/50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none transition-all"
          />

          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-zinc-400">
              Presiona <kbd className="font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">Enter</kbd> para consultar
            </span>

            <button
              onClick={() => handleAsk()}
              disabled={isLoading || !question.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Consultando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Preguntar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sample Suggestions */}
        <div className="pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
            <HelpCircle className="w-3 h-3 text-zinc-400" />
            <span>Sugerencias de consulta rápida:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuestion(sq);
                  handleAsk(sq);
                }}
                disabled={isLoading}
                className="text-xs text-left bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Query Results & Conversation Flow */}
      <div className="space-y-6">
        {history.length === 0 && !isLoading && (
          <div className="p-8 text-center bg-zinc-50/70 rounded-xl border border-zinc-200/80">
            <Sparkles className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-800">
              Aún no has realizado consultas en esta sesión
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Escribe una pregunta arriba o pulsa sobre una de las sugerencias para ver cómo la IA analiza y extrae respuestas con citas precisas.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="p-8 bg-white rounded-xl border border-zinc-200 shadow-xs flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
            <p className="text-xs font-medium text-zinc-700">
              Analizando pasajes indexados y contrastando referencias con Gemini...
            </p>
          </div>
        )}

        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden"
          >
            {/* Question Header */}
            <div className="px-5 py-3.5 bg-zinc-50/80 border-b border-zinc-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-zinc-900">
                  {item.question}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                {item.timestamp}
              </span>
            </div>

            {/* Answer Body */}
            <div className="p-5 space-y-4">
              <div className="text-sm text-zinc-800 leading-relaxed whitespace-pre-line font-normal">
                {item.answer}
              </div>

              {/* Citations Box (Visual precise references) */}
              {item.citations && item.citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Referencias precisas encontradas ({item.citations.length})
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Haz clic para abrir el documento en dicha página
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {item.citations.map((cite, cIdx) => (
                      <div
                        key={cIdx}
                        onClick={() =>
                          onOpenDocumentPage(cite.documentId, cite.pageNumber, cite.snippet)
                        }
                        className="p-3 rounded-lg border border-zinc-200/80 bg-zinc-50/60 hover:bg-zinc-100 hover:border-zinc-300 transition-all cursor-pointer group text-left"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 truncate">
                            <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{cite.documentName}</span>
                          </div>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-white shrink-0 group-hover:bg-zinc-800 transition-colors">
                            Pág. {cite.pageNumber}
                          </span>
                        </div>

                        {cite.snippet && (
                          <p className="text-xs text-zinc-600 line-clamp-2 italic mt-1">
                            "{cite.snippet}"
                          </p>
                        )}

                        <div className="mt-2 text-[11px] text-zinc-600 font-medium flex items-center gap-1 group-hover:text-zinc-900 transition-colors">
                          <BookOpen className="w-3 h-3" />
                          <span>Abrir visor en Pág. {cite.pageNumber}</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <span className="text-[11px]">
                  Respuesta fundamentada en extracción local
                </span>

                <button
                  onClick={() => handleCopy(item.id, `${item.question}\n\n${item.answer}`)}
                  className="flex items-center gap-1 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar respuesta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
