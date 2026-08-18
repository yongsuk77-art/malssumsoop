import type { SermonNote } from "../types";
import { createNotesBackup, mergeSermonNotes, parseNotesBackup } from "./notes";

const CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILE_NAME = "말씀숲-설교노트-동기화.json";
const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (options: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: { type?: string }) => void;
        }) => GoogleTokenClient;
      };
    };
  };
};

let accessToken = "";
let tokenExpiresAt = 0;
let scriptPromise: Promise<void> | undefined;

export function googleDriveConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

function googleWindow(): GoogleIdentityWindow {
  return window as GoogleIdentityWindow;
}

export function prepareGoogleDrive(): Promise<void> {
  if (!CLIENT_ID) return Promise.reject(new Error("Google OAuth 클라이언트 ID가 아직 설정되지 않았습니다."));
  if (googleWindow().google?.accounts?.oauth2) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.remove();
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google 연결 모듈을 불러오지 못했습니다."));
    document.head.append(script);
  });
  return scriptPromise;
}

async function authorize(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken;
  if (!googleWindow().google?.accounts?.oauth2) await prepareGoogleDrive();
  const oauth = googleWindow().google?.accounts?.oauth2;
  if (!oauth) throw new Error("Google 연결을 시작하지 못했습니다.");
  return new Promise((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description || "Google Drive 권한을 받지 못했습니다."));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + Math.max(60, response.expires_in || 3_600) * 1_000;
        resolve(accessToken);
      },
      error_callback: () => reject(new Error("Google 계정 연결 창이 닫혔거나 차단되었습니다.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (response.status === 401) {
    accessToken = "";
    tokenExpiresAt = 0;
    throw new Error("Google 연결 시간이 끝났습니다. 동기화 버튼을 다시 눌러 주세요.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as { error?: { message?: string } };
      detail = body.error?.message || "";
    } catch {
      detail = "";
    }
    throw new Error(detail ? `Google Drive 동기화 실패: ${detail}` : "Google Drive 동기화에 실패했습니다.");
  }
  return response;
}

async function findDriveFile(token: string): Promise<string | undefined> {
  const query = "appProperties has { key='malssumsoopKind' and value='sermon-notes' } and trashed = false";
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  const response = await driveFetch(url.toString(), token);
  const body = await response.json() as { files?: { id: string }[] };
  return body.files?.[0]?.id;
}

async function downloadDriveNotes(token: string, fileId: string): Promise<SermonNote[]> {
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, token);
  const text = await response.text();
  return parseNotesBackup(text).notes;
}

async function uploadDriveNotes(token: string, notes: SermonNote[], fileId?: string): Promise<void> {
  const boundary = `malssumsoop_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = {
    name: DRIVE_FILE_NAME,
    mimeType: "application/json",
    appProperties: { malssumsoopKind: "sermon-notes", formatVersion: "1" },
  };
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(createNotesBackup(notes))}\r\n`,
    `--${boundary}--`,
  ].join("");
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  await driveFetch(endpoint, token, {
    method: fileId ? "PATCH" : "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function syncSermonNotesWithGoogleDrive(localNotes: SermonNote[]): Promise<{ notes: SermonNote[]; added: number; updated: number; kept: number }> {
  const token = await authorize();
  const fileId = await findDriveFile(token);
  const remoteNotes = fileId ? await downloadDriveNotes(token, fileId) : [];
  const merged = mergeSermonNotes(localNotes, remoteNotes);
  await uploadDriveNotes(token, merged.notes, fileId);
  return merged;
}
