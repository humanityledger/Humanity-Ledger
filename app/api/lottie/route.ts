import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Lottie file server resolves files from local project paths only.
 * Hardcoded personal paths have been removed for security.
 */

const SEARCH_DIRS: string[] = [
  join(process.cwd(), 'public'),
  join(process.cwd(), 'public', 'lotties'),
  join(process.cwd(), 'lotties'),
];

function resolveLottiePath(safeFilename: string): string | null {
  for (const dir of SEARCH_DIRS) {
    const candidate = join(dir, safeFilename);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function listAllLottieFiles() {
  const found = new Map<string, number>();
  for (const dir of SEARCH_DIRS) {
    try {
      if (!existsSync(dir)) continue;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.json')) continue;
        if (
          entry.name === 'manifest.json' ||
          entry.name === 'package.json' ||
          entry.name === 'tsconfig.json' ||
          entry.name === 'sample-system-signal.json'
        ) continue;
        
        const stats = statSync(join(dir, entry.name));
        found.set(entry.name, stats.mtimeMs);
      }
    } catch {
      // Directory not accessible  skip silently
    }
  }
  return Array.from(found.entries()).map(([name, mtime]) => ({ name, mtime })).sort((a, b) => b.mtime - a.mtime);
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('file');

    if (filename === '__list__') {
      const files = listAllLottieFiles();
      return NextResponse.json({
        files: files.map(f => f.name),
        searchDirs: SEARCH_DIRS,
        count: files.length,
      });
    }

    if (!filename) return NextResponse.json({ error: 'Filename is required' }, { status: 400 });

    const safeFilename = filename.replace(/\\/g, '/').split('/').pop() || '';
    if (!safeFilename.endsWith('.json')) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });

    const filePath = resolveLottiePath(safeFilename);

    if (!filePath) {
      return NextResponse.json({ error: 'File not found', file: safeFilename }, { status: 404 });
    }

    const data = readFileSync(filePath, 'utf-8');
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
