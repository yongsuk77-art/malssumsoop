const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_FILE = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_END_RECORD_SIZE = 22 + 0xffff;

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function zipError(message: string): Error {
  return new Error(`찬송가 악보 묶음을 읽지 못했습니다: ${message}`);
}

async function entries(blob: Blob): Promise<ZipEntry[]> {
  const tailOffset = Math.max(0, blob.size - MAX_END_RECORD_SIZE);
  const tail = await blob.slice(tailOffset).arrayBuffer();
  const tailView = new DataView(tail);
  let endOffset = -1;
  for (let offset = tail.byteLength - 22; offset >= 0; offset -= 1) {
    if (tailView.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw zipError("ZIP 목록을 찾을 수 없습니다.");

  const centralSize = tailView.getUint32(endOffset + 12, true);
  const centralOffset = tailView.getUint32(endOffset + 16, true);
  if (centralOffset + centralSize > blob.size) throw zipError("ZIP 목록 위치가 올바르지 않습니다.");

  const central = await blob.slice(centralOffset, centralOffset + centralSize).arrayBuffer();
  const view = new DataView(central);
  const decoder = new TextDecoder();
  const result: ZipEntry[] = [];
  let offset = 0;
  while (offset + 46 <= central.byteLength) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_FILE) break;
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > central.byteLength) throw zipError("파일 이름 정보가 손상되었습니다.");
    result.push({
      name: decoder.decode(new Uint8Array(central, fileNameStart, fileNameLength)),
      compression: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset = fileNameEnd + extraLength + commentLength;
  }
  if (!result.length) throw zipError("악보 이미지가 없습니다.");
  return result;
}

export async function storedZipEntryNames(blob: Blob): Promise<string[]> {
  return (await entries(blob)).map((entry) => entry.name);
}

export async function storedZipFile(blob: Blob, candidates: string[], mimeType: string): Promise<Blob | undefined> {
  const wanted = new Set(candidates.map((name) => name.toLocaleLowerCase()));
  const entry = (await entries(blob)).find((item) => wanted.has(item.name.toLocaleLowerCase()));
  if (!entry) return undefined;
  if (entry.compression !== 0) throw zipError("이 악보 파일의 압축 방식은 아직 지원하지 않습니다.");

  const header = await blob.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer();
  if (header.byteLength < 30) throw zipError("악보 위치 정보가 손상되었습니다.");
  const view = new DataView(header);
  if (view.getUint32(0, true) !== LOCAL_FILE_HEADER) throw zipError("악보 파일 머리말이 손상되었습니다.");
  const dataOffset = entry.localHeaderOffset + 30 + view.getUint16(26, true) + view.getUint16(28, true);
  return blob.slice(dataOffset, dataOffset + entry.compressedSize, mimeType);
}
