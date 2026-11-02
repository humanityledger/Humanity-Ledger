import { NextResponse } from 'next/server';

// Verified, high-availability animated GIFs across top categories
const FALLBACK_GIFS: Array<{ tags: string[]; url: string }> = [
  // Happy / Joy / Smile / Celebrate
  { tags: ['happy', 'joy', 'smile', 'laugh', 'lol', 'haha', 'excited', 'party', 'celebrate'], url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
  { tags: ['happy', 'dance', 'yay', 'hooray', 'celebrate'], url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { tags: ['celebrate', 'confetti', 'cheers', 'party', 'win'], url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
  { tags: ['excited', 'woohoo', 'hype', 'yes', 'awesome'], url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' },
  
  // Yes / Thumbs Up / Agreed / Perfect
  { tags: ['yes', 'agree', 'nod', 'thumbs up', 'ok', 'sure', 'perfect'], url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { tags: ['thumbs up', 'approve', 'cool', 'good', 'nice', 'great'], url: 'https://media.giphy.com/media/10uEX5kfeodYgo/giphy.gif' },
  { tags: ['nod', 'yes', 'correct', 'right', 'agreed'], url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
  { tags: ['mind blown', 'wow', 'omg', 'what', 'shocked'], url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },

  // Love / Heart / Thanks
  { tags: ['love', 'heart', 'hug', 'sweet', 'cute'], url: 'https://media.giphy.com/media/R6gVNROjZa40P0G234/giphy.gif' },
  { tags: ['thanks', 'thank you', 'grateful', 'appreciate'], url: 'https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif' },
  { tags: ['applause', 'clap', 'bravo', 'congrats', 'cheering'], url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif' },

  // Crypto / Money / To the moon / Rocket
  { tags: ['crypto', 'bitcoin', 'eth', 'money', 'rich', 'cash', 'pay'], url: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif' },
  { tags: ['rocket', 'moon', 'bullish', 'pump', 'crypto', 'to the moon'], url: 'https://media.giphy.com/media/tXLpxypfSXvUc/giphy.gif' },
  { tags: ['hacker', 'code', 'typing', 'matrix', 'tech'], url: 'https://media.giphy.com/media/YQitE4YNQNahy/giphy.gif' },

  // No / Bye / Thinking / Wait
  { tags: ['no', 'nope', 'refuse', 'never', 'nah'], url: 'https://media.giphy.com/media/12XMGIWtrHBl5e/giphy.gif' },
  { tags: ['thinking', 'hmm', 'ponder', 'wonder', 'curious'], url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' },
  { tags: ['bye', 'goodbye', 'wave', 'see you', 'later'], url: 'https://media.giphy.com/media/m9eG1qVjvNINlfSkhu/giphy.gif' },
  { tags: ['popcorn', 'eating', 'watching', 'drama'], url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif' },
  { tags: ['cat', 'kitty', 'cute', 'animal', 'kitten'], url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { tags: ['dog', 'doge', 'puppy', 'cute', 'animal'], url: 'https://media.giphy.com/media/4Zo41lhzKt6iZ8xff9/giphy.gif' },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    
    const apiKey = process.env.TENOR_API_KEY;

    // Try live Tenor API if API key is provided in environment
    if (apiKey && query) {
      try {
        const response = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=20&media_filter=gif`,
          { next: { revalidate: 3600 } }
        );

        if (response.ok) {
          const data = await response.json();
          if (data?.results && data.results.length > 0) {
            return NextResponse.json(data);
          }
        }
      } catch (e) {
        console.warn('[GIF API] Tenor fetch failed, falling back to curated library:', e);
      }
    }

    // Filter fallback library by search terms or return popular/all
    const matched = query
      ? FALLBACK_GIFS.filter(g => g.tags.some(tag => tag.includes(query) || query.includes(tag)))
      : FALLBACK_GIFS;

    const list = matched.length > 0 ? matched : FALLBACK_GIFS;

    const formattedResults = list.map((item, idx) => ({
      id: `fallback_gif_${idx}`,
      media_formats: {
        gif: { url: item.url },
        tinygif: { url: item.url },
      },
    }));

    return NextResponse.json({ results: formattedResults });
  } catch (error) {
    console.error('[GIF API] Error handling GIF request:', error);
    return NextResponse.json({ results: [] });
  }
}
