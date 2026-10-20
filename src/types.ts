export interface TopicCollection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  pageCount?: number;
  topicsCount?: number;
  color?: string;
}

export interface ExtractedTopic {
  id: string;
  name: string;
  description: string;
  relevance: number;
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

export interface DocumentSummary {
  id: string;
  filename: string;
  originalName: string;
  collectionId: string;
  fileSize: number;
  uploadDate: string;
  pageCount: number;
  summary: string;
  topicsCount: number;
  topics: ExtractedTopic[];
}

export interface DocumentDetail extends DocumentSummary {
  pages: ExtractedPage[];
  storedPath?: string;
}

export interface TopicGroup {
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
}

export interface SearchResultItem {
  documentId: string;
  documentName: string;
  pageNumber: number;
  matchedSnippet: string;
  matchedTopics: string[];
  score: number;
}

export interface CitationReference {
  documentId: string;
  documentName: string;
  pageNumber: number;
  snippet: string;
}

export interface QueryHistoryItem {
  id: string;
  question: string;
  answer: string;
  citations: CitationReference[];
  timestamp: string;
  documentId?: string;
  collectionId?: string;
}

export interface SystemStats {
  totalDocs: number;
  totalPages: number;
  totalTopics: number;
  totalCollections: number;
  totalBytes: number;
  storagePath: string;
}

export interface IndexBackupData {
  backupVersion: string;
  exportedAt: string;
  appName: string;
  description: string;
  scope: string;
  collection: TopicCollection | null;
  collections?: TopicCollection[];
  summaryStats: {
    documentsCount: number;
    totalPages: number;
    topicsCount: number;
    totalBytes: number;
  };
  documents: DocumentDetail[];
}

