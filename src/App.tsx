import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { BOOKS, bookByNumber } from "./data/books";
import { BUILTIN_BIBLES, BUILTIN_STUDY_RESOURCES, DEFAULT_BIBLE_IDS, isBuiltinBible } from "./data/builtins";
import {
  deleteLibrary,
  importBethlehemFile,
  isSupportedBethlehemFileName,
  queryChapter,
  queryHymnScore,
  queryHymns,
  queryLexicon,
  queryTaggedVerse,
  searchBible,
} from "./lib/bethlehem";
import { cachedInsight, generateInsight } from "./lib/insights";
import { googleDriveConfigured, prepareGoogleDrive, syncSermonNotesWithGoogleDrive } from "./lib/googleDrive";
import { explainMorphology } from "./lib/morphology";
import { hasSermonNoteContent, mergeSermonNotes, parseNotesBackup, serializeNotesBackup, sermonNoteId } from "./lib/notes";
import { loadBuiltinChapter, loadMorphVerse, searchBuiltinBible } from "./lib/openData";
import { koreanPronunciation, type OriginalLanguage } from "./lib/pronunciation";
import { formatReference, parseReference, type Reference } from "./lib/reference";
import { getSermonNote, listLibraries, listSermonNotes, removeSermonNote, saveSermonNote, saveSermonNotes } from "./lib/storage";
import { taggedSegments } from "./lib/text";
import { downloadBlob, sermonNotesWordBlob } from "./lib/wordExport";
import type { BibleVerse, Hymn, Insight, LibraryMeta, MorphVerse, MorphWord, SearchResult, SermonNote } from "./types";

type Panel = "scripture" | "original" | "insight";
type Modal = "library" | "search" | "hymns" | "notes" | "settings" | null;
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KIND_LABEL: Record<LibraryMeta["kind"], string> = {
  bible: "성경 역본",
  "strong-bible": "스트롱 역본",
  original: "원문 역본",
  commentary: "주석",
  lexicon: "원어 사전",
  hymnal: "찬송가",
  "hymnal-score": "찬송가 악보",
};

function initialBibleIds(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem("selectedBibleIds") || "null");
    if (Array.isArray(stored) && stored.every((id) => typeof id === "string") && stored.length) return stored.slice(0, 4);
  } catch {
    // A corrupt preference should never prevent the default library from opening.
  }
  return [...DEFAULT_BIBLE_IDS];
}

const INSIGHT_SECTIONS: { key: keyof Omit<Insight, "questions">; icon: IconName; title: string }[] = [
  { key: "summary", icon: "focus", title: "한 문장 중심" },
  { key: "context", icon: "context", title: "문맥의 흐름" },
  { key: "originalLanguage", icon: "language", title: "원어가 여는 의미" },
  { key: "theology", icon: "cross", title: "신학적 중심" },
  { key: "sermonBridge", icon: "bridge", title: "설교의 다리" },
  { key: "application", icon: "steps", title: "삶으로의 적용" },
  { key: "guardrail", icon: "shield", title: "해석의 가드레일" },
];

type IconName = "book" | "search" | "library" | "hymn" | "notes" | "cloud" | "file" | "settings" | "chevronLeft" | "chevronRight" | "download" | "moon" | "sun" | "upload" | "trash" | "close" | "sparkle" | "copy" | "focus" | "context" | "language" | "cross" | "bridge" | "steps" | "shield" | "check";

function referenceFromHash(): Reference {
  const match = window.location.hash.match(/^#([a-z0-9]+)-(\d+)-(\d+)$/i);
  const matchedBook = match ? BOOKS.find((item) => item.id === match[1].toLowerCase()) : undefined;
  const chapter = Number(match?.[2]);
  const verse = Number(match?.[3]);
  if (!matchedBook || chapter < 1 || chapter > matchedBook.chapters || verse < 1) {
    return { book: 1, chapter: 1, verse: 1 };
  }
  return { book: matchedBook.number, chapter, verse };
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    library: <><path d="M4 4h5v16H4zM10.5 4H16v16h-5.5z"/><path d="m17.5 5.5 3-1 3.5 14-3 1z"/></>,
    hymn: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    notes: <><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    cloud: <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.2 8.2 4.5 4.5 0 0 0 7 18Z"/>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6m-6 4h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.04A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87L4.2 7.07l2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4 1.7 1.7 0 0 0 10 2.44V2h4v.44A1.7 1.7 0 0 0 15.04 4a1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.04A1.7 1.7 0 0 0 19.4 15Z"/></>,
    chevronLeft: <path d="m15 18-6-6 6-6"/>, chevronRight: <path d="m9 18 6-6-6-6"/>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v4h16v-4"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7"/><path d="M10 11v6m4-6v6"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    sparkle: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m19 14 .8 2.2 2.2.8-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    copy: <><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></>,
    focus: <><circle cx="12" cy="12" r="3"/><path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/></>,
    context: <><path d="M4 6h16M4 12h10M4 18h16"/></>,
    language: <><path d="M4 5h8M8 3v2m2 0c-.7 4-2.6 7-6 9"/><path d="M6 10c1.4 1.7 3 3 5 4m3 5 3.5-9 3.5 9m-5.8-3h4.6"/></>,
    cross: <path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6V3Z"/>,
    bridge: <><path d="M3 18h18M5 18v-5a7 7 0 0 1 14 0v5M8 18v-5m8 5v-5"/></>,
    steps: <path d="M4 19h5v-5h5V9h6V4"/>,
    shield: <path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const [reference, setReference] = useState<Reference>(referenceFromHash);
  const [referenceInput, setReferenceInput] = useState(() => formatReference(referenceFromHash()));
  const [libraries, setLibraries] = useState<LibraryMeta[]>([]);
  const [selectedBibleIds, setSelectedBibleIds] = useState<string[]>(initialBibleIds);
  const [chapterMap, setChapterMap] = useState<Record<string, BibleVerse[]>>({});
  const [commentary, setCommentary] = useState<BibleVerse[]>([]);
  const [morphVerse, setMorphVerse] = useState<MorphVerse>();
  const [selectedWord, setSelectedWord] = useState<MorphWord>();
  const [lexiconText, setLexiconText] = useState("");
  const [taggedText, setTaggedText] = useState("");
  const [insight, setInsight] = useState<Insight>();
  const [insightLoading, setInsightLoading] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [mobilePanel, setMobilePanel] = useState<Panel>("scripture");
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [fontScale, setFontScale] = useState(() => Number(localStorage.getItem("fontScale") || "1"));
  const [translationMenu, setTranslationMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const scriptureScrollRef = useRef<HTMLDivElement>(null);

  const book = bookByNumber(reference.book);
  const bibleLibraries = useMemo(() => [...BUILTIN_BIBLES, ...libraries.filter((library) => ["bible", "strong-bible", "original"].includes(library.kind))], [libraries]);
  const selectedLibraries = useMemo(() => selectedBibleIds.flatMap((id) => bibleLibraries.find((library) => library.id === id) || []), [selectedBibleIds, bibleLibraries]);
  const lexiconLibrary = useMemo(() => libraries.find((library) => library.kind === "lexicon" && /Ko|한|국/i.test(library.name)) || libraries.find((library) => library.kind === "lexicon"), [libraries]);
  const strongLibrary = useMemo(() => libraries.find((library) => library.kind === "strong-bible"), [libraries]);
  const commentaryLibrary = useMemo(() => libraries.find((library) => library.kind === "commentary"), [libraries]);
  const primaryLibrary = selectedLibraries[0] || BUILTIN_BIBLES[0];
  const originalLanguage: OriginalLanguage = book.testament === "old" ? "hebrew" : "greek";
  const versePronunciation = useMemo(() => morphVerse?.words.map((word) => koreanPronunciation(word.text, originalLanguage)).join(" · ") || "", [morphVerse, originalLanguage]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const refreshLibraries = useCallback(async () => {
    const next = await listLibraries();
    setLibraries(next);
    setSelectedBibleIds((current) => {
      const valid = current.filter((id) => isBuiltinBible(id) || next.some((library) => library.id === id));
      const preferred = next.find((library) => library.kind === "bible" && /개역|우리말|새번역|쉬운/i.test(library.name));
      if (preferred && !valid.includes(preferred.id) && valid.every(isBuiltinBible)) {
        return [preferred.id, ...valid.slice(0, 3)];
      }
      return valid.length ? valid : [...DEFAULT_BIBLE_IDS];
    });
  }, []);

  useEffect(() => { void refreshLibraries(); }, [refreshLibraries]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
    localStorage.setItem("theme", dark ? "dark" : "light");
    localStorage.setItem("fontScale", String(fontScale));
  }, [dark, fontScale]);

  useEffect(() => {
    localStorage.setItem("selectedBibleIds", JSON.stringify(selectedBibleIds));
  }, [selectedBibleIds]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(selectedLibraries.map(async (library) => [
      library.id,
      isBuiltinBible(library.id) ? await loadBuiltinChapter(library.id, book.id, reference.chapter) : await queryChapter(library, reference.book, reference.chapter),
    ] as const)).then((entries) => { if (!cancelled) setChapterMap(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) notify("성경 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); });
    return () => { cancelled = true; };
  }, [selectedLibraries, book.id, reference.book, reference.chapter, notify]);

  useEffect(() => {
    let cancelled = false;
    setSelectedWord(undefined);
    setLexiconText("");
    void loadMorphVerse(book.id, reference.chapter, reference.verse).then((verse) => { if (!cancelled) setMorphVerse(verse); });
    if (strongLibrary) void queryTaggedVerse(strongLibrary.id, reference.book, reference.chapter, reference.verse).then((text) => { if (!cancelled) setTaggedText(text); });
    else setTaggedText("");
    if (commentaryLibrary) void queryChapter(commentaryLibrary, reference.book, reference.chapter).then((rows) => { if (!cancelled) setCommentary(rows); });
    else setCommentary([]);
    return () => { cancelled = true; };
  }, [book.id, commentaryLibrary, reference, strongLibrary]);

  const selectedVerseText = useMemo(() => chapterMap[primaryLibrary.id]?.find((verse) => verse.verse === reference.verse)?.text || "", [chapterMap, primaryLibrary.id, reference.verse]);

  const insightInput = useMemo(() => {
    const verses = chapterMap[primaryLibrary.id] || [];
    return {
      reference: formatReference(reference),
      translation: primaryLibrary.name,
      verse: selectedVerseText,
      previousVerse: verses.find((verse) => verse.verse === reference.verse - 1)?.text,
      nextVerse: verses.find((verse) => verse.verse === reference.verse + 1)?.text,
      originalWords: morphVerse?.words,
    };
  }, [chapterMap, morphVerse, primaryLibrary, reference, selectedVerseText]);

  useEffect(() => {
    let cancelled = false;
    setInsight(undefined);
    if (insightInput.verse) void cachedInsight(insightInput).then((value) => { if (!cancelled) setInsight(value); });
    return () => { cancelled = true; };
  }, [insightInput]);

  const selectReference = useCallback((next: Reference) => {
    setReference(next);
    setReferenceInput(formatReference(next));
    window.history.replaceState(null, "", `#${bookByNumber(next.book).id}-${next.chapter}-${next.verse}`);
  }, []);

  const moveVerse = useCallback((delta: number) => {
    const verses = chapterMap[primaryLibrary.id] || [];
    const target = reference.verse + delta;
    if (verses.some((verse) => verse.verse === target)) selectReference({ ...reference, verse: target });
    else if (delta > 0 && reference.chapter < book.chapters) selectReference({ ...reference, chapter: reference.chapter + 1, verse: 1 });
    else if (delta < 0 && reference.chapter > 1) selectReference({ ...reference, chapter: reference.chapter - 1, verse: 1 });
  }, [book.chapters, chapterMap, primaryLibrary.id, reference, selectReference]);

  const submitReference = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseReference(referenceInput, reference);
    if (parsed) selectReference(parsed);
    else notify("성경 구절을 확인해 주세요. 예: 요 3:16");
  };

  const chooseWord = useCallback(async (word: MorphWord) => {
    setSelectedWord(word);
    setLexiconText("");
    if (word.strong && lexiconLibrary) setLexiconText(await queryLexicon(lexiconLibrary.id, word.strong));
  }, [lexiconLibrary]);

  const chooseStrongCode = useCallback(async (code: string) => {
    const word = morphVerse?.words.find((candidate) => candidate.strong.replace(/^([HG])0+/, "$1") === code.replace(/^([HG])0+/, "$1"));
    if (word) await chooseWord(word);
    else {
      setSelectedWord({ text: code, lemma: "", morphology: "", strong: code, gloss: "" });
      setLexiconText(lexiconLibrary ? await queryLexicon(lexiconLibrary.id, code) : "");
    }
    setMobilePanel("original");
  }, [chooseWord, lexiconLibrary, morphVerse]);

  const requestInsight = async (force = false) => {
    if (!selectedVerseText) return notify("먼저 본문이 있는 역본을 선택해 주세요.");
    setInsightLoading(true);
    try {
      setInsight(await generateInsight(insightInput, force));
    } catch (error) {
      notify(error instanceof Error ? error.message : "통찰을 생성하지 못했습니다.");
    } finally {
      setInsightLoading(false);
    }
  };

  const toggleBible = (id: string) => {
    setSelectedBibleIds((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      if (current.length >= 4) { notify("역본은 한 화면에 최대 4개까지 대조할 수 있습니다."); return current; }
      return [...current, id];
    });
  };

  const copyVerse = async () => {
    await navigator.clipboard.writeText(`${selectedVerseText} (${formatReference(reference)}, ${primaryLibrary.name})`);
    notify("성경절을 복사했습니다.");
  };

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(undefined);
    } else {
      notify("브라우저 메뉴에서 ‘홈 화면에 추가’를 선택해 주세요.");
    }
  };

  const verseNumbers = useMemo(() => {
    const values = new Set<number>();
    Object.values(chapterMap).forEach((verses) => verses.forEach((verse) => values.add(verse.verse)));
    return [...values].sort((a, b) => a - b);
  }, [chapterMap]);

  return (
    <div className={`app mobile-${mobilePanel}`}>
      <header className="app-header">
        <button className="brand" onClick={() => selectReference({ book: 1, chapter: 1, verse: 1 })} aria-label="말씀숲 홈">
          <span className="brand-mark"><Icon name="book" size={25}/></span>
          <span><strong>말씀숲</strong><small>원문에서 설교까지</small></span>
        </button>

        <div className="passage-controls">
          <button className="icon-button" onClick={() => moveVerse(-1)} aria-label="이전 절"><Icon name="chevronLeft"/></button>
          <select value={reference.book} onChange={(event) => selectReference({ book: Number(event.target.value), chapter: 1, verse: 1 })} aria-label="성경 책">
            {BOOKS.map((item) => <option key={item.id} value={item.number}>{item.ko}</option>)}
          </select>
          <select value={reference.chapter} onChange={(event) => selectReference({ ...reference, chapter: Number(event.target.value), verse: 1 })} aria-label="장">
            {Array.from({ length: book.chapters }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}장</option>)}
          </select>
          <select value={reference.verse} onChange={(event) => selectReference({ ...reference, verse: Number(event.target.value) })} aria-label="절" disabled={!verseNumbers.length}>
            {verseNumbers.map((verse) => <option key={verse} value={verse}>{verse}절</option>)}
          </select>
          <form className="reference-form" onSubmit={submitReference}>
            <input value={referenceInput} onChange={(event) => setReferenceInput(event.target.value)} aria-label="성경 구절 직접 입력" placeholder="요 3:16"/>
          </form>
          <button className="icon-button" onClick={() => moveVerse(1)} aria-label="다음 절"><Icon name="chevronRight"/></button>
        </div>

        <nav className="header-actions" aria-label="도구">
          <button onClick={() => setModal("search")} aria-label="성경 검색"><Icon name="search"/><span>검색</span></button>
          <button onClick={() => setModal("notes")} aria-label="설교 노트"><Icon name="notes"/><span>설교 노트</span></button>
          <button onClick={() => setModal("hymns")} aria-label="찬송가"><Icon name="hymn"/><span>찬송가</span></button>
          <button onClick={() => setModal("library")} aria-label="내 서재"><Icon name="library"/><span>내 서재</span><i>{BUILTIN_BIBLES.length + BUILTIN_STUDY_RESOURCES.length + libraries.length}</i></button>
          <button onClick={install} aria-label="앱 설치"><Icon name="download"/><span>앱 설치</span></button>
          <button onClick={() => setDark((value) => !value)} aria-label={dark ? "화이트 모드로 전환" : "다크 모드로 전환"} title={dark ? "화이트 모드로 전환" : "다크 모드로 전환"}><Icon name={dark ? "sun" : "moon"}/><span>{dark ? "화이트" : "다크"}</span></button>
          <button onClick={() => setModal("settings")} aria-label="읽기 설정"><Icon name="settings"/><span>읽기 설정</span></button>
        </nav>
      </header>

      <main className="workspace">
        <section className="study-panel scripture-panel" aria-label="성경 본문">
          <div className="panel-header">
            <div><span className="eyebrow">SCRIPTURE</span><h1>{book.ko} <b>{reference.chapter}</b></h1></div>
            <div className="panel-tools">
              <div className="translation-picker">
                <button className="soft-button" onClick={() => setTranslationMenu((value) => !value)}>{selectedLibraries.map((library) => library.name).join(" · ")} <small>▾</small></button>
                {translationMenu && <div className="translation-menu">
                  <div className="translation-menu-head"><strong>대조할 역본</strong><small>최대 4개</small></div>
                  <div className="translation-menu-list" role="group" aria-label="대조할 역본 목록">
                    {bibleLibraries.map((library) => <label key={library.id}><input type="checkbox" checked={selectedBibleIds.includes(library.id)} onChange={() => toggleBible(library.id)}/><span>{library.name}<small>{isBuiltinBible(library.id) ? "기본 제공 · 공개 자료" : KIND_LABEL[library.kind]}</small></span></label>)}
                  </div>
                  <button onClick={() => { setTranslationMenu(false); setModal("library"); }}><Icon name="upload" size={17}/> 역본 더 가져오기</button>
                </div>}
              </div>
              <button className="icon-button subtle" onClick={copyVerse} aria-label="선택 절 복사"><Icon name="copy" size={18}/></button>
            </div>
          </div>

          <div className="scripture-scroll" ref={scriptureScrollRef}>
            {libraries.length === 0 && <div className="welcome-card">
              <span className="welcome-icon"><Icon name="library" size={28}/></span>
              <div><strong>기본 성경과 원문 자료가 준비되어 있습니다</strong><p>한글 성경·WEB·YLT·ASV와 히브리어·헬라어 원문 분해를 바로 사용할 수 있습니다.</p></div>
              <button onClick={() => setModal("library")}>기본 서재 보기</button>
            </div>}
            <div className="verse-list">
              {verseNumbers.map((verseNumber) => <article key={verseNumber} className={`verse-row ${reference.verse === verseNumber ? "selected" : ""}`} onClick={() => selectReference({ ...reference, verse: verseNumber })}>
                <button className="verse-number" aria-label={`${verseNumber}절`}>{verseNumber}</button>
                <div className="verse-translations">
                  {selectedLibraries.map((library, index) => {
                    const verse = chapterMap[library.id]?.find((item) => item.verse === verseNumber);
                    return verse ? <div className="translation-line" key={library.id}><span className="translation-label">{library.name}</span><p className={index === 0 ? "primary" : ""}>{verse.text}</p></div> : null;
                  })}
                </div>
              </article>)}
            </div>

            {taggedText && <aside className="strong-strip">
              <div className="aside-title"><span>번역 어절과 원어 코드</span><small>{strongLibrary?.name}</small></div>
              <div className="tagged-words">{taggedSegments(taggedText).map((segment, index) => <span key={`${segment.text}-${index}`} className={segment.codes.length ? "tagged-word" : "plain-word"}>{segment.text}{segment.codes.map((code) => <button key={code} onClick={() => void chooseStrongCode(code)}>{code}</button>)}</span>)}</div>
            </aside>}

            {commentary.length > 0 && <aside className="commentary-card">
              <div className="aside-title"><span>주석</span><small>{commentaryLibrary?.name}</small></div>
              <p>{commentary.find((item) => item.verse === reference.verse)?.text || "이 절의 주석이 없습니다."}</p>
            </aside>}
          </div>
        </section>

        <section className="study-panel original-panel" aria-label="원문 분해">
          <div className="panel-header">
            <div><span className="eyebrow">ORIGINAL LANGUAGE</span><h2>{book.testament === "old" ? "히브리어 원문" : "헬라어 원문"}</h2></div>
            <span className="source-badge">{morphVerse?.source || "불러오는 중"}</span>
          </div>
          <div className="original-scroll">
            <div className={`original-text ${book.testament === "old" ? "rtl" : ""}`}>{morphVerse?.text}</div>
            {versePronunciation && <div className="verse-pronunciation"><span>한글 음가</span><p>{versePronunciation}</p><small>원문 읽기를 돕는 근사 음가이며, 학파와 시대에 따라 실제 발음은 달라질 수 있습니다.</small></div>}
            <p className="tap-guide"><Icon name="language" size={16}/> 단어를 누르면 형태와 사전 뜻을 함께 봅니다.</p>
            <div className={`word-grid ${book.testament === "old" ? "rtl" : ""}`}>
              {morphVerse?.words.map((word, index) => <button key={`${word.text}-${index}`} className={selectedWord === word ? "active" : ""} onClick={() => void chooseWord(word)}>
                <span className="surface">{word.text}</span><span className="strong">{word.strong || "—"}</span><span className="pronunciation">{koreanPronunciation(word.text, originalLanguage)}</span><small>{word.gloss || word.lemma.replace(/^[a-z]+\//i, "")}</small>
              </button>)}
            </div>

            {selectedWord ? <div className="word-inspector">
              <div className="inspector-head"><div><span className="inspector-word">{selectedWord.text}</span><span className="inspector-pronunciation"><b>한글 음가</b>{koreanPronunciation(selectedWord.text, originalLanguage)}</span><span className="inspector-lemma">{selectedWord.lemma}</span></div><span className="strong-pill">{selectedWord.strong}</span></div>
              <div className="morph-box"><span>형태 분석</span><strong>{explainMorphology(selectedWord.morphology)}</strong><code>{selectedWord.morphology}</code></div>
              {selectedWord.gloss && <div className="gloss-row"><span>기본 의미</span><p>{selectedWord.gloss}</p></div>}
              {lexiconText ? <div className="lexicon-entry"><span>{lexiconLibrary?.name}</span><p>{lexiconText}</p></div> : <div className="lexicon-empty"><Icon name="library"/><p>{lexiconLibrary ? "이 코드의 사전 항목이 없습니다." : "HebGrkKo.dct를 가져오면 상세 한글 원어사전이 여기에 연결됩니다."}</p>{!lexiconLibrary && <button onClick={() => setModal("library")}>사전 가져오기</button>}</div>}
            </div> : <div className="word-placeholder"><span>א</span><p>원문의 단어 하나를 선택해 보세요.<br/>기본형, 품사, 문법 형태와 사전이 연결됩니다.</p></div>}
          </div>
        </section>

        <section className="study-panel insight-panel" aria-label="영적 통찰">
          <div className="panel-header">
            <div><span className="eyebrow accent">PASTORAL INSIGHT</span><h2>본문에서 설교로</h2></div>
            {insight && <button className="icon-button subtle" onClick={() => void requestInsight(true)} aria-label="통찰 새로 생성"><Icon name="sparkle" size={18}/></button>}
          </div>
          <div className="insight-scroll">
            {!insight ? <div className="insight-intro">
              <span className="insight-orb"><Icon name="sparkle" size={34}/></span>
              <span className="reference-chip">{formatReference(reference)}</span>
              <h3>원문과 문맥을 따라<br/>설교의 중심을 발견하세요</h3>
              <p>형태론과 앞뒤 절을 함께 살펴 본문의 중심, 신학, 적용과 해석의 경계를 구분해 제안합니다.</p>
              <button className="primary-button" disabled={insightLoading || !selectedVerseText} onClick={() => void requestInsight()}>{insightLoading ? <span className="spinner"/> : <Icon name="sparkle"/>}{insightLoading ? "본문을 깊이 읽는 중…" : "이 절의 통찰 보기"}</button>
              <small>버튼을 누르면 선택 절·앞뒤 절·원어 정보가 Cloudflare AI로 전송됩니다. AI의 제안은 반드시 본문과 문맥으로 검토하세요.</small>
            </div> : <div className="insight-content">
              <div className="insight-summary"><span><Icon name="sparkle" size={18}/> {formatReference(reference)}</span><p>{insight.summary}</p></div>
              {INSIGHT_SECTIONS.slice(1).map((section) => <article className={`insight-section section-${section.key}`} key={section.key}><span className="section-icon"><Icon name={section.icon} size={19}/></span><div><h3>{section.title}</h3><p>{insight[section.key]}</p></div></article>)}
              <article className="questions-card"><span className="section-icon"><Icon name="focus"/></span><div><h3>묵상과 설교 점검</h3><ol>{insight.questions.map((question, index) => <li key={question}><span>{index + 1}</span>{question}</li>)}</ol></div></article>
              <p className="ai-note">이 내용은 연구 보조 자료입니다. 인용 전 원문·문맥·신학적 전통 안에서 확인하세요.</p>
            </div>}
          </div>
        </section>
      </main>

      <nav className="mobile-nav" aria-label="모바일 연구 패널">
        <button className={mobilePanel === "scripture" ? "active" : ""} onClick={() => setMobilePanel("scripture")}><Icon name="book"/><span>본문</span></button>
        <button className={mobilePanel === "original" ? "active" : ""} onClick={() => setMobilePanel("original")}><Icon name="language"/><span>원문분해</span></button>
        <button className={mobilePanel === "insight" ? "active" : ""} onClick={() => setMobilePanel("insight")}><Icon name="sparkle"/><span>통찰</span></button>
        <button onClick={() => setModal("notes")}><Icon name="notes"/><span>노트</span></button>
        <button onClick={() => setModal("hymns")}><Icon name="hymn"/><span>찬송가</span></button>
        <button onClick={() => setModal("library")}><Icon name="library"/><span>서재</span></button>
      </nav>

      {modal === "library" && (
        <LibraryModal libraries={libraries} onClose={() => setModal(null)} onChanged={refreshLibraries} notify={notify}/>
      )}
      {modal === "search" && (
        <SearchModal libraries={[...bibleLibraries, ...libraries.filter((library) => library.kind === "commentary")]} onClose={() => setModal(null)} onSelect={(next) => { selectReference(next); setModal(null); }} notify={notify}/>
      )}
      {modal === "hymns" && (
        <HymnModal libraries={libraries} onClose={() => setModal(null)} onOpenLibrary={() => setModal("library")}/>
      )}
      {modal === "notes" && (
        <SermonNotesModal
          reference={reference}
          verseText={selectedVerseText}
          translation={primaryLibrary.name}
          insight={insight}
          onSelect={selectReference}
          onClose={() => setModal(null)}
          notify={notify}
        />
      )}
      {modal === "settings" && (
        <SettingsModal dark={dark} setDark={setDark} fontScale={fontScale} setFontScale={setFontScale} onInstall={install} onClose={() => setModal(null)}/>
      )}
      {toast && <div className="toast"><Icon name="check" size={18}/>{toast}</div>}
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><Icon name="close"/></button></div>{children}</div></div>;
}

function LibraryModal({ libraries, onClose, onChanged, notify }: { libraries: LibraryMeta[]; onClose: () => void; onChanged: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState<{ title: string; details: string[] }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(event.target.files || [])];
    const files = chosen.filter((file) => isSupportedBethlehemFileName(file.name));
    const ignored = chosen.length - files.length;
    if (!files.length) {
      notify("가져올 수 있는 베들레헴 자료가 없습니다.");
      event.target.value = "";
      return;
    }
    setBusy(true);
    setReport(undefined);
    cancelRef.current = false;
    let added = 0;
    let replaced = 0;
    const failures: string[] = [];
    const existingByName = new Map(libraries.map((library) => [library.fileName.toLocaleLowerCase(), library]));
    try {
      await navigator.storage?.persist?.().catch(() => false);
      const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
      const additionalBytes = files.reduce((total, file) => {
        const existing = existingByName.get(file.name.toLocaleLowerCase());
        return total + Math.max(0, file.size - (existing?.size || 0));
      }, 0);
      const available = estimate?.quota === undefined ? undefined : estimate.quota - (estimate.usage || 0);
      if (available !== undefined && additionalBytes > available) {
        const needed = (additionalBytes / 1024 / 1024).toFixed(0);
        const free = (available / 1024 / 1024).toFixed(0);
        throw new Error(`브라우저 저장 공간이 부족합니다. 약 ${needed}MB가 필요하지만 ${free}MB만 사용할 수 있습니다.`);
      }

      for (const [index, file] of files.entries()) {
        if (cancelRef.current) break;
        const existing = existingByName.get(file.name.toLocaleLowerCase());
        setProgress(`${index + 1}/${files.length} · ${file.name} · 파일 읽는 중`);
        try {
          const library = await importBethlehemFile(file, (stage) => setProgress(`${index + 1}/${files.length} · ${file.name} · ${stage}`), existing?.id);
          existingByName.set(file.name.toLocaleLowerCase(), library);
          if (existing) replaced += 1;
          else added += 1;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : `${file.name}: 가져오기 실패`);
        }
      }
      await onChanged();
      const completed = added + replaced;
      const stopped = cancelRef.current ? " · 사용자 중지" : "";
      const title = `${completed}개 처리 완료 (새 자료 ${added} · 갱신 ${replaced} · 실패 ${failures.length})${stopped}`;
      const details = [
        ...(ignored ? [`관련 없는 파일 ${ignored}개는 자동으로 제외했습니다.`] : []),
        ...failures.slice(0, 6),
        ...(failures.length > 6 ? [`그 밖의 실패 ${failures.length - 6}개`] : []),
      ];
      setReport({ title, details });
      if (completed) notify(`${completed}개 베들레헴 자료를 이 기기에 등록했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "서재 목록을 새로 고치지 못했습니다.";
      setReport({ title: "가져오기를 시작하지 못했습니다.", details: [message] });
      notify(message);
    } finally {
      setBusy(false);
      setProgress("");
      event.target.value = "";
    }
  };
  const remove = async (library: LibraryMeta) => {
    if (!window.confirm(`‘${library.name}’ 자료를 이 기기에서 삭제할까요? 원본 파일은 삭제되지 않습니다.`)) return;
    await deleteLibrary(library.id);
    await onChanged();
  };
  return <ModalShell title="내 베들레헴 서재" subtitle="기본 자료는 바로 사용하고, 보유한 자료만 이 기기에 추가합니다." onClose={onClose} wide>
    <div className="privacy-banner"><Icon name="shield"/><div><strong>기본 자료는 서버에서 제공되고 개인 파일은 이 기기에만 저장됩니다</strong><p>개인 파일은 외부로 업로드되지 않으며 언제든 삭제할 수 있습니다. 통찰 생성 때만 선택 절과 분석용 문맥이 Cloudflare AI로 전송됩니다.</p></div></div>
    <div className="import-area">
      <button className="import-zone" onClick={() => folderRef.current?.click()} disabled={busy}><span><Icon name="upload" size={30}/></span><strong>{busy ? progress : "베들레헴 폴더 전체 가져오기"}</strong><small>폴더를 한 번 선택하면 성경·원문·사전·주석·찬송가·악보를 차례로 등록합니다.</small></button>
      <div className="import-options"><button className="soft-button" onClick={() => fileRef.current?.click()} disabled={busy}>필요한 파일만 선택</button>{busy && <button className="soft-button danger" onClick={() => { cancelRef.current = true; setProgress("현재 파일 저장 후 중지합니다…"); }}>가져오기 중지</button>}</div>
    </div>
    <input ref={fileRef} hidden type="file" multiple accept=".bdb,.sdb,.cdb,.dct,.hdb,.cmp" onChange={(event) => void importFiles(event)}/>
    <input ref={(node) => { folderRef.current = node; node?.setAttribute("webkitdirectory", ""); node?.setAttribute("directory", ""); }} hidden type="file" multiple accept=".bdb,.sdb,.cdb,.dct,.hdb,.cmp" onChange={(event) => void importFiles(event)}/>
    {report && <div className={`import-report ${report.details.length ? "has-details" : ""}`}><strong>{report.title}</strong>{report.details.map((detail, index) => <p key={`${index}-${detail}`}>{detail}</p>)}</div>}
    <div className="library-list">
      <div className="library-list-head"><strong>처음부터 제공되는 기본 자료</strong><span>{BUILTIN_BIBLES.length + BUILTIN_STUDY_RESOURCES.length}개</span></div>
      {BUILTIN_BIBLES.map((library) => <div className="library-item" key={library.id}><span className="file-icon kind-bible"><Icon name="book"/></span><div><strong>{library.name}</strong><small>{library.description} · {library.license}</small></div><span className="default-badge">기본</span></div>)}
      {BUILTIN_STUDY_RESOURCES.map((resource) => <div className="library-item" key={resource.id}><span className="file-icon kind-original"><Icon name="language"/></span><div><strong>{resource.name}</strong><small>{resource.description}</small></div><span className="default-badge">기본</span></div>)}
      <div className="library-list-head secondary"><strong>내가 가져온 개인 자료</strong><span>{libraries.length}개</span></div>
      {libraries.length ? libraries.map((library) => <div className="library-item" key={library.id}><span className={`file-icon kind-${library.kind}`}><Icon name={library.kind === "hymnal" || library.kind === "hymnal-score" ? "hymn" : library.kind === "lexicon" ? "language" : "book"}/></span><div><strong>{library.name}</strong><small>{KIND_LABEL[library.kind]} · {(library.size / 1024 / 1024).toFixed(1)}MB</small></div><button className="icon-button subtle danger" onClick={() => void remove(library)} aria-label={`${library.name} 삭제`}><Icon name="trash" size={18}/></button></div>) : <div className="empty-list">추가한 개인 자료가 없습니다. 기본 자료는 위에서 바로 사용할 수 있습니다.</div>}
    </div>
    <div className="format-guide"><strong>추천 가져오기 순서</strong><ol><li><span>1</span><div><b>01개역개정.bdb</b><small>주로 읽을 한글 본문</small></div></li><li><span>2</span><div><b>개역개정S.sdb</b><small>번역 어절과 스트롱 코드 연결</small></div></li><li><span>3</span><div><b>HebGrkKo.dct</b><small>한글 히브리어·헬라어 사전</small></div></li><li><span>4</span><div><b>새찬송가.hdb</b><small>찬송가 제목과 가사</small></div></li></ol></div>
  </ModalShell>;
}

function SearchModal({ libraries, onClose, onSelect, notify }: { libraries: LibraryMeta[]; onClose: () => void; onSelect: (reference: Reference) => void; notify: (message: string) => void }) {
  const searchable = libraries.filter((library) => ["bible", "strong-bible", "commentary"].includes(library.kind));
  const [selectedId, setSelectedId] = useState(searchable[0]?.id || "");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const library = searchable.find((item) => item.id === selectedId);
    if (!library || !term.trim()) return notify("검색할 역본과 단어를 선택해 주세요.");
    setBusy(true);
    try {
      setResults(isBuiltinBible(library.id) ? await searchBuiltinBible(library.id, term.trim()) : await searchBible(library, term.trim()));
    } catch (error) {
      notify(error instanceof Error ? error.message : "성경 검색에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return <ModalShell title="성구·원어코드 검색" subtitle="기본 역본과 개인 자료에서 단어나 H430, G3056 같은 코드를 찾습니다." onClose={onClose} wide>
    {searchable.length ? <><form className="search-form" onSubmit={(event) => void submit(event)}><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{searchable.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}</select><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="예: 은혜 또는 H2580"/><button className="primary-button" disabled={busy}><Icon name="search"/>{busy ? "찾는 중" : "검색"}</button></form><div className="search-results">{results.map((result) => <button key={`${result.book}-${result.chapter}-${result.verse}`} onClick={() => onSelect({ book: result.book, chapter: result.chapter, verse: result.verse })}><strong>{formatReference(result)}</strong><p>{result.text}</p></button>)}{!busy && results.length === 0 && term && <div className="empty-list">검색 결과가 없습니다.</div>}</div></> : <div className="modal-empty"><Icon name="search" size={34}/><h3>검색할 베들레헴 역본이 필요합니다</h3><p>내 서재에서 `.bdb` 또는 `.sdb` 파일을 먼저 가져오세요.</p></div>}
  </ModalShell>;
}

function HymnModal({ libraries, onClose, onOpenLibrary }: { libraries: LibraryMeta[]; onClose: () => void; onOpenLibrary: () => void }) {
  const hymnals = libraries.filter((library) => library.kind === "hymnal");
  const scores = libraries.filter((library) => library.kind === "hymnal-score");
  const [selectedId, setSelectedId] = useState(hymnals[0]?.id || "");
  const [query, setQuery] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [selected, setSelected] = useState<Hymn>();
  const [view, setView] = useState<"lyrics" | "score">("lyrics");
  const [scoreUrl, setScoreUrl] = useState("");
  const [scoreStatus, setScoreStatus] = useState("");
  const selectedHymnal = hymnals.find((library) => library.id === selectedId);
  const scoreLibrary = scores.find((library) => library.name === selectedHymnal?.name);
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => void queryHymns(selectedId, query)
      .then((rows) => { setHymns(rows); setSelected((current) => current || rows[0]); })
      .catch(() => { setHymns([]); setSelected(undefined); }), 180);
    return () => window.clearTimeout(timer);
  }, [query, selectedId]);
  useEffect(() => {
    setScoreUrl("");
    setScoreStatus(scoreLibrary ? "악보를 불러오는 중입니다…" : "");
    if (!scoreLibrary || !selected) return;
    let active = true;
    let url = "";
    void queryHymnScore(scoreLibrary.id, selected.number).then((blob) => {
      if (!active) return;
      if (!blob) {
        setScoreStatus("이 번호의 악보 이미지가 없습니다.");
        return;
      }
      url = URL.createObjectURL(blob);
      setScoreUrl(url);
      setScoreStatus("");
    }).catch(() => { if (active) setScoreStatus("악보를 읽지 못했습니다. 악보 파일을 다시 가져와 주세요."); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [scoreLibrary, selected]);
  return <ModalShell title="찬송가" subtitle="번호, 제목 또는 가사로 찾을 수 있습니다." onClose={onClose} wide>
    {hymnals.length ? <div className="hymn-browser"><aside><div className="hymn-filters"><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setSelected(undefined); setView("lyrics"); }}>{hymnals.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}</select><div><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목이나 가사 검색"/></div></div><div className="hymn-list">{hymns.map((hymn) => <button key={hymn.number} className={selected?.number === hymn.number ? "active" : ""} onClick={() => setSelected(hymn)}><span>{hymn.number}</span><strong>{hymn.title}</strong></button>)}</div></aside><article className="hymn-page">{selected ? <><span className="hymn-number">찬송 {selected.number}장</span><h3>{selected.title}</h3><div className="hymn-rule"/>{scoreLibrary && <div className="hymn-view-tabs"><button className={view === "lyrics" ? "active" : ""} onClick={() => setView("lyrics")}>가사</button><button className={view === "score" ? "active" : ""} onClick={() => setView("score")}>악보</button></div>}{view === "score" && scoreLibrary ? scoreUrl ? <img className="hymn-score" src={scoreUrl} alt={`${selected.title} 악보`}/> : <div className="empty-list">{scoreStatus}</div> : <p>{selected.text}</p>}</> : <div className="empty-list">찬송가를 선택하세요.</div>}</article></div> : <div className="modal-empty"><span className="large-round"><Icon name="hymn" size={34}/></span><h3>찬송가 가사 파일을 연결하세요</h3><p>`새찬송가.hdb` 또는 `찬미가.hdb`를 가져오면<br/>번호·제목·가사 검색을 사용할 수 있습니다.</p><button className="primary-button" onClick={onOpenLibrary}><Icon name="upload"/> 찬송가 가져오기</button></div>}
  </ModalShell>;
}

type SermonNoteDraft = {
  title: string;
  meditation: string;
  application: string;
  outline: string;
  prayer: string;
  tagsText: string;
};

const EMPTY_NOTE_DRAFT: SermonNoteDraft = { title: "", meditation: "", application: "", outline: "", prayer: "", tagsText: "" };

function draftFromNote(note?: SermonNote): SermonNoteDraft {
  return note ? {
    title: note.title,
    meditation: note.meditation,
    application: note.application,
    outline: note.outline,
    prayer: note.prayer,
    tagsText: note.tags.join(", "),
  } : { ...EMPTY_NOTE_DRAFT };
}

function SermonNotesModal({ reference, verseText, translation, insight, onSelect, onClose, notify }: {
  reference: Reference;
  verseText: string;
  translation: string;
  insight?: Insight;
  onSelect: (reference: Reference) => void;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const currentId = sermonNoteId(reference);
  const [draft, setDraft] = useState<SermonNoteDraft>(EMPTY_NOTE_DRAFT);
  const [notes, setNotes] = useState<SermonNote[]>([]);
  const [loadedId, setLoadedId] = useState("");
  const [saveStatus, setSaveStatus] = useState("불러오는 중…");
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [driveReady, setDriveReady] = useState(false);
  const createdAtRef = useRef(new Date().toISOString());
  const importRef = useRef<HTMLInputElement>(null);

  const buildCurrentNote = useCallback((updatedAt = new Date().toISOString()): SermonNote => ({
    id: currentId,
    book: reference.book,
    chapter: reference.chapter,
    verse: reference.verse,
    reference: formatReference(reference),
    translation,
    verseText,
    title: draft.title.trim(),
    meditation: draft.meditation.trim(),
    application: draft.application.trim(),
    outline: draft.outline.trim(),
    prayer: draft.prayer.trim(),
    tags: [...new Set(draft.tagsText.split(/[,#\n]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 20),
    createdAt: createdAtRef.current,
    updatedAt,
  }), [currentId, draft, reference, translation, verseText]);

  const replaceCurrentDraft = useCallback((note?: SermonNote) => {
    createdAtRef.current = note?.createdAt || new Date().toISOString();
    setDraft(draftFromNote(note));
    setDirty(false);
    setLoadedId(currentId);
    setSaveStatus(note ? "저장됨" : "내용을 입력하면 자동 저장됩니다");
  }, [currentId]);

  useEffect(() => {
    let cancelled = false;
    setLoadedId("");
    setSaveStatus("불러오는 중…");
    void Promise.all([getSermonNote(currentId), listSermonNotes()]).then(([note, stored]) => {
      if (cancelled) return;
      setNotes(stored);
      replaceCurrentDraft(note);
    }).catch(() => {
      if (!cancelled) setSaveStatus("저장소를 열지 못했습니다");
    });
    return () => { cancelled = true; };
  }, [currentId, replaceCurrentDraft]);

  useEffect(() => {
    if (!googleDriveConfigured()) return;
    void prepareGoogleDrive().then(() => setDriveReady(true)).catch(() => setDriveReady(false));
  }, []);

  useEffect(() => {
    if (loadedId !== currentId || !dirty) return;
    const candidate = buildCurrentNote();
    if (!hasSermonNoteContent(candidate)) {
      setSaveStatus("내용을 입력하면 자동 저장됩니다");
      return;
    }
    setSaveStatus("변경됨 · 잠시 후 자동 저장");
    const timer = window.setTimeout(() => {
      const note = buildCurrentNote();
      setSaveStatus("자동 저장 중…");
      void saveSermonNote(note).then(() => {
        setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
        setDirty(false);
        setSaveStatus("저장됨");
      }).catch(() => setSaveStatus("저장 실패 · 다시 입력해 주세요"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [buildCurrentNote, currentId, dirty, loadedId]);

  const setField = (field: keyof SermonNoteDraft, value: string) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const persistCurrent = async (): Promise<void> => {
    if (!dirty) return;
    const current = buildCurrentNote();
    if (hasSermonNoteContent(current)) {
      await saveSermonNote(current);
      setNotes((stored) => [current, ...stored.filter((note) => note.id !== current.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      setDirty(false);
      setSaveStatus("저장됨");
    }
  };

  const closeNotes = async () => {
    try { await persistCurrent(); }
    catch { notify("마지막 내용을 저장하지 못했습니다. 노트를 다시 열어 확인해 주세요."); }
    onClose();
  };

  const selectSavedNote = async (note: SermonNote) => {
    try { await persistCurrent(); }
    catch { notify("현재 노트의 마지막 내용을 저장하지 못했습니다."); }
    onSelect({ book: note.book, chapter: note.chapter, verse: note.verse });
  };

  const notesWithCurrent = async (): Promise<SermonNote[]> => {
    const current = buildCurrentNote();
    if (dirty && hasSermonNoteContent(current)) {
      await saveSermonNote(current);
      setDirty(false);
      setSaveStatus("저장됨");
    }
    const stored = await listSermonNotes();
    setNotes(stored);
    return stored;
  };

  const exportBackup = async (share = false) => {
    setBusy("backup");
    try {
      const stored = await notesWithCurrent();
      if (!stored.length) return notify("먼저 설교 노트를 작성해 주세요.");
      const fileName = `말씀숲-설교노트-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([serializeNotesBackup(stored)], fileName, { type: "application/json" });
      if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: "말씀숲 설교 노트 백업", text: "Google Drive에 저장해 다른 기기에서 다시 가져올 수 있습니다.", files: [file] });
      } else {
        downloadBlob(file, fileName);
        notify(share ? "백업 파일을 받았습니다. Google Drive에 올려 보관하세요." : "설교 노트 백업 파일을 저장했습니다.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify(error instanceof Error ? error.message : "백업 파일을 만들지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("import");
    try {
      const incoming = parseNotesBackup(await file.text());
      const local = await listSermonNotes();
      const merged = mergeSermonNotes(local, incoming.notes);
      await saveSermonNotes(merged.notes);
      setNotes(merged.notes);
      replaceCurrentDraft(merged.notes.find((note) => note.id === currentId));
      notify(`가져오기 완료: 새 노트 ${merged.added}개, 최신 내용 ${merged.updated}개 반영`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "노트 백업을 가져오지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const exportWord = async (all: boolean) => {
    setBusy(all ? "word-all" : "word-current");
    try {
      const current = dirty ? buildCurrentNote() : notes.find((note) => note.id === currentId) || buildCurrentNote();
      const selected = all ? await notesWithCurrent() : (hasSermonNoteContent(current) ? [current] : []);
      if (!selected.length) return notify("Word 문서로 만들 노트가 없습니다.");
      if (!all && dirty) {
        await saveSermonNote(current);
        setDirty(false);
        setSaveStatus("저장됨");
      }
      const blob = await sermonNotesWordBlob(selected);
      const name = all ? `말씀숲-설교노트-${new Date().toISOString().slice(0, 10)}.docx` : `${current.reference}-${current.title || "설교노트"}.docx`;
      downloadBlob(blob, name);
      notify(all ? "전체 설교 노트를 Word 문서로 정리했습니다." : "선택 절의 노트를 Word 문서로 만들었습니다.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Word 문서를 만들지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const syncGoogleDrive = async () => {
    setBusy("google");
    try {
      const current = dirty ? buildCurrentNote() : notes.find((note) => note.id === currentId) || buildCurrentNote();
      const local = hasSermonNoteContent(current)
        ? [current, ...notes.filter((note) => note.id !== current.id)]
        : notes;
      const merged = await syncSermonNotesWithGoogleDrive(local);
      await saveSermonNotes(merged.notes);
      setNotes(merged.notes);
      replaceCurrentDraft(merged.notes.find((note) => note.id === currentId));
      notify(`Google Drive 동기화 완료: 가져온 새 노트 ${merged.added}개, 최신 내용 ${merged.updated}개`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Google Drive와 동기화하지 못했습니다.");
    } finally {
      setBusy("");
    }
  };

  const removeCurrent = async () => {
    const stored = notes.find((note) => note.id === currentId);
    if (!stored || !window.confirm(`‘${stored.reference}’ 설교 노트를 이 기기에서 삭제할까요?`)) return;
    await removeSermonNote(currentId);
    setNotes((current) => current.filter((note) => note.id !== currentId));
    replaceCurrentDraft(undefined);
    notify("선택 절의 설교 노트를 삭제했습니다.");
  };

  const useInsightDraft = () => {
    if (!insight) return notify("먼저 이 절의 영적 통찰을 생성해 주세요.");
    setDirty(true);
    setDraft((current) => ({
      ...current,
      meditation: [current.meditation, `[통찰 참고 초안]\n${insight.summary}\n\n${insight.theology}`].filter(Boolean).join("\n\n"),
      application: [current.application, `[통찰 참고 초안]\n${insight.application}`].filter(Boolean).join("\n\n"),
      outline: [current.outline, `[통찰 참고 초안]\n${insight.sermonBridge}\n\n해석의 주의점: ${insight.guardrail}`].filter(Boolean).join("\n\n"),
    }));
    notify("AI 통찰을 참고 초안으로 넣었습니다. 본문에 따라 직접 다듬어 주세요.");
  };

  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredNotes = notes.filter((note) => !normalizedQuery || [note.reference, note.title, note.meditation, ...note.tags].join(" ").toLocaleLowerCase("ko-KR").includes(normalizedQuery));

  return <ModalShell title="설교 노트" subtitle="선택한 절마다 묵상·적용·설교 개요를 기록하고 다른 기기로 옮길 수 있습니다." onClose={() => void closeNotes()} wide>
    <div className="notes-browser">
      <aside className="notes-sidebar">
        <div className="notes-search"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="구절, 제목, 태그 검색"/></div>
        <div className="notes-list-head"><strong>저장된 노트</strong><span>{notes.length}개</span></div>
        <div className="notes-list">
          {filteredNotes.map((note) => <button key={note.id} className={note.id === currentId ? "active" : ""} onClick={() => void selectSavedNote(note)}>
            <span>{note.reference}</span><strong>{note.title || "제목 없는 묵상"}</strong><small>{note.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ") || new Date(note.updatedAt).toLocaleDateString("ko-KR")}</small>
          </button>)}
          {!filteredNotes.length && <div className="empty-list">{notes.length ? "검색 결과가 없습니다." : "아직 저장된 노트가 없습니다."}</div>}
        </div>
      </aside>

      <section className="note-editor">
        <div className="note-reference">
          <div><span>{formatReference(reference)} · {translation}</span><p>{verseText || "선택한 역본에서 이 절의 본문을 불러오는 중입니다."}</p></div>
          <span className={`save-status ${saveStatus === "저장됨" ? "saved" : ""}`}>{saveStatus}</span>
        </div>
        <div className="note-fields">
          <label className="note-title"><span>노트 제목</span><input value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="예: 은혜 안에서 걷는 사람"/></label>
          <div className="note-field-grid">
            <label><span>개인 묵상</span><textarea value={draft.meditation} onChange={(event) => setField("meditation", event.target.value)} placeholder="본문에서 발견한 하나님의 성품, 마음에 머문 질문과 깨달음…"/></label>
            <label><span>삶과 공동체의 적용</span><textarea value={draft.application} onChange={(event) => setField("application", event.target.value)} placeholder="오늘 순종할 일, 교회와 청중에게 연결할 구체적인 적용…"/></label>
            <label><span>설교 메모와 개요</span><textarea value={draft.outline} onChange={(event) => setField("outline", event.target.value)} placeholder="핵심 문장, 대지, 예화, 연결 구절, 주의할 해석…"/></label>
            <label><span>기도</span><textarea value={draft.prayer} onChange={(event) => setField("prayer", event.target.value)} placeholder="본문 앞에서 드리는 기도와 결단…"/></label>
          </div>
          <label className="note-tags"><span>태그</span><input value={draft.tagsText} onChange={(event) => setField("tagsText", event.target.value)} placeholder="은혜, 창세기, 어린이설교 (쉼표로 구분)"/></label>
        </div>
        <div className="note-editor-actions">
          <button className="soft-button" onClick={useInsightDraft}><Icon name="sparkle" size={17}/> 통찰을 참고 초안으로</button>
          {notes.some((note) => note.id === currentId) && <button className="soft-button danger-text" onClick={() => void removeCurrent()}><Icon name="trash" size={17}/> 노트 삭제</button>}
        </div>
      </section>
    </div>

    <div className="note-transfer-bar">
      <div className="note-transfer-info"><Icon name="shield" size={19}/><span><strong>기본 저장은 이 기기 안에서만</strong><small>아래 동기화·내보내기 버튼을 누를 때만 노트가 파일 또는 Google Drive로 이동합니다.</small></span></div>
      <div className="note-transfer-actions">
        {googleDriveConfigured() && <button className="primary-button" disabled={Boolean(busy) || !driveReady} onClick={() => void syncGoogleDrive()}><Icon name="cloud" size={17}/>{busy === "google" ? "동기화 중…" : driveReady ? "Google Drive 동기화" : "Google 연결 준비 중…"}</button>}
        <button className="soft-button" disabled={Boolean(busy)} onClick={() => void exportBackup(true)}><Icon name="cloud" size={17}/>{busy === "backup" ? "백업 중…" : "Drive용 백업"}</button>
        <button className="soft-button" disabled={Boolean(busy)} onClick={() => importRef.current?.click()}><Icon name="upload" size={17}/>{busy === "import" ? "가져오는 중…" : "백업 가져오기"}</button>
        <button className="soft-button" disabled={Boolean(busy)} onClick={() => void exportWord(false)}><Icon name="file" size={17}/>{busy === "word-current" ? "만드는 중…" : "이 절 Word"}</button>
        <button className="soft-button" disabled={Boolean(busy)} onClick={() => void exportWord(true)}><Icon name="download" size={17}/>{busy === "word-all" ? "만드는 중…" : "전체 Word"}</button>
        <button className="soft-button" disabled={Boolean(busy)} onClick={() => void exportBackup()}><Icon name="download" size={17}/> JSON 보관</button>
      </div>
      {!googleDriveConfigured() && <p className="google-fallback-note">현재는 <b>Drive용 백업</b>으로 Google Drive에 보관한 뒤, 다른 컴퓨터에서 <b>백업 가져오기</b>를 사용하세요. 원클릭 동기화는 Google OAuth 클라이언트 ID를 연결하면 자동으로 활성화됩니다.</p>}
      <input ref={importRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)}/>
    </div>
  </ModalShell>;
}

function SettingsModal({ dark, setDark, fontScale, setFontScale, onInstall, onClose }: { dark: boolean; setDark: (value: boolean) => void; fontScale: number; setFontScale: (value: number) => void; onInstall: () => Promise<void>; onClose: () => void }) {
  const changeFontScale = (delta: number) => setFontScale(Number(Math.min(1.3, Math.max(.85, fontScale + delta)).toFixed(2)));
  const fontPercent = Math.round(fontScale * 100);

  return <ModalShell title="읽기 설정" subtitle="화면 밝기와 본문 글자 크기를 조절합니다." onClose={onClose}>
    <div className="settings-list">
      <div>
        <span><strong>화면 테마</strong><small>선택한 모드는 이 기기에 저장됩니다.</small></span>
        <div className="segmented" role="group" aria-label="화면 테마 선택">
          <button className={!dark ? "active" : ""} aria-pressed={!dark} onClick={() => setDark(false)}><Icon name="sun" size={17}/> 화이트 모드</button>
          <button className={dark ? "active" : ""} aria-pressed={dark} onClick={() => setDark(true)}><Icon name="moon" size={17}/> 다크 모드</button>
        </div>
      </div>
      <div>
        <span><strong>본문 글자 크기</strong><small>본문·원문·통찰 패널에 함께 적용됩니다.</small></span>
        <div className="font-settings">
          <div className="font-control">
            <button onClick={() => changeFontScale(-.05)} disabled={fontScale <= .85} aria-label="글자 크기 줄이기">가−</button>
            <input aria-label="본문 글자 크기" type="range" min="0.85" max="1.3" step="0.05" value={fontScale} onChange={(event) => setFontScale(Number(event.target.value))}/>
            <button onClick={() => changeFontScale(.05)} disabled={fontScale >= 1.3} aria-label="글자 크기 키우기">가+</button>
          </div>
          <div className="font-scale-status"><output aria-live="polite">{fontPercent}%</output><button onClick={() => setFontScale(1)} disabled={fontScale === 1}>기본 크기</button></div>
        </div>
      </div>
      <div><span><strong>휴대폰에 설치</strong><small>전체 화면과 오프라인 앱 셸을 사용합니다.</small></span><button className="soft-button" onClick={() => void onInstall()}><Icon name="download" size={17}/> 홈 화면에 추가</button></div>
    </div>
    <div className="about-box"><span className="brand-mark"><Icon name="book"/></span><div><strong>말씀숲 0.1</strong><p>본문의 원래 뜻을 존중하며 설교자의 깊은 읽기를 돕습니다.</p></div></div>
  </ModalShell>;
}

export default App;
