export interface BookInfo {
  id: string;
  name: string;
  testament: 'OT' | 'NT';
  category: 'Pentateuque' | 'Historique' | 'Poésie & Sagesse' | 'Prophètes' | 'Évangiles' | 'Histoire de l\'Église' | 'Épîtres de Paul' | 'Épîtres Générales' | 'Prophétie';
  chaptersCount: number;
  abbr: string;
  color: string;
  summary: string;
}

export const BIBLE_BOOKS: BookInfo[] = [
  // Ancien Testament
  { id: 'gen', name: 'Genèse', testament: 'OT', category: 'Pentateuque', chaptersCount: 50, abbr: 'Gen', color: 'from-amber-600 to-amber-800', summary: 'Les origines du monde, de l’humanité et du peuple de l’Alliance.' },
  { id: 'exo', name: 'Exode', testament: 'OT', category: 'Pentateuque', chaptersCount: 40, abbr: 'Ex', color: 'from-amber-600 to-amber-800', summary: 'La libération d’Israël hors d’Égypte et le don de la Loi au Sinaï.' },
  { id: 'lev', name: 'Lévitique', testament: 'OT', category: 'Pentateuque', chaptersCount: 27, abbr: 'Lév', color: 'from-amber-600 to-amber-800', summary: 'Les lois de sainteté, les sacrifices et le service des prêtres.' },
  { id: 'nom', name: 'Nombres', testament: 'OT', category: 'Pentateuque', chaptersCount: 36, abbr: 'Nom', color: 'from-amber-600 to-amber-800', summary: 'La marche du peuple à travers le désert vers la Terre Promise.' },
  { id: 'deu', name: 'Deutéronome', testament: 'OT', category: 'Pentateuque', chaptersCount: 34, abbr: 'Deut', color: 'from-amber-600 to-amber-800', summary: 'Les derniers discours de Moïse et le rappel de l’Alliance.' },
  { id: 'jos', name: 'Josué', testament: 'OT', category: 'Historique', chaptersCount: 24, abbr: 'Jos', color: 'from-orange-600 to-amber-700', summary: 'L’entrée et la conquête du pays de Canaan sous la conduite de Josué.' },
  { id: 'jug', name: 'Juges', testament: 'OT', category: 'Historique', chaptersCount: 21, abbr: 'Jug', color: 'from-orange-600 to-amber-700', summary: 'Les cycles d’infidélité, d’oppression et de délivrance par les Juges.' },
  { id: 'rut', name: 'Ruth', testament: 'OT', category: 'Historique', chaptersCount: 4, abbr: 'Ruth', color: 'from-orange-600 to-amber-700', summary: 'Une émouvante histoire de fidélité, de rédemption et de grâce.' },
  { id: '1sa', name: '1 Samuel', testament: 'OT', category: 'Historique', chaptersCount: 31, abbr: '1 Sam', color: 'from-orange-600 to-amber-700', summary: 'L<dyad-write path="src/data/bibleData.ts" description="Bible metadata, sample books, verses, topics and reading plans">
export interface BookInfo {
  id: string;
  name: string;
  testament: 'OT' | 'NT';
  category: string;
  chaptersCount: number;
  abbr: string;
  color: string;
  summary: string;
}

export interface BibleVerseItem {
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

export interface MoodTheme {
  id: string;
  title: string;
  emoji: string;
  color: string;
  versesCount: number;
  description: string;
  verses: BibleVerseItem[];
}

export interface ReadingPlanItem {
  id: string;
  title: string;
  passage: string;
  bookId: string;
  chapter: number;
  estimatedMinutes: number;
  completed: boolean;
  category: 'Ancien Testament' | 'Nouveau Testament' | 'Psaume / Proverbe';
}

export const BIBLE_VERSIONS = [
  { code: 'LSG', name: 'Louis Segond 1910', short: 'LSG', lang: 'Français' },
  { code: 'BDS', name: 'Bible du Semeur', short: 'BDS', lang: 'Français' },
  { code: 'NFC', name: 'Nouvelle Français Courant', short: 'NFC', lang: 'Français' },
  { code: 'TOB', name: 'Traduction Œcuménique', short: 'TOB', lang: 'Français' },
  { code: 'KJV', name: 'King James Version', short: 'KJV', lang: 'English' }
];

export const BIBLE_BOOKS: BookInfo[] = [
  // Ancien Testament
  { id: 'gen', name: 'Genèse', testament: 'OT', category: 'Pentateuque', chaptersCount: 50, abbr: 'Gen', color: 'from-amber-500 to-amber-700', summary: 'Les origines du monde, de l’humanité et du peuple de l’Alliance.' },
  { id: 'exo', name: 'Exode', testament: 'OT', category: 'Pentateuque', chaptersCount: 40, abbr: 'Exo', color: 'from-amber-500 to-amber-700', summary: 'La libération d’Égypte et le don de la Loi au mont Sinaï.' },
  { id: 'lev', name: 'Lévitique', testament: 'OT', category: 'Pentateuque', chaptersCount: 27, abbr: 'Lév', color: 'from-amber-500 to-amber-700', summary: 'Les lois de sainteté et le service des prêtres.' },
  { id: 'nom', name: 'Nombres', testament: 'OT', category: 'Pentateuque', chaptersCount: 36, abbr: 'Nom', color: 'from-amber-500 to-amber-700', summary: 'La traversée du désert vers la Terre promise.' },
  { id: 'deu', name: 'Deutéronome', testament: 'OT', category: 'Pentateuque', chaptersCount: 34, abbr: 'Deut', color: 'from-amber-500 to-amber-700', summary: 'Le rappel de l’Alliance avant l’entrée dans le pays promis.' },
  { id: 'jos', name: 'Josué', testament: 'OT', category: 'Historique', chaptersCount: 24, abbr: 'Jos', color: 'from-orange-500 to-orange-700', summary: 'La conquête et le partage du pays de Canaan.' },
  { id: 'jug', name: 'Juges', testament: 'OT', category: 'Historique', chaptersCount: 21, abbr: 'Jug', color: 'from-orange-500 to-orange-700', summary: 'Les cycles de chute et les héros suscités par Dieu.' },
  { id: 'rut', name: 'Ruth', testament: 'OT', category: 'Historique', chaptersCount: 4, abbr: 'Ruth', color: 'from-orange-500 to-orange-700', summary: 'Une émouvante histoire d’amour, de fidélité et de grâce.' },
  { id: '1sa', name: '1 Samuel', testament: 'OT', category: 'Historique', chaptersCount: 31, abbr: '1 Sam', color: 'from-orange-500 to-orange-700', summary: 'La transition des juges vers la monarchie avec Saül et David.' },
  { id: '2sa', name: '2 Samuel', testament: 'OT', category: 'Historique', chaptersCount: 24, abbr: '2 Sam', color: 'from-orange-500 to-orange-700', summary: 'Le règne glorieux et les épreuves du roi David.' },
  { id: '1ro', name: '1 Rois', testament: 'OT', category: 'Historique', chaptersCount: 22, abbr: '1 Rois', color: 'from-orange-500 to-orange-700', summary: 'Salomon, la construction du Temple et la division du royaume.' },
  { id: '2ro', name: '2 Rois', testament: 'OT', category: 'Historique', chaptersCount: 25, abbr: '2 Rois', color: 'from-orange-500 to-orange-700', summary: 'L’histoire des deux royaumes jusqu’à l’exil à Babylone.' },
  { id: 'job', name: 'Job', testament: 'OT', category: 'Poésie & Sagesse', chaptersCount: 42, abbr: 'Job', color: 'from-emerald-600 to-teal-800', summary: 'La souveraineté de Dieu face à la souffrance de l’innocent.' },
  { id: 'psa', name: 'Psaumes', testament: 'OT', category: 'Poésie & Sagesse', chaptersCount: 150, abbr: 'Ps', color: 'from-emerald-600 to-teal-800', summary: 'Recueil de louanges, de prières, de lamentations et d’actions de grâce.' },
  { id: 'pro', name: 'Proverbes', testament: 'OT', category: 'Poésie & Sagesse', chaptersCount: 31, abbr: 'Prov', color: 'from-emerald-600 to-teal-800', summary: 'Sagesse pratique, discernement moral et crainte de l’Éternel.' },
  { id: 'ecc', name: 'Ecclésiaste', testament: 'OT', category: 'Poésie & Sagesse', chaptersCount: 12, abbr: 'Eccl', color: 'from-emerald-600 to-teal-800', summary: 'Méditation profonde sur le sens de la vie et la vanité des choses terrestres.' },
  { id: 'can', name: 'Cantique des Cantiques', testament: 'OT', category: 'Poésie & Sagesse', chaptersCount: 8, abbr: 'Cant', color: 'from-emerald-600 to-teal-800', summary: 'Célébration poétique de l’amour authentique et passionné.' },
  { id: 'esa', name: 'Ésaïe', testament: 'OT', category: 'Prophètes', chaptersCount: 66, abbr: 'Ésa', color: 'from-blue-600 to-indigo-800', summary: 'Grandes prophéties sur le Messie, le Serviteur souffrant et la Nouvelle Jérusalem.' },
  { id: 'jer', name: 'Jérémie', testament: 'OT', category: 'Prophètes', chaptersCount: 52, abbr: 'Jér', color: 'from-blue-600 to-indigo-800', summary: 'Le prophète des pleurs annonçant la Nouvelle Alliance.' },
  { id: 'dan', name: 'Daniel', testament: 'OT', category: 'Prophètes', chaptersCount: 12, abbr: 'Dan', color: 'from-blue-600 to-indigo-800', summary: 'Fidélité sous l’empire païen et visions apocalyptiques des royaumes.' },
  { id: 'jon', name: 'Jonas', testament: 'OT', category: 'Prophètes', chaptersCount: 4, abbr: 'Jon', color: 'from-blue-600 to-indigo-800', summary: 'La miséricorde sans frontière de Dieu pour les habitants de Ninive.' },

  // Nouveau Testament
  { id: 'mat', name: 'Matthieu', testament: 'NT', category: 'Évangiles', chaptersCount: 28, abbr: 'Matt', color: 'from-rose-600 to-red-800', summary: 'Jésus présenté comme le Messie promis et le Roi du Royaume des Cieux.' },
  { id: 'mar', name: 'Marc', testament: 'NT', category: 'Évangiles', chaptersCount: 16, abbr: 'Marc', color: 'from-rose-600 to-red-800', summary: 'Le récit vivant et dynamique de Jésus, le Serviteur compatissant.' },
  { id: 'luc', name: 'Luc', testament: 'NT', category: 'Évangiles', chaptersCount: 24, abbr: 'Luc', color: 'from-rose-600 to-red-800', summary: 'L’Évangile de la compassion, du salut pour tous et de la joie.' },
  { id: 'jea', name: 'Jean', testament: 'NT', category: 'Évangiles', chaptersCount: 21, abbr: 'Jean', color: 'from-rose-600 to-red-800', summary: 'Jésus, le Verbe fait chair, révélant la vie éternelle et la lumière du monde.' },
  { id: 'act', name: 'Actes', testament: 'NT', category: 'Histoire de l\'Église', chaptersCount: 28, abbr: 'Actes', color: 'from-purple-600 to-indigo-700', summary: 'L’effusion du Saint-Esprit et l’expansion fulgurante de l’Église primitive.' },
  { id: 'rom', name: 'Romains', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 16, abbr: 'Rom', color: 'from-violet-600 to-purple-800', summary: 'L’exposé magistral de la justification par la foi et de la grâce de Dieu.' },
  { id: '1co', name: '1 Corinthiens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 16, abbr: '1 Cor', color: 'from-violet-600 to-purple-800', summary: 'Conseils pratiques sur l’unité, les dons spirituels et l’hymne à l’amour.' },
  { id: '2co', name: '2 Corinthiens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 13, abbr: '2 Cor', color: 'from-violet-600 to-purple-800', summary: 'La puissance de Dieu manifestée dans la faiblesse humaine.' },
  { id: 'gal', name: 'Galates', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 6, abbr: 'Gal', color: 'from-violet-600 to-purple-800', summary: 'La liberté chrétienne affranchie du légalisme par l’Esprit.' },
  { id: 'eph', name: 'Éphésiens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 6, abbr: 'Éph', color: 'from-violet-600 to-purple-800', summary: 'Les richesses en Christ, l’armure spirituelle et l’Église comme corps.' },
  { id: 'phi', name: 'Philippiens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 4, abbr: 'Phil', color: 'from-violet-600 to-purple-800', summary: 'La lettre de la joie inébranlable et de la paix dans toutes circonstances.' },
  { id: 'col', name: 'Colossiens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 4, abbr: 'Col', color: 'from-violet-600 to-purple-800', summary: 'La suprématie absolue et la plénitude du Christ.' },
  { id: '1th', name: '1 Thessaloniciens', testament: 'NT', category: 'Épîtres de Paul', chaptersCount: 5, abbr: '1 Thess', color: 'from-violet-600 to-purple-800', summary: 'L’espérance vivante du retour de notre Seigneur.' },
  { id: 'heb', name: 'Hébreux', testament: 'NT', category: 'Épîtres Générales', chaptersCount: 13, abbr: 'Héb', color: 'from-teal-600 to-cyan-800', summary: 'Le Christ, grand prêtre supérieur, et le monument de la foi.' },
  { id: 'jac', name: 'Jacques', testament: 'NT', category: 'Épîtres Générales', chaptersCount: 5, abbr: 'Jacq', color: 'from-teal-600 to-cyan-800', summary: 'Une foi vivante et authentique manifestée par les œuvres d’amour.' },
  { id: '1pi', name: '1 Pierre', testament: 'NT', category: 'Épîtres Générales', chaptersCount: 5, abbr: '1 Pierre', color: 'from-teal-600 to-cyan-800', summary: 'L’espérance vivante et la persévérance dans l’épreuve.' },
  { id: '1je', name: '1 Jean', testament: 'NT', category: 'Épîtres Générales', chaptersCount: 5, abbr: '1 Jean', color: 'from-teal-600 to-cyan-800', summary: 'Marcher dans la lumière et aimer car Dieu est amour.' },
  { id: 'apo', name: 'Apocalypse', testament: 'NT', category: 'Prophétie', chaptersCount: 22, abbr: 'Apoc', color: 'from-amber-600 to-red-700', summary: 'La victoire finale de l’Agneau et la création d’un ciel nouveau et d’une terre nouvelle.' }
];

export const DAILY_VERSES: BibleVerseItem[] = [
  {
    id: 'v-today-1',
    reference: 'Ésaïe 41:10',
    book: 'Ésaïe',
    chapter: 41,
    verse: 10,
    text: 'Ne crains rien, car je suis avec toi; ne promène pas des regards inquiets, car je suis ton Dieu; je te fortifie, je viens à ton secours, je te soutiens de ma droite triomphante.',
    translation: 'LSG',
    reflection: 'Face aux incertitudes d’aujourd’hui, reposez-vous sur la promesse de la présence constante et inébranlable de Dieu.'
  },
  {
    id: 'v-today-2',
    reference: 'Jean 14:27',
    book: 'Jean',
    chapter: 14,
    verse: 27,
    text: 'Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne s’alarme point.',
    translation: 'LSG',
    reflection: 'La paix que Christ offre surpasse toute circonstance extérieure. Laissez-la garder votre cœur et vos pensées.'
  },
  {
    id: 'v-today-3',
    reference: 'Philippiens 4:6-7',
    book: 'Philippiens',
    chapter: 4,
    verse: 6,
    text: 'Ne vous inquiétez de rien; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces.',
    translation: 'LSG',
    reflection: 'Transformez chaque préoccupation en sujet de prière avec un cœur reconnaissant.'
  },
  {
    id: 'v-today-4',
    reference: 'Psaumes 23:1-3',
    book: 'Psaumes',
    chapter: 23,
    verse: 1,
    text: 'L’Éternel est mon berger: je ne manquerai de rien. Il me fait reposer dans de verts pâturages, Il me dirige près des eaux paisibles. Il restaure mon âme.',
    translation: 'LSG',
    reflection: 'Le bon berger prend soin de chacun de vos besoins et vous guide vers le vrai repos spirituel.'
  }
];

export const THEMES_DATA: MoodTheme[] = [
  {
    id: 'paix',
    title: 'Trouver la Paix',
    emoji: '🕊️',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    versesCount: 24,
    description: 'Apaisez vos pensées et recevez la sérénité divine.',
    verses: [
      {
        id: 'p-1',
        reference: 'Psaume 29:11',
        book: 'Psaumes',
        chapter: 29,
        verse: 11,
        text: 'L’Éternel donne la force à son peuple; L’Éternel bénit son peuple et le rend heureux par la paix.',
        translation: 'LSG'
      },
      {
        id: 'p-2',
        reference: 'Jean 16:33',
        book: 'Jean',
        chapter: 16,
        verse: 33,
        text: 'Je vous ai dit ces choses, afin que vous ayez la paix en moi. Vous aurez des tribulations dans le monde; mais prenez courage, j’ai vaincu le monde.',
        translation: 'LSG'
      }
    ]
  },
  {
    id: 'force',
    title: 'Force & Courage',
    emoji: '🛡️',
    color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    versesCount: 18,
    description: 'Surmontez les épreuves avec l’assurance de Dieu.',
    verses: [
      {
        id: 'f-1',
        reference: 'Josué 1:9',
        book: 'Josué',
        chapter: 1,
        verse: 9,
        text: 'Ne t’ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t’effraie point et ne t’épouvante point, car l’Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras.',
        translation: 'LSG'
      },
      {
        id: 'f-2',
        reference: 'Philippiens 4:13',
        book: 'Philippiens',
        chapter: 4,
        verse: 13,
        text: 'Je puis tout par celui qui me fortifie.',
        translation: 'LSG'
      }
    ]
  },
  {
    id: 'anxiete',
    title: 'Contre l’Anxiété',
    emoji: '🌿',
    color: 'bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-800',
    versesCount: 20,
    description: 'Déposez vos fardeaux et libérez votre esprit du stress.',
    verses: [
      {
        id: 'a-1',
        reference: '1 Pierre 5:7',
        book: '1 Pierre',
        chapter: 5,
        verse: 7,
        text: 'Et déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous.',
        translation: 'LSG'
      },
      {
        id: 'a-2',
        reference: 'Matthieu 6:34',
        book: 'Matthieu',
        chapter: 6,
        verse: 34,
        text: 'Ne vous inquiétez donc pas du lendemain; car le lendemain aura soin de lui-même. À chaque jour suffit sa peine.',
        translation: 'LSG'
      }
    ]
  },
  {
    id: 'amour',
    title: 'Amour & Grâce',
    emoji: '❤️',
    color: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800',
    versesCount: 30,
    description: 'Méditez sur l’immensité de l’amour inconditionnel du Père.',
    verses: [
      {
        id: 'am-1',
        reference: '1 Jean 4:19',
        book: '1 Jean',
        chapter: 4,
        verse: 19,
        text: 'Pour nous, nous l’aimons, parce qu’il nous a aimés le premier.',
        translation: 'LSG'
      },
      {
        id: 'am-2',
        reference: 'Romains 8:38-39',
        book: 'Romains',
        chapter: 8,
        verse: 38,
        text: 'Car j’ai l’assurance que ni la mort ni la vie [...] ne pourra nous séparer de l’amour de Dieu manifesté en Jésus-Christ notre Seigneur.',
        translation: 'LSG'
      }
    ]
  },
  {
    id: 'sagesse',
    title: 'Sagesse & Décision',
    emoji: '💡',
    color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
    versesCount: 16,
    description: 'Trouvez la clarté et la direction pour vos choix de vie.',
    verses: [
      {
        id: 's-1',
        reference: 'Jacques 1:5',
        book: 'Jacques',
        chapter: 1,
        verse: 5,
        text: 'Si quelqu’un d’entre vous manque de sagesse, qu’il la demande à Dieu, qui donne à tous simplement et sans reproche, et elle lui sera donnée.',
        translation: 'LSG'
      },
      {
        id: 's-2',
        reference: 'Proverbes 3:5-6',
        book: 'Proverbes',
        chapter: 3,
        verse: 5,
        text: 'Confie-toi en l’Éternel de tout ton cœur, et ne t’appuie pas sur ta sagesse; reconnais-le dans toutes tes voies, et il aplanira tes sentiers.',
        translation: 'LSG'
      }
    ]
  },
  {
    id: 'esperance',
    title: 'Espérance & Joie',
    emoji: '✨',
    color: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    versesCount: 22,
    description: 'Renouvelez votre joie et gardez les yeux fixés sur les promesses.',
    verses: [
      {
        id: 'e-1',
        reference: 'Romains 15:13',
        book: 'Romains',
        chapter: 15,
        verse: 13,
        text: 'Que le Dieu de l’espérance vous remplisse de toute joie et de toute paix dans la foi, pour que vous abondiez en espérance, par la puissance du Saint-Esprit!',
        translation: 'LSG'
      },
      {
        id: 'e-2',
        reference: 'Jérémie 29:11',
        book: 'Jérémie',
        chapter: 29,
        verse: 11,
        text: 'Car je connais les projets que j’ai formés sur vous, dit l’Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l’espérance.',
        translation: 'LSG'
      }
    ]
  }
];

export const DAILY_READING_PLANS: ReadingPlanItem[] = [
  {
    id: 'plan-1',
    title: 'Le Sermon sur la Montagne',
    passage: 'Matthieu 5',
    bookId: 'mat',
    chapter: 5,
    estimatedMinutes: 5,
    completed: false,
    category: 'Nouveau Testament'
  },
  {
    id: 'plan-2',
    title: 'Le Bon Berger et la Protection',
    passage: 'Psaumes 23',
    bookId: 'psa',
    chapter: 23,
    estimatedMinutes: 3,
    completed: true,
    category: 'Psaume / Proverbe'
  },
  {
    id: 'plan-3',
    title: 'La Création et les Origines',
    passage: 'Genèse 1',
    bookId: 'gen',
    chapter: 1,
    estimatedMinutes: 6,
    completed: false,
    category: 'Ancien Testament'
  },
  {
    id: 'plan-4',
    title: 'L’Hymne à l’Amour',
    passage: '1 Corinthiens 13',
    bookId: '1co',
    chapter: 13,
    estimatedMinutes: 4,
    completed: false,
    category: 'Nouveau Testament'
  }
];

export const SAMPLE_CHAPTER_TEXTS: Record<string, { title: string; verses: { num: number; text: string }[] }> = {
  'psa-23': {
    title: 'Psaume 23 — L’Éternel est mon berger',
    verses: [
      { num: 1, text: "L’Éternel est mon berger: je ne manquerai de rien." },
      { num: 2, text: "Il me fait reposer dans de verts pâturages, Il me dirige près des eaux paisibles." },
      { num: 3, text: "Il restaure mon âme, Il me conduit dans les sentiers de la justice, À cause de son nom." },
      { num: 4, text: "Quand je marche dans la vallée de l’ombre de la mort, Je ne crains aucun mal, car tu es avec moi: Ta houlette et ton bâton me rassurent." },
      { num: 5, text: "Tu dresses devant moi une table, en face de mes adversaires; Tu oins d’huile ma tête, et ma coupe déborde." },
      { num: 6, text: "Oui, le bonheur et la grâce m’accompagneront tous les jours de ma vie, Et j’habiterai dans la maison de l’Éternel jusqu’à la fin de mes jours." }
    ]
  },
  'mat-5': {
    title: 'Matthieu 5 — Les Béatitudes & La Lumière du monde',
    verses: [
      { num: 1, text: "Voyant la foule, Jésus monta sur la montagne; et, après qu’il se fut assis, ses disciples s’approchèrent de lui." },
      { num: 2, text: "Puis, ayant ouvert la bouche, il les enseigna, et dit:" },
      { num: 3, text: "Heureux les pauvres en esprit, car le royaume des cieux est à eux!" },
      { num: 4, text: "Heureux les affligés, car ils seront consolés!" },
      { num: 5, text: "Heureux les débonnaires, car ils hériteront la terre!" },
      { num: 6, text: "Heureux ceux qui ont faim et soif de la justice, car ils seront rassasiés!" },
      { num: 7, text: "Heureux les miséricordieux, car ils obtiendront miséricorde!" },
      { num: 8, text: "Heureux ceux qui ont le cœur pur, car ils verront Dieu!" },
      { num: 9, text: "Heureux ceux qui procurent la paix, car ils seront appelés fils de Dieu!" },
      { num: 14, text: "Vous êtes la lumière du monde. Une ville située sur une montagne ne peut être cachée." },
      { num: 16, text: "Que votre lumière luise ainsi devant les hommes, afin qu’ils voient vos bonnes œuvres, et qu’ils glorifient votre Père qui est dans les cieux." }
    ]
  },
  'jea-1': {
    title: 'Jean 1 — La Parole faite chair',
    verses: [
      { num: 1, text: "Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu." },
      { num: 2, text: "Elle était au commencement avec Dieu." },
      { num: 3, text: "Toutes choses ont été faites par elle, et rien de ce qui a été fait n’a été fait sans elle." },
      { num: 4, text: "En elle était la vie, et la vie était la lumière des hommes." },
      { num: 5, text: "La lumière luit dans les ténèbres, et les ténèbres ne l’ont point reçue." },
      { num: 14, text: "Et la parole a été faite chair, et elle a habité parmi nous, pleine de grâce et de vérité; et nous avons contemplé sa gloire, une gloire comme la gloire du Fils unique venu du Père." }
    ]
  },
  'gen-1': {
    title: 'Genèse 1 — Le commencement et la Création',
    verses: [
      { num: 1, text: "Au commencement, Dieu créa les cieux et la terre." },
      { num: 2, text: "La terre était informe et vide: il y avait des ténèbres à la surface de l’abîme, et l’esprit de Dieu se mouvait au-dessus des eaux." },
      { num: 3, text: "Dieu dit: Que la lumière soit! Et la lumière fut." },
      { num: 4, text: "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d’avec les ténèbres." },
      { num: 5, text: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour." }
    ]
  },
  '1co-13': {
    title: '1 Corinthiens 13 — L’Amour parfait',
    verses: [
      { num: 1, text: "Quand je parlerais les langues des hommes et des anges, si je n’ai pas la charité, je suis un airain qui résonne, ou une cymbale qui retentit." },
      { num: 4, text: "La charité est patiente, elle est pleine de bonté; la charité n’est point envieuse; la charité ne se vante point, elle ne s’enfle point d’orgueil," },
      { num: 7, text: "Elle excuse tout, elle croit tout, elle espère tout, elle supporte tout." },
      { num: 8, text: "La charité ne périt jamais." },
      { num: 13, text: "Maintenant donc ces trois choses demeurent: la foi, l’espérance, la charité; mais la plus grande de ces choses, c’est la charité." }
    ]
  }
};