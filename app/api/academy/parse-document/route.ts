import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { getVerifiedCaller } from '@/lib/security/verifiedCaller';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';

export const dynamic = 'force-dynamic';

// Limits keep one request from tying up the server: the upload itself, the
// unzipped size of a .docx body (a small zip can expand to gigabytes), and
// the text sent back.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DOCX_XML_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;
const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'rtf', 'tex']);

export async function POST(req: NextRequest) {
  // /academy is a public page, so visitors without an account may upload too;
  // they get a tighter per-IP budget than signed-in accounts.
  const caller = await getVerifiedCaller(req);
  const rl = caller
    ? await checkRateLimit(caller, { max: 20, windowSec: 600, prefix: 'rl:academy-parse' })
    : await checkRateLimit(getClientIP(req), { max: 6, windowSec: 600, prefix: 'rl:academy-parse-ip' });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });
  }

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: 'File is too large (10 MB max).' }, { status: 413 });
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid upload' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'File is too large (10 MB max).' }, { status: 413 });
    }

    const fileName = String(file.name || 'document').slice(0, 200);
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : 'txt';
    const buffer = Buffer.from(await file.arrayBuffer());

    let extractedText = '';

    if (ext === 'docx') {
      try {
        const zip = new AdmZip(buffer);
        const entry = zip.getEntry('word/document.xml');
        if (!entry) throw new Error('missing body');
        if (entry.header.size > MAX_DOCX_XML_BYTES) {
          return NextResponse.json({ ok: false, error: 'This document is too large to read.' }, { status: 413 });
        }
        const xml = entry.getData().toString('utf8');
        extractedText = xml
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();
      } catch {
        return NextResponse.json({ ok: false, error: 'Could not read this DOCX file.' }, { status: 422 });
      }
    } else if (ext === 'pdf') {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        extractedText = (typeof result === 'string' ? result : (result?.text || '')).trim();
      } catch {
        return NextResponse.json({ ok: false, error: 'Could not read this PDF file.' }, { status: 422 });
      }
    } else if (TEXT_EXTS.has(ext)) {
      extractedText = buffer.toString('utf-8').trim();
    } else {
      return NextResponse.json({ ok: false, error: 'Unsupported file type. Use PDF, DOCX or a text file.' }, { status: 415 });
    }

    if (!extractedText || extractedText.length < 20) {
      return NextResponse.json({
        ok: false,
        error: 'The extracted text is too short or empty. Please ensure the document contains readable text.'
      }, { status: 422 });
    }

    const truncated = extractedText.length > MAX_TEXT_CHARS;
    if (truncated) extractedText = extractedText.slice(0, MAX_TEXT_CHARS);

    return NextResponse.json({
      ok: true,
      text: extractedText,
      fileName,
      truncated,
      characterCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    });
  } catch (error) {
    console.error('[API:parse-document] Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error parsing file' }, { status: 500 });
  }
}
