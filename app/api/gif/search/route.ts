import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // Using a more robust Tenor API key or fallback.
    // If we exceed quota, we should degrade gracefully.
    // We use the public key as fallback, but if they add an ENV var, we use that.
    const apiKey = process.env.TENOR_API_KEY;
    
    const response = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=20&media_filter=gif`
    );

    if (!response.ok) {
      console.error('[GIF API] Tenor API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'GIF service unavailable', results: [] }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GIF API] Error fetching GIFs:', error);
    return NextResponse.json({ error: 'Internal server error', results: [] }, { status: 500 });
  }
}
