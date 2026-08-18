import { describe, expect, it } from "vitest";
import { storedZipEntryNames, storedZipFile } from "./storedZip";

function storedZip(name: string, content: Uint8Array): Blob {
  const encodedName = new TextEncoder().encode(name);
  const localLength = 30 + encodedName.length + content.length;
  const centralLength = 46 + encodedName.length;
  const bytes = new Uint8Array(localLength + centralLength + 22);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint32(18, content.length, true);
  view.setUint32(22, content.length, true);
  view.setUint16(26, encodedName.length, true);
  bytes.set(encodedName, 30);
  bytes.set(content, 30 + encodedName.length);

  const central = localLength;
  view.setUint32(central, 0x02014b50, true);
  view.setUint16(central + 4, 20, true);
  view.setUint16(central + 6, 20, true);
  view.setUint32(central + 20, content.length, true);
  view.setUint32(central + 24, content.length, true);
  view.setUint16(central + 28, encodedName.length, true);
  view.setUint32(central + 42, 0, true);
  bytes.set(encodedName, central + 46);

  const end = central + centralLength;
  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 8, 1, true);
  view.setUint16(end + 10, 1, true);
  view.setUint32(end + 12, centralLength, true);
  view.setUint32(end + 16, central, true);
  return new Blob([bytes], { type: "application/zip" });
}

describe("stored hymn ZIP reader", () => {
  it("lists and extracts an uncompressed score image", async () => {
    const archive = storedZip("p12.png", new Uint8Array([137, 80, 78, 71]));
    await expect(storedZipEntryNames(archive)).resolves.toEqual(["p12.png"]);
    const image = await storedZipFile(archive, ["p12.png"], "image/png");
    expect(image?.type).toBe("image/png");
    expect([...new Uint8Array(await image!.arrayBuffer())]).toEqual([137, 80, 78, 71]);
  });

  it("returns undefined when the requested hymn is absent", async () => {
    const archive = storedZip("1.png", new Uint8Array([1, 2, 3]));
    await expect(storedZipFile(archive, ["2.png"], "image/png")).resolves.toBeUndefined();
  });
});
