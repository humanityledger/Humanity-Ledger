/**
 * checkpoint-image API  Sovereign Asset Serving
 * 
 * Serves high-fidelity 4K pattern assets from the local filesystem.
 */

import { readFileSync, existsSync } from "fs";
import { NextResponse } from "next/server";
import path from "path";

//  Asset alias map 
// Maps clean semantic names  actual filesystem paths
const ASSET_ALIAS: Record<string, string[]> = {
  "official-ledger-system.png": [
    path.join(process.cwd(), "public", "official-ledger-system.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
  ],
  "ledger-logo-institutional.png": [
    path.join(process.cwd(), "public", "official-ledger-system.png"),
    path.join(process.cwd(), "public", "logo-mark.png"),
    path.join(process.cwd(), "public", "ledger-logo-institutional.png"),
  ],
  "corporate-cube-grid.jpg": [
    path.join(process.cwd(), "public", "corporate-cube-grid.jpg"),
    path.join(process.cwd(), "public", "corporate-logo.jpg"),
  ],
  "celestial-mesh-watermark.png": [
    path.join(process.cwd(), "public", "celestial-mesh-watermark.png"),
    path.join(process.cwd(), "public", "patron-cosmico-4k.png"),
  ],
  "logan-voss.jpg": [
    path.join(process.cwd(), "public", "models", "update", "logan-voss-VTWMWadBMvM-unsplash.jpg"),
  ],
};

const PUBLIC_DIR = path.join(process.cwd(), "public");

function detectMime(filePath: string): string {
  const ext = filePath.toLowerCase();
  if (ext.endsWith(".png"))  return "image/png";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".gif"))  return "image/gif";
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name || name.includes("..")) {
    return new NextResponse("Missing or invalid name", { status: 400 });
  }

  // 1️ Check alias map first
  const aliasPaths = ASSET_ALIAS[name] || [path.join(PUBLIC_DIR, name)];
  
  for (const candidate of aliasPaths) {
    if (existsSync(candidate)) {
      try {
        const buf = readFileSync(candidate);
        return new NextResponse(buf, {
          headers: {
            "Content-Type": detectMime(candidate),
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Asset-Source": "System-Local"
          },
        });
      } catch (e) {
        console.error(`Failed to read asset: ${candidate}`, e);
        continue;
      }
    }
  }

  return new NextResponse("Not Found", { status: 404 });
}
