import type { Paragraph as DocxParagraph } from "docx";
import type { SermonNote } from "../types";
import { legacyHtmlToText } from "./text";

const BLACK = "000000";
const MUTED = "555555";
type DocxApi = typeof import("docx");

function textParagraphs(docx: DocxApi, text: string): DocxParagraph[] {
  const { Paragraph, TextRun } = docx;
  const paragraphs = text.trim().replace(/\\n/g, "\n").split(/\n{2,}/).filter(Boolean);
  return paragraphs.map((paragraph) => new Paragraph({
    children: paragraph.split("\n").map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, font: "Arial", size: 22, color: BLACK })),
  }));
}

function noteSection(docx: DocxApi, title: string, text: string): DocxParagraph[] {
  const { HeadingLevel, Paragraph } = docx;
  if (!text.trim()) return [];
  return [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
    ...textParagraphs(docx, text),
  ];
}

function noteParagraphs(docx: DocxApi, note: SermonNote, index: number): DocxParagraph[] {
  const { HeadingLevel, LineRuleType, Paragraph, TextRun } = docx;
  const verseText = legacyHtmlToText(note.verseText);
  const title = note.title.trim() || note.reference;
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: index > 0,
      children: [new TextRun({ text: note.reference, font: "Arial", size: 40, color: BLACK })],
    }),
    new Paragraph({
      children: [new TextRun({ text: title, font: "Arial", size: 28, color: BLACK })],
      spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO },
    }),
    ...(verseText ? [new Paragraph({
      children: [
        new TextRun({ text: verseText, font: "Arial", size: 22, color: MUTED, italics: true }),
        ...(note.translation ? [new TextRun({ text: `  — ${note.translation}`, font: "Arial", size: 18, color: MUTED })] : []),
      ],
      spacing: { after: 200, line: 276, lineRule: LineRuleType.AUTO },
    })] : []),
    ...noteSection(docx, "개인 묵상", note.meditation),
    ...noteSection(docx, "삶과 공동체의 적용", note.application),
    ...noteSection(docx, "설교 메모와 개요", note.outline),
    ...noteSection(docx, "기도", note.prayer),
    ...(note.tags.length ? [new Paragraph({
      children: [new TextRun({ text: `태그  ${note.tags.map((tag) => `#${tag}`).join("  ")}`, font: "Arial", size: 18, color: MUTED })],
      spacing: { before: 160, after: 80, line: 276, lineRule: LineRuleType.AUTO },
    })] : []),
    new Paragraph({
      children: [new TextRun({ text: `마지막 수정 ${new Date(note.updatedAt).toLocaleString("ko-KR")}`, font: "Arial", size: 17, color: MUTED })],
      spacing: { after: 160, line: 276, lineRule: LineRuleType.AUTO },
    }),
  ];
}

export async function sermonNotesWordBlob(notes: SermonNote[]): Promise<Blob> {
  if (!notes.length) throw new Error("Word 문서로 정리할 설교 노트가 없습니다.");
  const docx = await import("docx");
  const { Document, LineRuleType, Packer, Paragraph, TextRun, convertInchesToTwip } = docx;
  const children: DocxParagraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "말씀숲 설교 노트", font: "Arial", size: 52, color: BLACK })],
      spacing: { before: 0, after: 60, line: 276, lineRule: LineRuleType.AUTO },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${notes.length}개 절 · ${new Date().toLocaleDateString("ko-KR")} 내보냄`, font: "Arial", size: 20, color: MUTED })],
      spacing: { after: 240, line: 276, lineRule: LineRuleType.AUTO },
    }),
    ...notes.flatMap((note, index) => noteParagraphs(docx, note, index)),
  ];

  const document = new Document({
    creator: "말씀숲",
    title: "말씀숲 설교 노트",
    description: "선택한 성경절에 기록한 개인 묵상, 적용, 설교 개요와 기도",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: BLACK },
          paragraph: { spacing: { before: 0, after: 160, line: 276, lineRule: LineRuleType.AUTO } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 40, color: BLACK },
          paragraph: { spacing: { before: 400, after: 120, line: 276, lineRule: LineRuleType.AUTO }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 32, color: BLACK },
          paragraph: { spacing: { before: 360, after: 120, line: 276, lineRule: LineRuleType.AUTO }, keepNext: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12_240, height: 15_840 },
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1),
            header: convertInchesToTwip(0.492),
            footer: convertInchesToTwip(0.492),
          },
        },
      },
      children,
    }],
  });
  return Packer.toBlob(document);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.replace(/[\\/:*?"<>|]/g, "-");
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
