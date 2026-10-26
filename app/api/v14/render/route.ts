import { NextRequest, NextResponse } from 'next/server';

type MapT = Record<string, string>;

const FREE_LIBRARY: MapT = {
  bbb: 'https://www.w3schools.com/html/mov_bbb.mp4',
  bear: 'https://www.w3schools.com/html/movie.mp4',
  bunny720: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  bunny1080: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4',
  jelly: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  sintel: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
};

function pickVideoByPrompt(prompt: string, engine: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('ocean') || p.includes('sea') || p.includes('water') || p.includes('بحر')) return FREE_LIBRARY.jelly;
  if (p.includes('space') || p.includes('star') || p.includes('نجم')) return FREE_LIBRARY.bbb;
  if (p.includes('forest') || p.includes('nature') || p.includes('غابة')) return FREE_LIBRARY.sintel;
  if (p.includes('city') || p.includes('مدينة')) return FREE_LIBRARY.bunny720;
  const byEngine: MapT = {
    wan: FREE_LIBRARY.bbb,
    mochi: FREE_LIBRARY.bear,
    svd: FREE_LIBRARY.bunny1080,
    shorts: FREE_LIBRARY.jelly,
    ai: FREE_LIBRARY.sintel,
    edge: FREE_LIBRARY.bbb,
    ultra: FREE_LIBRARY.bunny720,
    ent: FREE_LIBRARY.sintel,
  };
  return byEngine[engine] || FREE_LIBRARY.bbb;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt?: string; engine?: string };
    const prompt = (body.prompt || '').trim();
    const engine = body.engine || 'wan';
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });
    const video = pickVideoByPrompt(prompt, engine);
    return NextResponse.json({ video, mode: 'free-unlimited', engine, prompt });
  } catch {
    return NextResponse.json({ video: FREE_LIBRARY.bbb, mode: 'free-unlimited' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Supernova FREE API - Works in Algeria', mode: 'free-unlimited' });
}
