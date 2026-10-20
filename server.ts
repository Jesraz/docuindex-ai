import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Local storage paths for privacy and offline persistence
const STORAGE_DIR = path.resolve(__dirname, 'storage');
const DOCS_DIR = path.resolve(STORAGE_DIR, 'documents');
const DB_FILE = path.resolve(STORAGE_DIR, 'db.json');

// Ensure local storage directories exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer storage for local PDF files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DOCS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se admiten archivos en formato .PDF'));
    }
  },
});

// Gemini SDK initialization
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Database Types
export interface ExtractedTopic {
  id: string;
  name: string;
  description: string;
  relevance: number; // 1-100
  pageNumbers: number[];
  mentionsCount: number;
  sampleQuotes: Array<{ pageNumber: number; text: string }>;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  wordCount: number;
  topics: string[];
}

export interface TopicCollection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
}

export interface DocumentRecord {
  id: string;
  collectionId: string;
  filename: string;
  originalName: string;
  storedPath: string;
  fileSize: number;
  uploadDate: string;
  pageCount: number;
  summary: string;
  topics: ExtractedTopic[];
  pages: ExtractedPage[];
}

export interface DatabaseSchema {
  collections: TopicCollection[];
  documents: DocumentRecord[];
  lastUpdated: string;
}

// Helper: Read local DB with automatic collection migration
function getDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed: DatabaseSchema = JSON.parse(data);

      if (!parsed.collections || !Array.isArray(parsed.collections) || parsed.collections.length === 0) {
        const defaultCol: TopicCollection = {
          id: 'col-vinfopol',
          name: 'Actualizaciones VinfoPOL',
          description: 'Compendio de versiones y actualizaciones del sistema VinfoPOL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          color: 'emerald',
        };
        parsed.collections = [defaultCol];
      }

      const defaultColId = parsed.collections[0].id;
      let needsSave = false;

      if (!parsed.documents) {
        parsed.documents = [];
        needsSave = true;
      }

      for (const doc of parsed.documents) {
        if (!doc.collectionId) {
          doc.collectionId = defaultColId;
          needsSave = true;
        }
      }

      if (needsSave) {
        saveDatabase(parsed);
      }

      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }

  const defaultCol: TopicCollection = {
    id: 'col-vinfopol',
    name: 'Actualizaciones VinfoPOL',
    description: 'Compendio de versiones y actualizaciones del sistema VinfoPOL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    color: 'emerald',
  };

  return { collections: [defaultCol], documents: [], lastUpdated: new Date().toISOString() };
}

// Helper: Write local DB
function saveDatabase(db: DatabaseSchema) {
  db.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Rule-based topic and entity extractor (works 100% offline)
function extractTopicsOffline(pages: ExtractedPage[], originalName: string): { topics: ExtractedTopic[]; summary: string } {
  const stopWords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
    'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o',
    'este', 'sí', 'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre',
    'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
    'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto',
    'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto',
    'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'sea', 'poco', 'ella',
    'the', 'and', 'to', 'of', 'in', 'is', 'for', 'that', 'with', 'on', 'as', 'by', 'at', 'an', 'be', 'this', 'from'
  ]);

  const candidateMap: Map<string, { pages: Set<number>; quotes: Array<{ pageNumber: number; text: string }>; count: number }> = new Map();

  for (const page of pages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines) {
      // Look for headings or bullet points
      const isHeading =
        /^(?:[0-9]+(?:\.[0-9]+)*\s+|capítulo|sección|tema|artículo|anexo|módulo)/i.test(line) ||
        (line.length < 65 && line.length > 5 && (line === line.toUpperCase() || /^[A-ZÁÉÍÓÚÑ]/.test(line)));

      if (isHeading) {
        const cleanName = line.replace(/^[0-9]+(?:\.[0-9]+)*\s*[-:.)]?\s*/, '').trim();
        if (cleanName.length > 3 && cleanName.length < 60) {
          const entry = candidateMap.get(cleanName) || { pages: new Set(), quotes: [], count: 0 };
          entry.pages.add(page.pageNumber);
          entry.count += 2;
          if (entry.quotes.length < 2) {
            entry.quotes.push({ pageNumber: page.pageNumber, text: line });
          }
          candidateMap.set(cleanName, entry);
        }
      }

      // Word frequency analysis for repeated key multi-word or strong nouns
      const words = line
        .toLowerCase()
        .replace(/[^a-záéíóúüñ0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 4 && !stopWords.has(w));

      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
          const titleCaseBigram = bigram.replace(/\b\w/g, (c) => c.toUpperCase());
          const entry = candidateMap.get(titleCaseBigram) || { pages: new Set(), quotes: [], count: 0 };
          entry.pages.add(page.pageNumber);
          entry.count += 1;
          if (entry.quotes.length < 2 && line.length > 20) {
            entry.quotes.push({ pageNumber: page.pageNumber, text: line.slice(0, 140) });
          }
          candidateMap.set(titleCaseBigram, entry);
        }
      }
    }
  }

  // Sort candidates by occurrences & page spread
  const sorted = Array.from(candidateMap.entries())
    .map(([name, data]) => ({
      name,
      pageNumbers: Array.from(data.pages).sort((a, b) => a - b),
      count: data.count,
      quotes: data.quotes,
      score: data.count * 10 + data.pages.size * 20,
    }))
    .filter((c) => c.pageNumbers.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const topics: ExtractedTopic[] = sorted.map((item, idx) => ({
    id: `top-${idx + 1}-${Date.now().toString(36)}`,
    name: item.name,
    description: `Aparición en ${item.pageNumbers.length} página(s) clave del documento`,
    relevance: Math.min(100, Math.max(30, Math.round(item.score * 1.5))),
    pageNumbers: item.pageNumbers,
    mentionsCount: item.count,
    sampleQuotes: item.quotes,
  }));

  const totalWords = pages.reduce((acc, p) => acc + p.wordCount, 0);
  const firstPageSnippet = pages[0]?.text.slice(0, 250).replace(/\s+/g, ' ').trim() || '';
  const summary = `Documento indexado con ${pages.length} página(s) y ${totalWords} palabras. Temas destacados: ${
    topics.slice(0, 3).map((t) => t.name).join(', ') || 'Contenido general'
  }. ${firstPageSnippet ? `Inicio del texto: "${firstPageSnippet}..."` : ''}`;

  return { topics, summary };
}

// AI-powered deep topic indexing using Gemini 3.8 Flash
async function extractTopicsWithGemini(pages: ExtractedPage[], originalName: string): Promise<{ topics: ExtractedTopic[]; summary: string } | null> {
  if (!ai) return null;

  try {
    // Take representative extracts from pages
    const pageSamples = pages.map((p) => {
      const excerpt = p.text.length > 1000 ? p.text.slice(0, 1000) + '...' : p.text;
      return `--- PÁGINA ${p.pageNumber} ---\n${excerpt}`;
    }).slice(0, 15).join('\n\n');

    const prompt = `Analiza el siguiente texto extraído de un documento PDF titulado "${originalName}".
Genera una indexación temática completa y estructurada del documento.

Debes identificar:
1. Un resumen ejecutivo conciso (2-3 oraciones) del documento completo.
2. Los temas principales tratados (entre 4 y 10 temas).
Para cada tema indica:
- name: Nombre claro y profesional del tema (en español, formato Título).
- description: Breve explicación del tema en el contexto del documento.
- relevance: Relevancia de 1 a 100.
- pageNumbers: Lista de números enteros de página donde se trata este tema (exactas).
- sampleQuotes: 1 a 2 citas o frases clave breves del texto con el número de página correspondiente.

Responde ÚNICAMENTE con un JSON válido con este formato:
{
  "summary": "Resumen ejecutivo del documento...",
  "topics": [
    {
      "name": "Nombre del Tema",
      "description": "Descripción de lo tratado en este tema...",
      "relevance": 95,
      "pageNumbers": [1, 2, 4],
      "sampleQuotes": [
        { "pageNumber": 1, "text": "Frase clave extraída de la página" }
      ]
    }
  ]
}

TEXTO EXTRAÍDO:
${pageSamples}`;

    // Use a strict 7-second timeout so the upload request never hangs
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 7000)
    );

    const geminiCall = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response: any = await Promise.race([geminiCall, timeoutPromise]);
    if (!response) {
      console.warn('Gemini topic extraction timed out (7s), falling back to offline indexer');
      return null;
    }

    const jsonText = response.text?.trim() || '';
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText);
    if (!parsed || !Array.isArray(parsed.topics)) return null;

    const topics: ExtractedTopic[] = parsed.topics.map((t: any, idx: number) => ({
      id: `ai-top-${idx + 1}-${Date.now().toString(36)}`,
      name: String(t.name || `Tema ${idx + 1}`).trim(),
      description: String(t.description || '').trim(),
      relevance: Number(t.relevance) || 75,
      pageNumbers: Array.isArray(t.pageNumbers)
        ? t.pageNumbers.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= pages.length)
        : [1],
      mentionsCount: (t.pageNumbers?.length || 1) * 2,
      sampleQuotes: Array.isArray(t.sampleQuotes)
        ? t.sampleQuotes.map((q: any) => ({
            pageNumber: Number(q.pageNumber) || 1,
            text: String(q.text || '').slice(0, 200),
          }))
        : [],
    }));

    return {
      summary: String(parsed.summary || '').trim(),
      topics,
    };
  } catch (err) {
    console.warn('Gemini topic extraction error (falling back to offline indexing):', err);
    return null;
  }
}

// Extract pages from a PDF Buffer using pdf-parse v2
async function extractPdfPages(fileBuffer: Buffer): Promise<ExtractedPage[]> {
  try {
    const parser = new PDFParse({ data: fileBuffer });
    const textResult = await parser.getText();
    await parser.destroy();

    const pages: ExtractedPage[] = [];

    if (textResult && Array.isArray(textResult.pages) && textResult.pages.length > 0) {
      for (const p of textResult.pages) {
        const text = (p.text || '').trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        pages.push({
          pageNumber: p.num,
          text,
          wordCount,
          topics: [],
        });
      }
    } else {
      // Fallback: single page
      const text = (textResult?.text || '').trim();
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      pages.push({
        pageNumber: 1,
        text: text || 'Documento PDF sin texto seleccionable directo.',
        wordCount: wordCount || 1,
        topics: [],
      });
    }

    return pages;
  } catch (err) {
    console.error('Error parsing PDF buffer:', err);
    throw new Error('No se pudo extraer el contenido del archivo PDF. Verifique que sea un PDF válido.');
  }
}

// Seed sample PDFs if database is empty
async function ensureSampleDocuments() {
  const db = getDatabase();
  if (db.documents.length > 0) return;

  try {
    console.log('Generando documentos de demostración iniciales...');
    
    // 1. Document: Guia de Arquitectura Cloud y Microservicios.pdf
    const doc1 = await PDFDocument.create();
    const font = await doc1.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc1.embedFont(StandardFonts.HelveticaBold);

    // Page 1: Introducción
    const page1 = doc1.addPage([600, 800]);
    page1.drawText('Guia de Arquitectura Cloud y Microservicios', { x: 50, y: 740, size: 22, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
    page1.drawText('Fecha: Octubre 2026 | Autor: Equipo de Infraestructura', { x: 50, y: 715, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
    page1.drawText('1. Introduccion y Fundamentos de Despliegue', { x: 50, y: 670, size: 16, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    page1.drawText('La modernizacion de aplicaciones exige arquitecturas resilientes y desacopladas.\nEn este informe se detallan las pautas de contenedores, observabilidad y\nalmacenamiento local seguro.', { x: 50, y: 640, size: 12, font, lineHeight: 18, color: rgb(0.2, 0.2, 0.2) });
    page1.drawText('Conceptos Clave de Resiliencia:', { x: 50, y: 560, size: 14, font: fontBold });
    page1.drawText('- Escalabilidad horizontal sin estado centralizado.\n- Cifrado en reposo para datos confidenciales de usuarios.\n- Almacenamiento local prioritario para operaciones sin conexion.', { x: 50, y: 530, size: 12, font, lineHeight: 18 });

    // Page 2: Bases de Datos y Rendimiento
    const page2 = doc1.addPage([600, 800]);
    page2.drawText('2. Estrategias de Bases de Datos e Indexacion', { x: 50, y: 740, size: 18, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
    page2.drawText('El rendimiento de busqueda se garantiza mediante indexacion tematica e invertida.\nPermitiendo búsquedas instantáneas sobre millones de registros sin sobrecargar\nlos recursos de CPU del servidor.', { x: 50, y: 700, size: 12, font, lineHeight: 18 });
    page2.drawText('Tiempos de latencia objetivo: p95 inferior a 15ms en lecturas locales.\nLa persistencia en disco se realiza con escrituras atomicas en JSON/SQLite.', { x: 50, y: 630, size: 12, font, lineHeight: 18 });

    // Page 3: Inteligencia Artificial y Consultas Semanticas
    const page3 = doc1.addPage([600, 800]);
    page3.drawText('3. Integracion de Inteligencia Artificial para Consultas', { x: 50, y: 740, size: 18, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
    page3.drawText('Los sistemas modernos de Retrieval-Augmented Generation (RAG) combinan el texto\nextraido de archivos PDF con modelos de lenguaje de ultima generacion.\nEsto permite a los analistas realizar preguntas naturales y obtener respuestas\nfundamentadas en citas y numeros de pagina exactos.', { x: 50, y: 690, size: 12, font, lineHeight: 18 });
    page3.drawText('Recomendaciones de Seguridad:\n- No transmitir claves privadas al cliente navegador.\n- Mantener indices locales accesibles en entornos air-gapped.', { x: 50, y: 600, size: 12, font, lineHeight: 18 });

    const pdf1Bytes = await doc1.save();
    const filename1 = 'sample-arquitectura-cloud-2026.pdf';
    const filePath1 = path.join(DOCS_DIR, filename1);
    fs.writeFileSync(filePath1, Buffer.from(pdf1Bytes));

    const pages1 = await extractPdfPages(Buffer.from(pdf1Bytes));
    const extracted1 = extractTopicsOffline(pages1, 'Guia de Arquitectura Cloud y Microservicios.pdf');

    // 2. Document: Informe Sostenibilidad y Eficiencia Energetica.pdf
    const doc2 = await PDFDocument.create();
    const page2_1 = doc2.addPage([600, 800]);
    page2_1.drawText('Informe de Sostenibilidad y Eficiencia 2026', { x: 50, y: 740, size: 22, font: fontBold, color: rgb(0.1, 0.35, 0.2) });
    page2_1.drawText('Resumen Ejecutivo para la Direccion General', { x: 50, y: 715, size: 11, font, color: rgb(0.4, 0.4, 0.4) });
    page2_1.drawText('1. Objetivos de Neutralidad de Carbono', { x: 50, y: 660, size: 16, font: fontBold });
    page2_1.drawText('Durante el ultimo trimestre se redujo la huella de carbono en un 34% mediante\nla migracion de cargas de trabajo a centros de datos con energia 100% renovable.\nEl compromiso hacia 2030 contempla emisiones netas cero.', { x: 50, y: 630, size: 12, font, lineHeight: 18 });

    const page2_2 = doc2.addPage([600, 800]);
    page2_2.drawText('2. Presupuesto y Asignacion de Recursos Verdes', { x: 50, y: 740, size: 18, font: fontBold, color: rgb(0.1, 0.35, 0.2) });
    page2_2.drawText('Se han asignado 2.4 millones de euros a la modernizacion de equipos\nde refrigeracion y paneles solares fotovoltaicos en la sede central.\nRetorno de inversion proyectado: 3.5 anos con un ahorro anual de 420.000 euros.', { x: 50, y: 690, size: 12, font, lineHeight: 18 });

    const pdf2Bytes = await doc2.save();
    const filename2 = 'sample-informe-sostenibilidad-2026.pdf';
    const filePath2 = path.join(DOCS_DIR, filename2);
    fs.writeFileSync(filePath2, Buffer.from(pdf2Bytes));

    const pages2 = await extractPdfPages(Buffer.from(pdf2Bytes));
    const extracted2 = extractTopicsOffline(pages2, 'Informe de Sostenibilidad y Eficiencia 2026.pdf');

    db.documents = [
      {
        id: 'doc-demo-1',
        collectionId: 'col-vinfopol',
        filename: filename1,
        originalName: 'Guia de Arquitectura Cloud y Microservicios.pdf',
        storedPath: filePath1,
        fileSize: pdf1Bytes.length,
        uploadDate: new Date().toISOString(),
        pageCount: pages1.length,
        summary: extracted1.summary,
        topics: extracted1.topics,
        pages: pages1,
      },
      {
        id: 'doc-demo-2',
        collectionId: 'col-vinfopol',
        filename: filename2,
        originalName: 'Informe de Sostenibilidad y Eficiencia 2026.pdf',
        storedPath: filePath2,
        fileSize: pdf2Bytes.length,
        uploadDate: new Date(Date.now() - 3600000).toISOString(),
        pageCount: pages2.length,
        summary: extracted2.summary,
        topics: extracted2.topics,
        pages: pages2,
      },
    ];

    saveDatabase(db);
    console.log('Documentos iniciales generados e indexados correctamente.');
  } catch (err) {
    console.error('Error generating sample documents:', err);
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    storageDir: DOCS_DIR,
  });
});

// GET all collections with statistics
app.get('/api/collections', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const collectionsWithStats = db.collections.map((col) => {
      const colDocs = db.documents.filter((d) => d.collectionId === col.id);
      const documentCount = colDocs.length;
      const pageCount = colDocs.reduce((acc, d) => acc + d.pageCount, 0);
      const topicsSet = new Set(colDocs.flatMap((d) => d.topics.map((t) => t.name.toLowerCase().trim())));
      return {
        ...col,
        documentCount,
        pageCount,
        topicsCount: topicsSet.size,
      };
    });
    res.json({ collections: collectionsWithStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener colecciones' });
  }
});

// POST create new collection / index
app.post('/api/collections', (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del tema o colección es obligatorio.' });
    }

    const db = getDatabase();
    const newCollection: TopicCollection = {
      id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: color || 'indigo',
    };

    db.collections.push(newCollection);
    saveDatabase(db);

    res.status(201).json({ success: true, collection: newCollection });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al crear la colección' });
  }
});

// PUT update collection name / description
app.put('/api/collections/:id', (req: Request, res: Response) => {
  try {
    const { name, description, color } = req.body;
    const db = getDatabase();
    const col = db.collections.find((c) => c.id === req.params.id);
    if (!col) {
      return res.status(404).json({ error: 'Colección no encontrada' });
    }

    if (name && typeof name === 'string' && name.trim()) {
      col.name = name.trim();
    }
    if (description !== undefined) {
      col.description = String(description).trim();
    }
    if (color) {
      col.color = color;
    }
    col.updatedAt = new Date().toISOString();

    saveDatabase(db);
    res.json({ success: true, collection: col });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar colección' });
  }
});

// DELETE collection
app.delete('/api/collections/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    if (db.collections.length <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar la única colección existente.' });
    }

    const colIndex = db.collections.findIndex((c) => c.id === req.params.id);
    if (colIndex === -1) {
      return res.status(404).json({ error: 'Colección no encontrada' });
    }

    // Reassign documents to the first remaining collection
    const targetCollection = db.collections.find((c) => c.id !== req.params.id)!;
    for (const doc of db.documents) {
      if (doc.collectionId === req.params.id) {
        doc.collectionId = targetCollection.id;
      }
    }

    db.collections.splice(colIndex, 1);
    saveDatabase(db);

    res.json({ success: true, message: `Colección eliminada. Los documentos se reasignaron a "${targetCollection.name}".` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al eliminar colección' });
  }
});

// POST move document to another collection
app.post('/api/documents/:id/move', (req: Request, res: Response) => {
  try {
    const { targetCollectionId } = req.body;
    const db = getDatabase();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    const targetCol = db.collections.find((c) => c.id === targetCollectionId);
    if (!targetCol) return res.status(404).json({ error: 'Colección destino no encontrada' });

    doc.collectionId = targetCollectionId;
    saveDatabase(db);

    res.json({ success: true, message: `Documento movido a "${targetCol.name}"` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al mover documento' });
  }
});

// GET all documents (with optional ?collectionId=...)
app.get('/api/documents', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const collectionId = req.query.collectionId as string | undefined;

    let docs = db.documents;
    if (collectionId && collectionId !== 'all') {
      docs = docs.filter((d) => d.collectionId === collectionId);
    }

    // Return documents with stripped page text for fast listing
    const docsSummary = docs.map((d) => ({
      id: d.id,
      collectionId: d.collectionId || db.collections[0]?.id || 'col-vinfopol',
      filename: d.filename,
      originalName: d.originalName,
      fileSize: d.fileSize,
      uploadDate: d.uploadDate,
      pageCount: d.pageCount,
      summary: d.summary,
      topicsCount: d.topics.length,
      topics: d.topics,
    }));
    res.json({ documents: docsSummary });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener documentos' });
  }
});

// GET single document with full pages
app.get('/api/documents/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al consultar documento' });
  }
});

// Serve PDF.js worker locally for offline canvas rendering
app.get('/pdf.worker.min.mjs', (_req: Request, res: Response) => {
  const workerPath = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  if (fs.existsSync(workerPath)) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.sendFile(workerPath);
  }
  res.status(404).send('Worker not found');
});

// GET local PDF file (for direct viewing/download)
app.get('/api/documents/:id/file', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc) {
      return res.status(404).send('Documento no encontrado');
    }

    const filePath = path.resolve(DOCS_DIR, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('El archivo PDF no existe en el almacenamiento local');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.removeHeader('X-Frame-Options');
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    res.status(500).send('Error al servir archivo PDF: ' + err.message);
  }
});

// POST upload PDF
app.post('/api/documents/upload', (req: Request, res: Response) => {
  upload.single('pdf')(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido (40 MB).' });
        }
        return res.status(400).json({ error: `Error en la subida: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error al subir el archivo PDF' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha adjuntado ningún archivo PDF' });
    }

    const tempFilePath = req.file.path;
    const originalName = req.file.originalname;

    const db = getDatabase();
    const targetCollectionId = req.body.collectionId || db.collections[0]?.id || 'col-vinfopol';

    try {
      const fileBuffer = fs.readFileSync(tempFilePath);
      
      // 1. Extract text page by page
      const pages = await extractPdfPages(fileBuffer);

      // 2. Extract topics using AI or fallback to offline engine
      let topicResult = await extractTopicsWithGemini(pages, originalName);
      if (!topicResult || topicResult.topics.length === 0) {
        topicResult = extractTopicsOffline(pages, originalName);
      }

      // 3. Mark topics on pages
      for (const page of pages) {
        const pageTopics = topicResult.topics
          .filter((t) => t.pageNumbers.includes(page.pageNumber))
          .map((t) => t.name);
        page.topics = pageTopics;
      }

      // 4. Save to local database
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newDoc: DocumentRecord = {
        id: docId,
        collectionId: targetCollectionId,
        filename: req.file.filename,
        originalName,
        storedPath: tempFilePath,
        fileSize: req.file.size,
        uploadDate: new Date().toISOString(),
        pageCount: pages.length,
        summary: topicResult.summary,
        topics: topicResult.topics,
        pages,
      };

      const latestDb = getDatabase();
      latestDb.documents.unshift(newDoc);
      saveDatabase(latestDb);

      res.status(201).json({
        success: true,
        document: {
          id: newDoc.id,
          collectionId: newDoc.collectionId,
          filename: newDoc.filename,
          originalName: newDoc.originalName,
          fileSize: newDoc.fileSize,
          uploadDate: newDoc.uploadDate,
          pageCount: newDoc.pageCount,
          summary: newDoc.summary,
          topics: newDoc.topics,
        },
      });
    } catch (processErr: any) {
      console.error('Error procesando archivo PDF:', processErr);
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
      res.status(500).json({ error: processErr.message || 'Error al procesar e indexar el archivo PDF' });
    }
  });
});

// DELETE document
app.delete('/api/documents/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const docIndex = db.documents.findIndex((d) => d.id === req.params.id);
    if (docIndex === -1) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const doc = db.documents[docIndex];
    const filePath = path.resolve(DOCS_DIR, doc.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete file from disk:', e);
      }
    }

    db.documents.splice(docIndex, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Documento eliminado correctamente' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al eliminar documento' });
  }
});

// GET aggregated topics taxonomy across documents (with optional collection filter)
app.get('/api/topics', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const collectionId = req.query.collectionId as string | undefined;

    let targetDocs = db.documents;
    if (collectionId && collectionId !== 'all') {
      targetDocs = targetDocs.filter((d) => d.collectionId === collectionId);
    }

    const topicMap: Map<string, {
      name: string;
      description: string;
      totalMentions: number;
      relevanceAvg: number;
      documents: Array<{
        documentId: string;
        documentName: string;
        pageNumbers: number[];
        sampleQuotes: Array<{ pageNumber: number; text: string }>;
      }>;
    }> = new Map();

    for (const doc of targetDocs) {
      for (const t of doc.topics) {
        const key = t.name.toLowerCase().trim();
        const existing = topicMap.get(key) || {
          name: t.name,
          description: t.description,
          totalMentions: 0,
          relevanceAvg: 0,
          documents: [],
        };

        existing.totalMentions += t.mentionsCount;
        existing.relevanceAvg = Math.max(existing.relevanceAvg, t.relevance);
        existing.documents.push({
          documentId: doc.id,
          documentName: doc.originalName,
          pageNumbers: t.pageNumbers,
          sampleQuotes: t.sampleQuotes || [],
        });

        topicMap.set(key, existing);
      }
    }

    const topicsList = Array.from(topicMap.values()).sort((a, b) => b.totalMentions - a.totalMentions);
    res.json({ topics: topicsList });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener índice de temas' });
  }
});

// POST search across indexed database
app.post('/api/search', (req: Request, res: Response) => {
  try {
    const { query, documentId, topic, collectionId } = req.body;
    if (!query && !topic) {
      return res.status(400).json({ error: 'Se requiere término de búsqueda o tema' });
    }

    const db = getDatabase();
    const qLower = (query || '').toLowerCase().trim();
    const topicLower = (topic || '').toLowerCase().trim();

    const results: Array<{
      documentId: string;
      documentName: string;
      pageNumber: number;
      matchedSnippet: string;
      matchedTopics: string[];
      score: number;
    }> = [];

    for (const doc of db.documents) {
      if (documentId && doc.id !== documentId) continue;
      if (collectionId && collectionId !== 'all' && doc.collectionId !== collectionId) continue;

      for (const page of doc.pages) {
        const textLower = page.text.toLowerCase();
        let matchScore = 0;
        let snippet = '';

        if (topicLower) {
          const hasTopic = page.topics.some((t) => t.toLowerCase().includes(topicLower));
          if (hasTopic) matchScore += 40;
        }

        if (qLower) {
          const index = textLower.indexOf(qLower);
          if (index !== -1) {
            matchScore += 50;
            const start = Math.max(0, index - 80);
            const end = Math.min(page.text.length, index + qLower.length + 100);
            snippet = (start > 0 ? '...' : '') + page.text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < page.text.length ? '...' : '');
          } else {
            // Check individual words
            const terms = qLower.split(/\s+/).filter((t: string) => t.length > 2);
            let termHits = 0;
            for (const term of terms) {
              if (textLower.includes(term)) termHits++;
            }
            if (termHits > 0) {
              matchScore += termHits * 15;
              const firstTerm = terms.find((t: string) => textLower.includes(t))!;
              const idx = textLower.indexOf(firstTerm);
              const start = Math.max(0, idx - 60);
              const end = Math.min(page.text.length, idx + 140);
              snippet = (start > 0 ? '...' : '') + page.text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < page.text.length ? '...' : '');
            }
          }
        }

        if (matchScore > 0) {
          results.push({
            documentId: doc.id,
            documentName: doc.originalName,
            pageNumber: page.pageNumber,
            matchedSnippet: snippet || page.text.slice(0, 160).replace(/\s+/g, ' ').trim() + '...',
            matchedTopics: page.topics,
            score: matchScore,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ results: results.slice(0, 30), totalMatches: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error en búsqueda' });
  }
});

// POST natural language AI query with precise references
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { question, documentId, collectionId } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'La pregunta es requerida' });
    }

    const db = getDatabase();
    let candidateDocs = db.documents;

    if (collectionId && collectionId !== 'all') {
      candidateDocs = candidateDocs.filter((d) => d.collectionId === collectionId);
    }

    if (documentId) {
      candidateDocs = candidateDocs.filter((d) => d.id === documentId);
    }

    if (candidateDocs.length === 0) {
      return res.status(404).json({ error: 'No hay documentos disponibles en este índice para consultar.' });
    }

    // Keyword & semantic scoring to find the top relevant pages across documents
    const qTerms = question.toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    
    interface ScoredPage {
      documentId: string;
      documentName: string;
      pageNumber: number;
      text: string;
      score: number;
    }

    const scoredPages: ScoredPage[] = [];

    for (const doc of candidateDocs) {
      for (const page of doc.pages) {
        const textLower = page.text.toLowerCase();
        let score = 0;

        for (const term of qTerms) {
          if (textLower.includes(term)) {
            score += 10;
          }
        }

        // Check if page topics match question
        for (const topic of page.topics) {
          if (question.toLowerCase().includes(topic.toLowerCase())) {
            score += 25;
          }
        }

        if (score > 0) {
          scoredPages.push({
            documentId: doc.id,
            documentName: doc.originalName,
            pageNumber: page.pageNumber,
            text: page.text,
            score,
          });
        }
      }
    }

    // Sort and pick top 6 most relevant pages
    scoredPages.sort((a, b) => b.score - a.score);
    const topPages = scoredPages.slice(0, 6);

    // If no pages scored, take first 2 pages of first documents as fallback
    const contextPages = topPages.length > 0 ? topPages : candidateDocs.slice(0, 2).flatMap((d) => d.pages.slice(0, 2).map((p) => ({
      documentId: d.id,
      documentName: d.originalName,
      pageNumber: p.pageNumber,
      text: p.text,
      score: 1,
    })));

    // Prepare context for Gemini
    const contextString = contextPages.map((cp, idx) => `
[PASIVA ${idx + 1}]
Documento: "${cp.documentName}" (ID: ${cp.documentId})
Página: ${cp.pageNumber}
Contenido:
${cp.text.slice(0, 1500)}
`).join('\n\n');

    let answerText = '';
    let citations: Array<{
      documentId: string;
      documentName: string;
      pageNumber: number;
      snippet: string;
    }> = [];

    if (ai) {
      const prompt = `Eres un asistente de investigación documental preciso, analítico y profesional.
El usuario realiza la siguiente pregunta en español sobre el contenido extraído de sus documentos PDF:
"${question}"

Utiliza ÚNICAMENTE la siguiente información extraída de los documentos para responder.
INSTRUCCIONES CLAVE:
1. Responde de forma clara, directa y estructurada en español.
2. Cada afirmación importante debe incluir su referencia exacta en el texto en formato [Documento: 'Nombre', Pág. X].
3. Si la información solicitada no está presente en los fragmentos, indícalo honestamente sin inventar datos.
4. Además de tu respuesta explicativa, genera una lista de referencias directas estructuradas.

Devuelve la respuesta en formato JSON con la siguiente estructura:
{
  "answer": "Texto de la respuesta detallada y profesional con referencias en línea...",
  "citations": [
    {
      "documentId": "id-del-documento",
      "documentName": "Nombre exacto del PDF",
      "pageNumber": 2,
      "snippet": "Frase textual o extracto relevante de dicha página"
    }
  ]
}

FRAGMENTOS DE DOCUMENTOS:
${contextString}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text?.trim() || '{}');
        answerText = parsed.answer || '';
        citations = Array.isArray(parsed.citations) ? parsed.citations : [];
      } catch (geminiError: any) {
        console.warn('Gemini query initial error, retrying once...', geminiError?.status || geminiError?.message);
        try {
          await new Promise((r) => setTimeout(r, 600));
          const retryRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });
          const parsed = JSON.parse(retryRes.text?.trim() || '{}');
          answerText = parsed.answer || '';
          citations = Array.isArray(parsed.citations) ? parsed.citations : [];
        } catch (retryErr) {
          console.warn('Gemini retry also failed, generating high-precision local semantic answer:', retryErr);
        }
      }
    }

    // High-precision local semantic fallback if Gemini unavailable or busy
    if (!answerText) {
      if (contextPages.length > 0) {
        const topQuotes: string[] = [];
        citations = [];

        for (const cp of contextPages.slice(0, 3)) {
          const lines = cp.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 15);
          // Find lines with query terms
          const relevantLines = lines.filter((l) => {
            const lLow = l.toLowerCase();
            return qTerms.some((t) => lLow.includes(t));
          });

          const excerpt = (relevantLines.length > 0 ? relevantLines.slice(0, 3).join('\n') : cp.text.slice(0, 250)).trim();
          topQuotes.push(`• De "${cp.documentName}" [Pág. ${cp.pageNumber}]:\n  "${excerpt}"`);

          citations.push({
            documentId: cp.documentId,
            documentName: cp.documentName,
            pageNumber: cp.pageNumber,
            snippet: excerpt.slice(0, 160) + (excerpt.length > 160 ? '...' : ''),
          });
        }

        answerText = `A partir del análisis de los documentos indexados localmente, se identificaron los siguientes puntos relevantes para tu consulta:\n\n${topQuotes.join('\n\n')}\n\nPuedes pulsar en cualquiera de las referencias para visualizar la página exacta en el lector.`;
      } else {
        answerText = 'No se encontraron referencias directas sobre esa consulta en los documentos indexados.';
        citations = [];
      }
    }

    // Ensure citations match existing documents
    const validatedCitations = citations.map((c) => {
      const matchDoc = db.documents.find((d) => d.id === c.documentId || d.originalName === c.documentName);
      return {
        documentId: matchDoc ? matchDoc.id : c.documentId,
        documentName: matchDoc ? matchDoc.originalName : c.documentName,
        pageNumber: Number(c.pageNumber) || 1,
        snippet: c.snippet || '',
      };
    });

    res.json({
      answer: answerText,
      citations: validatedCitations,
      matchedPagesCount: contextPages.length,
    });
  } catch (err: any) {
    console.error('Error in query endpoint:', err);
    res.status(500).json({ error: err.message || 'Error procesando la consulta' });
  }
});

// POST seed sample documents endpoint
app.post('/api/seed-samples', async (_req: Request, res: Response) => {
  try {
    await ensureSampleDocuments();
    const db = getDatabase();
    res.json({ success: true, count: db.documents.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al generar muestras' });
  }
});

// GET stats
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const totalDocs = db.documents.length;
    const totalPages = db.documents.reduce((acc, d) => acc + d.pageCount, 0);
    const allTopics = new Set(db.documents.flatMap((d) => d.topics.map((t) => t.name.toLowerCase().trim())));
    const totalBytes = db.documents.reduce((acc, d) => acc + d.fileSize, 0);

    res.json({
      totalDocs,
      totalPages,
      totalTopics: allTopics.size,
      totalCollections: db.collections.length,
      totalBytes,
      storagePath: DOCS_DIR,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Generate publication-grade Markdown export
function generateMarkdownExport(docs: DocumentRecord[]): string {
  const now = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const totalPages = docs.reduce((acc, d) => acc + d.pageCount, 0);
  const totalWords = docs.reduce(
    (acc, d) => acc + d.pages.reduce((pAcc, p) => pAcc + p.wordCount, 0),
    0
  );

  let md = `# Compendio de Resúmenes e Índice Temático
**Generado por DocuIndex AI** · Base de Conocimiento Local
**Fecha:** ${now}
**Documentos indexados:** ${docs.length} | **Páginas:** ${totalPages} | **Palabras:** ${totalWords.toLocaleString('es-ES')}

---

## Tabla de Contenidos
${docs.map((d, i) => `${i + 1}. [${d.originalName}](#${d.originalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`).join('\n')}

---
`;

  docs.forEach((doc, idx) => {
    const fileSizeKb = (doc.fileSize / 1024).toFixed(1);
    const dateFormatted = new Date(doc.uploadDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    md += `\n## ${idx + 1}. ${doc.originalName}\n\n`;
    md += `| Metadato | Valor |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Archivo local** | \`${doc.filename}\` |\n`;
    md += `| **Páginas** | ${doc.pageCount} |\n`;
    md += `| **Tamaño** | ${fileSizeKb} KB |\n`;
    md += `| **Fecha de indexación** | ${dateFormatted} |\n`;
    md += `| **Temas identificados** | ${doc.topics.length} |\n\n`;

    md += `### Resumen Ejecutivo\n\n`;
    md += `> ${doc.summary.replace(/\n+/g, '\n> ')}\n\n`;

    if (doc.topics && doc.topics.length > 0) {
      md += `### Temas Tratados y Referencias Precisas\n\n`;
      doc.topics.forEach((topic) => {
        const pagesStr = topic.pageNumbers.join(', ');
        md += `- **${topic.name}** *(Relevancia: ${topic.relevance}% · Págs: ${pagesStr})*\n`;
        if (topic.description) {
          md += `  - *Contexto:* ${topic.description}\n`;
        }
        if (topic.sampleQuotes && topic.sampleQuotes.length > 0) {
          topic.sampleQuotes.forEach((q) => {
            md += `  - *Cita [Pág. ${q.pageNumber}]:* "${q.text.trim()}"\n`;
          });
        }
      });
      md += '\n';
    }

    md += `---\n`;
  });

  md += `\n*Documento exportado automáticamente desde el almacenamiento local de DocuIndex AI.*\n`;
  return md;
}

// Helper: Generate clean Plain Text export
function generatePlainTextExport(docs: DocumentRecord[]): string {
  const now = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const totalPages = docs.reduce((acc, d) => acc + d.pageCount, 0);

  const divider = '='.repeat(80);
  const subDivider = '-'.repeat(80);

  let txt = `${divider}\n`;
  txt += `DOCUINDEX AI - COMPENDIO DE RESÚMENES E ÍNDICE TEMÁTICO\n`;
  txt += `Base de Conocimiento Local y Privada\n`;
  txt += `Fecha: ${now} | Documentos: ${docs.length} | Páginas totales: ${totalPages}\n`;
  txt += `${divider}\n\n`;

  txt += `ÍNDICE GENERAL:\n`;
  docs.forEach((d, i) => {
    txt += `  [${i + 1}] ${d.originalName} (${d.pageCount} págs.)\n`;
  });
  txt += `\n${subDivider}\n\n`;

  docs.forEach((doc, idx) => {
    const fileSizeKb = (doc.fileSize / 1024).toFixed(1);
    const dateFormatted = new Date(doc.uploadDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    txt += `[${idx + 1}] ${doc.originalName.toUpperCase()}\n`;
    txt += `Archivo local: ${doc.filename}\n`;
    txt += `Páginas: ${doc.pageCount} | Tamaño: ${fileSizeKb} KB | Fecha: ${dateFormatted}\n\n`;

    txt += `RESUMEN:\n`;
    txt += `${doc.summary}\n\n`;

    if (doc.topics && doc.topics.length > 0) {
      txt += `TEMAS TRATADOS Y PÁGINAS:\n`;
      doc.topics.forEach((topic) => {
        txt += `  * ${topic.name} [Págs: ${topic.pageNumbers.join(', ')} | Relevancia: ${topic.relevance}%]\n`;
        if (topic.description) {
          txt += `    Contexto: ${topic.description}\n`;
        }
        if (topic.sampleQuotes && topic.sampleQuotes.length > 0) {
          topic.sampleQuotes.forEach((q) => {
            txt += `    Cita (Pág. ${q.pageNumber}): "${q.text.trim()}"\n`;
          });
        }
      });
      txt += '\n';
    }

    txt += `${subDivider}\n\n`;
  });

  txt += `Exportado desde DocuIndex AI.\n`;
  return txt;
}

// GET export endpoint (supports markdown, plain text, and complete json backup)
app.get('/api/export', (req: Request, res: Response) => {
  try {
    const rawFormat = (req.query.format as string)?.toLowerCase();
    const format = rawFormat === 'json' ? 'json' : rawFormat === 'txt' ? 'txt' : 'md';
    const documentId = req.query.documentId as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;
    const isDownload = req.query.download === 'true' || req.query.download === '1';

    const db = getDatabase();
    let targetDocs = db.documents;

    if (collectionId && collectionId !== 'all') {
      targetDocs = targetDocs.filter((d) => d.collectionId === collectionId);
    }

    if (documentId) {
      targetDocs = targetDocs.filter((d) => d.id === documentId);
      if (targetDocs.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado para exportar' });
      }
    }

    if (targetDocs.length === 0) {
      return res.status(400).json({ error: 'No hay documentos para exportar en esta selección' });
    }

    const isSingle = targetDocs.length === 1;
    const targetCol = collectionId && collectionId !== 'all' ? db.collections.find((c) => c.id === collectionId) : null;
    const safeDocName = isSingle
      ? targetDocs[0].originalName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]/g, '_')
      : (targetCol ? targetCol.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() : 'compendio_resumenes_docuindex');

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${safeDocName}_${dateStr}.${format}`;

    let content = '';
    let contentType = 'text/plain; charset=utf-8';

    if (format === 'json') {
      const uniqueTopics = new Set<string>();
      targetDocs.forEach((d) => {
        d.topics?.forEach((t) => uniqueTopics.add(t.name));
      });
      const totalPages = targetDocs.reduce((acc, d) => acc + (d.pageCount || 0), 0);
      const totalBytes = targetDocs.reduce((acc, d) => acc + (d.fileSize || 0), 0);

      const backupData = {
        backupVersion: '1.0',
        exportedAt: new Date().toISOString(),
        appName: 'DocuIndex Multi-Tema',
        description: targetCol
          ? `Copia de seguridad completa del índice temático "${targetCol.name}"`
          : 'Copia de seguridad completa de la base de datos documental',
        scope: collectionId || 'all',
        collection: targetCol || null,
        collections: collectionId === 'all' ? db.collections : [targetCol].filter(Boolean),
        summaryStats: {
          documentsCount: targetDocs.length,
          totalPages,
          topicsCount: uniqueTopics.size,
          totalBytes,
        },
        documents: targetDocs,
      };

      content = JSON.stringify(backupData, null, 2);
      contentType = 'application/json; charset=utf-8';
    } else if (format === 'txt') {
      content = generatePlainTextExport(targetDocs);
      contentType = 'text/plain; charset=utf-8';
    } else {
      content = generateMarkdownExport(targetDocs);
      contentType = 'text/markdown; charset=utf-8';
    }

    if (isDownload) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(content);
    }

    // Return as JSON for preview and copy
    res.json({
      format,
      filename,
      content,
      documentsCount: targetDocs.length,
    });
  } catch (err: any) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message || 'Error al generar la exportación' });
  }
});

// Dedicated Database Backup endpoint for selected index or entire database
app.get('/api/backup', (req: Request, res: Response) => {
  try {
    const collectionId = (req.query.collectionId as string) || 'all';
    const isDownload = req.query.download === 'true' || req.query.download === '1';

    const db = getDatabase();
    let targetDocs = db.documents;
    let targetCol: TopicCollection | null = null;

    if (collectionId && collectionId !== 'all') {
      targetCol = db.collections.find((c) => c.id === collectionId) || null;
      if (!targetCol) {
        return res.status(404).json({ error: 'Índice temático no encontrado para respaldar' });
      }
      targetDocs = targetDocs.filter((d) => d.collectionId === collectionId);
    }

    const uniqueTopics = new Set<string>();
    targetDocs.forEach((d) => {
      d.topics?.forEach((t) => uniqueTopics.add(t.name));
    });

    const totalPages = targetDocs.reduce((acc, d) => acc + (d.pageCount || 0), 0);
    const totalBytes = targetDocs.reduce((acc, d) => acc + (d.fileSize || 0), 0);

    const safeName = targetCol
      ? targetCol.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()
      : 'toda_la_base_de_datos';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `respaldo_${safeName}_${dateStr}.json`;

    const backupPayload = {
      backupVersion: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'DocuIndex Multi-Tema',
      description: targetCol
        ? `Copia de seguridad completa del índice temático "${targetCol.name}"`
        : 'Copia de seguridad completa de todos los índices temáticos y documentos',
      scope: collectionId,
      collection: targetCol,
      collections: collectionId === 'all' ? db.collections : [targetCol].filter(Boolean),
      summaryStats: {
        documentsCount: targetDocs.length,
        totalPages,
        topicsCount: uniqueTopics.size,
        totalBytes,
      },
      documents: targetDocs,
    };

    if (isDownload) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(backupPayload, null, 2));
    }

    return res.json({
      success: true,
      filename,
      data: backupPayload,
    });
  } catch (err: any) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message || 'Error al generar el respaldo de la base de datos' });
  }
});

// Restore backup endpoint
app.post('/api/backup/restore', (req: Request, res: Response) => {
  try {
    const backup = req.body;
    if (!backup || !backup.documents || !Array.isArray(backup.documents)) {
      return res.status(400).json({ error: 'Archivo de respaldo inválido. Debe contener una lista de documentos válida.' });
    }

    const db = getDatabase();
    let targetColId: string;
    let targetCol: TopicCollection;

    if (backup.collection && backup.collection.name) {
      const existing = db.collections.find(
        (c) => c.id === backup.collection.id || c.name.trim().toLowerCase() === backup.collection.name.trim().toLowerCase()
      );
      if (existing) {
        targetColId = existing.id;
        targetCol = existing;
      } else {
        targetColId = backup.collection.id || `col-${Date.now()}`;
        targetCol = {
          id: targetColId,
          name: backup.collection.name,
          description: backup.collection.description || 'Índice restaurado desde respaldo JSON',
          color: backup.collection.color || 'blue',
          createdAt: backup.collection.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.collections.push(targetCol);
      }
    } else {
      targetColId = db.collections[0]?.id || 'col-vinfopol';
      targetCol = db.collections[0];
    }

    let restoredCount = 0;
    for (const doc of backup.documents) {
      if (!doc || !doc.originalName) continue;
      doc.collectionId = targetColId;
      const existingIndex = db.documents.findIndex((d) => d.id === doc.id);
      if (existingIndex >= 0) {
        db.documents[existingIndex] = { ...db.documents[existingIndex], ...doc };
      } else {
        db.documents.unshift(doc);
      }
      restoredCount++;
    }

    saveDatabase(db);

    res.json({
      success: true,
      message: `Respaldo restaurado con éxito: ${restoredCount} documentos integrados en "${targetCol.name}".`,
      collection: targetCol,
      documentsCount: restoredCount,
    });
  } catch (err: any) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message || 'Error al restaurar la base de datos' });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static serving setup
// -------------------------------------------------------------
async function startServer() {
  // Generate sample documents if database is initially empty
  await ensureSampleDocuments();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DocuIndex Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
