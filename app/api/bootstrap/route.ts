import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves ML artifacts from disk. More reliable than relying on static file
 * routing alone when debugging iframe + production server issues.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "bootstrap.json");
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "bootstrap.json not found. Run: npm run build:data (from investiq/)",
      },
      { status: 404 },
    );
  }
}
