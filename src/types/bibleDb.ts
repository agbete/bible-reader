export interface DbVerseItem {
  id: number;
  chapter_id?: number;
  verse_number: number;
  reference_code: string;
  text: string;
}

export interface DbBookItem {
  id: number;
  code: string;
  name: string;
  testament_id: number;
  classification_id: number;
  order_index?: number;
  chapters_count: number;
}

export interface DbSearchResult {
  id: number;
  text: string;
  verseId: number;
  verseNumber: number;
  referenceCode: string;
  chapterNumber: number;
  bookId: number;
  bookCode: string;
}

export interface DbLanguage {
  id: number;
  code: string;
  name: string;
}

export interface DbBibleVersion {
  id: number;
  language_id: number;
  code: string;
  name: string;
  short_name: string;
  is_default: boolean;
}

export interface DbStats {
  booksCount: number;
  versesCount: number;
  versionsCount: number;
  chaptersCount: number;
}

export interface DbStatusTable {
  name: string;
  count: number | null;
  status: 'ok' | 'empty' | 'rls_restricted' | 'error';
  error?: string;
}

export interface DbStatusVersion {
  id: number;
  code: string;
  name: string;
  short_name: string;
  is_default: boolean;
}

export interface DbStatusReport {
  connected: boolean;
  timestamp: string;
  tables: DbStatusTable[];
  versions: DbStatusVersion[];
}