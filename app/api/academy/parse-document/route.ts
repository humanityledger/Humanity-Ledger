import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name || 'document';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = '';

    if (ext === 'docx') {
      try {
        const zip = new AdmZip(buffer);
        const xml = zip.readAsText('word/document.xml');
        extractedText = xml
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim();
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: 'Failed to read DOCX file: ' + err.message }, { status: 422 });
      }
    } else if (ext === 'pdf') {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        extractedText = (typeof result === 'string' ? result : (result?.text || '')).trim();
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: 'Failed to read PDF file: ' + err.message }, { status: 422 });
      }
    } else {
      // Plain text, markdown, csv, etc.
      extractedText = buffer.toString('utf-8').trim();
    }

    if (!extractedText || extractedText.length < 20) {
      return NextResponse.json({
        ok: false,
        error: 'The extracted text is too short or empty. Please ensure the document contains readable text.'
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      text: extractedText,
      fileName,
      characterCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    });

  } catch (error: any) {
    console.error('[API:parse-document] Error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error parsing file' }, { status: 500 });
  }
}
