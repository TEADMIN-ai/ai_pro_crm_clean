import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const brandRoot = path.join(process.cwd(), "public", "corporate");

function resolveContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const resolvedParams = await params;
  const segments = resolvedParams.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json({ error: "Missing brand asset path" }, { status: 404 });
  }

  const relativePath = path.join(...segments);
  const targetPath = path.join(brandRoot, relativePath);
  const normalizedRoot = path.normalize(brandRoot + path.sep);
  const normalizedTarget = path.normalize(targetPath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    return NextResponse.json({ error: "Invalid brand asset path" }, { status: 400 });
  }

  try {
    const bytes = await fs.readFile(normalizedTarget);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": resolveContentType(normalizedTarget),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Brand asset not found" }, { status: 404 });
  }
}


