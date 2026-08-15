export type Testament = "old" | "new";

export type BibleBook = {
  number: number;
  id: string;
  ko: string;
  short: string;
  en: string;
  chapters: number;
  testament: Testament;
};

const old: Omit<BibleBook, "number" | "testament">[] = [
  { id: "gen", ko: "창세기", short: "창", en: "Genesis", chapters: 50 },
  { id: "exo", ko: "출애굽기", short: "출", en: "Exodus", chapters: 40 },
  { id: "lev", ko: "레위기", short: "레", en: "Leviticus", chapters: 27 },
  { id: "num", ko: "민수기", short: "민", en: "Numbers", chapters: 36 },
  { id: "deu", ko: "신명기", short: "신", en: "Deuteronomy", chapters: 34 },
  { id: "jos", ko: "여호수아", short: "수", en: "Joshua", chapters: 24 },
  { id: "jdg", ko: "사사기", short: "삿", en: "Judges", chapters: 21 },
  { id: "rut", ko: "룻기", short: "룻", en: "Ruth", chapters: 4 },
  { id: "1sa", ko: "사무엘상", short: "삼상", en: "1 Samuel", chapters: 31 },
  { id: "2sa", ko: "사무엘하", short: "삼하", en: "2 Samuel", chapters: 24 },
  { id: "1ki", ko: "열왕기상", short: "왕상", en: "1 Kings", chapters: 22 },
  { id: "2ki", ko: "열왕기하", short: "왕하", en: "2 Kings", chapters: 25 },
  { id: "1ch", ko: "역대상", short: "대상", en: "1 Chronicles", chapters: 29 },
  { id: "2ch", ko: "역대하", short: "대하", en: "2 Chronicles", chapters: 36 },
  { id: "ezr", ko: "에스라", short: "스", en: "Ezra", chapters: 10 },
  { id: "neh", ko: "느헤미야", short: "느", en: "Nehemiah", chapters: 13 },
  { id: "est", ko: "에스더", short: "에", en: "Esther", chapters: 10 },
  { id: "job", ko: "욥기", short: "욥", en: "Job", chapters: 42 },
  { id: "psa", ko: "시편", short: "시", en: "Psalms", chapters: 150 },
  { id: "pro", ko: "잠언", short: "잠", en: "Proverbs", chapters: 31 },
  { id: "ecc", ko: "전도서", short: "전", en: "Ecclesiastes", chapters: 12 },
  { id: "sng", ko: "아가", short: "아", en: "Song of Songs", chapters: 8 },
  { id: "isa", ko: "이사야", short: "사", en: "Isaiah", chapters: 66 },
  { id: "jer", ko: "예레미야", short: "렘", en: "Jeremiah", chapters: 52 },
  { id: "lam", ko: "예레미야애가", short: "애", en: "Lamentations", chapters: 5 },
  { id: "ezk", ko: "에스겔", short: "겔", en: "Ezekiel", chapters: 48 },
  { id: "dan", ko: "다니엘", short: "단", en: "Daniel", chapters: 12 },
  { id: "hos", ko: "호세아", short: "호", en: "Hosea", chapters: 14 },
  { id: "jol", ko: "요엘", short: "욜", en: "Joel", chapters: 3 },
  { id: "amo", ko: "아모스", short: "암", en: "Amos", chapters: 9 },
  { id: "oba", ko: "오바댜", short: "옵", en: "Obadiah", chapters: 1 },
  { id: "jon", ko: "요나", short: "욘", en: "Jonah", chapters: 4 },
  { id: "mic", ko: "미가", short: "미", en: "Micah", chapters: 7 },
  { id: "nah", ko: "나훔", short: "나", en: "Nahum", chapters: 3 },
  { id: "hab", ko: "하박국", short: "합", en: "Habakkuk", chapters: 3 },
  { id: "zep", ko: "스바냐", short: "습", en: "Zephaniah", chapters: 3 },
  { id: "hag", ko: "학개", short: "학", en: "Haggai", chapters: 2 },
  { id: "zec", ko: "스가랴", short: "슥", en: "Zechariah", chapters: 14 },
  { id: "mal", ko: "말라기", short: "말", en: "Malachi", chapters: 4 },
];

const newer: Omit<BibleBook, "number" | "testament">[] = [
  { id: "mat", ko: "마태복음", short: "마", en: "Matthew", chapters: 28 },
  { id: "mrk", ko: "마가복음", short: "막", en: "Mark", chapters: 16 },
  { id: "luk", ko: "누가복음", short: "눅", en: "Luke", chapters: 24 },
  { id: "jhn", ko: "요한복음", short: "요", en: "John", chapters: 21 },
  { id: "act", ko: "사도행전", short: "행", en: "Acts", chapters: 28 },
  { id: "rom", ko: "로마서", short: "롬", en: "Romans", chapters: 16 },
  { id: "1co", ko: "고린도전서", short: "고전", en: "1 Corinthians", chapters: 16 },
  { id: "2co", ko: "고린도후서", short: "고후", en: "2 Corinthians", chapters: 13 },
  { id: "gal", ko: "갈라디아서", short: "갈", en: "Galatians", chapters: 6 },
  { id: "eph", ko: "에베소서", short: "엡", en: "Ephesians", chapters: 6 },
  { id: "php", ko: "빌립보서", short: "빌", en: "Philippians", chapters: 4 },
  { id: "col", ko: "골로새서", short: "골", en: "Colossians", chapters: 4 },
  { id: "1th", ko: "데살로니가전서", short: "살전", en: "1 Thessalonians", chapters: 5 },
  { id: "2th", ko: "데살로니가후서", short: "살후", en: "2 Thessalonians", chapters: 3 },
  { id: "1ti", ko: "디모데전서", short: "딤전", en: "1 Timothy", chapters: 6 },
  { id: "2ti", ko: "디모데후서", short: "딤후", en: "2 Timothy", chapters: 4 },
  { id: "tit", ko: "디도서", short: "딛", en: "Titus", chapters: 3 },
  { id: "phm", ko: "빌레몬서", short: "몬", en: "Philemon", chapters: 1 },
  { id: "heb", ko: "히브리서", short: "히", en: "Hebrews", chapters: 13 },
  { id: "jas", ko: "야고보서", short: "약", en: "James", chapters: 5 },
  { id: "1pe", ko: "베드로전서", short: "벧전", en: "1 Peter", chapters: 5 },
  { id: "2pe", ko: "베드로후서", short: "벧후", en: "2 Peter", chapters: 3 },
  { id: "1jn", ko: "요한일서", short: "요일", en: "1 John", chapters: 5 },
  { id: "2jn", ko: "요한이서", short: "요이", en: "2 John", chapters: 1 },
  { id: "3jn", ko: "요한삼서", short: "요삼", en: "3 John", chapters: 1 },
  { id: "jud", ko: "유다서", short: "유", en: "Jude", chapters: 1 },
  { id: "rev", ko: "요한계시록", short: "계", en: "Revelation", chapters: 22 },
];

export const BOOKS: BibleBook[] = [
  ...old.map((book, index) => ({ ...book, number: index + 1, testament: "old" as const })),
  ...newer.map((book, index) => ({ ...book, number: old.length + index + 1, testament: "new" as const })),
];

export function bookByNumber(number: number): BibleBook {
  return BOOKS[Math.max(0, Math.min(BOOKS.length - 1, number - 1))];
}

export function bookById(id: string): BibleBook | undefined {
  return BOOKS.find((book) => book.id === id);
}
