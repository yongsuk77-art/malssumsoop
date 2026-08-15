import type { Insight, MorphWord } from "../types";
import { getInsight, saveInsight } from "./storage";

type InsightInput = {
  reference: string;
  translation: string;
  verse: string;
  previousVerse?: string;
  nextVerse?: string;
  originalWords?: MorphWord[];
};

async function cacheKey(input: InsightInput): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cachedInsight(input: InsightInput): Promise<Insight | undefined> {
  return (await getInsight(await cacheKey(input)))?.insight;
}

export async function generateInsight(input: InsightInput, force = false): Promise<Insight> {
  const key = await cacheKey(input);
  if (!force) {
    const cached = await getInsight(key);
    if (cached) return cached.insight;
  }
  const response = await fetch("/api/insight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload: unknown = await response.json();
  if (!response.ok || typeof payload !== "object" || payload === null || !("insight" in payload)) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "통찰을 생성하지 못했습니다.";
    throw new Error(message);
  }
  const insight = (payload as { insight: Insight }).insight;
  await saveInsight({ key, insight, generatedAt: new Date().toISOString() });
  return insight;
}
