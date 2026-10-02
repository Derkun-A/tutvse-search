import { NextResponse } from "next/server";

import { readDatabaseStats } from "@/lib/google-sheets/reader";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await readDatabaseStats();

    return NextResponse.json({
      ok: true,
      ...stats,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database read error";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status: 500,
      },
    );
  }
}
