import { NextResponse } from 'next/server';

// The map no longer renders all buildings upfront — they're fetched on demand via /api/building/[osmId].
// This endpoint is kept for potential future use (e.g. bounding-box queries).
export async function GET() {
  return NextResponse.json([]);
}
