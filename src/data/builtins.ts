import type { LibraryMeta } from "../types";

export type BuiltinBible = LibraryMeta & {
  dataId: string;
  description: string;
  license: string;
};

export type BuiltinStudyResource = {
  id: string;
  name: string;
  description: string;
};

export const BUILTIN_BIBLES: BuiltinBible[] = [
  {
    id: "builtin-kor1910",
    dataId: "kor1910",
    name: "한국어 성경 1910",
    fileName: "Korean Bible 1910",
    extension: "json",
    kind: "bible",
    size: 0,
    importedAt: "",
    description: "처음부터 제공되는 한글 성경",
    license: "Public Domain",
  },
  {
    id: "builtin-web",
    dataId: "web",
    name: "WEB",
    fileName: "World English Bible",
    extension: "json",
    kind: "bible",
    size: 0,
    importedAt: "",
    description: "현대 영어 공개 역본",
    license: "Public Domain",
  },
  {
    id: "builtin-ylt",
    dataId: "ylt",
    name: "YLT",
    fileName: "Young's Literal Translation",
    extension: "json",
    kind: "bible",
    size: 0,
    importedAt: "",
    description: "원문 어순을 살피는 직역 영어 성경",
    license: "Public Domain",
  },
  {
    id: "builtin-asv",
    dataId: "asv",
    name: "ASV",
    fileName: "American Standard Version (1901)",
    extension: "json",
    kind: "bible",
    size: 0,
    importedAt: "",
    description: "1901년 미국 표준역",
    license: "Public Domain",
  },
];

export const DEFAULT_BIBLE_IDS = BUILTIN_BIBLES.map((library) => library.id);

export const BUILTIN_STUDY_RESOURCES: BuiltinStudyResource[] = [
  {
    id: "builtin-hebrew-morph",
    name: "히브리어 구약 원문·분해",
    description: "Open Scriptures Hebrew Bible · 형태 분석 · 스트롱 코드 · 한글 음가",
  },
  {
    id: "builtin-greek-morph",
    name: "헬라어 신약 원문·분해",
    description: "STEPBible TAGNT-TR · 형태 분석 · 스트롱 코드 · 한글 음가",
  },
];

export function builtinBibleById(id: string): BuiltinBible | undefined {
  return BUILTIN_BIBLES.find((library) => library.id === id);
}

export function isBuiltinBible(id: string): boolean {
  return Boolean(builtinBibleById(id));
}
