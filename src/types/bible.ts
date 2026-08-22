export interface BibleVerse {
  id: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  category?: string;
  reflection?: string;
}

export interface BibleBook {
  id: string;
  name: string;
  testament: "OT" | "NT";
  category: "Pentateuque" | "Histoire" | "Poésie & Sagesse" | "Prophètes" | "Évangiles" | "Actes" | "Épîtres" | "Apocalypse";
  chaptersCount: number;
  shortDesc: string;
  color: string;
}

export interface ReadingPlanItem {
  id: string;
  title: string;
  passage: string;
  estimatedMinutes: number;
  completed: boolean;
  type: "Ancien Testament" | "Nouveau Testament" | "Psaume / Proverbe";
}

export interface MoodTopic {
  id: string;
  title: string;
  emoji: string;
  description: string;
  bgGradient: string;
  verses: BibleVerse[];
}