// Minimal types for the part of adm-zip this app uses
// (app/api/academy/parse-document/route.ts). adm-zip ships no types and
// @types/adm-zip is not a dependency; without this, `tsc --noEmit` fails.
declare module 'adm-zip' {
  interface IZipEntryHeader {
    /** Uncompressed size as claimed by the archive (untrusted). */
    size: number;
    /** 0 = stored, 8 = deflate. */
    method: number;
  }
  interface IZipEntry {
    entryName: string;
    isDirectory: boolean;
    header: IZipEntryHeader;
    getCompressedData(): Buffer;
    getData(): Buffer;
  }
  class AdmZip {
    constructor(input?: string | Buffer);
    getEntry(name: string): IZipEntry | null;
    getEntries(): IZipEntry[];
  }
  export = AdmZip;
}
