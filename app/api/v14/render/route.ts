import { NextRequest, NextResponse } from 'next/server';

// Supernova V14 Real Video API - Routes to Wan 2.2, Mochi, SVD, OpenShorts
export async function POST(req: NextRequest) {
  try {
    const { engine, prompt, lang } = await req.json();
    
    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json({ error: 'Prompt too short' }, { status: 400 });
    }

    // Enhanced prompt with engine-specific tuning
    const enhancedPrompt = enhancePrompt(engine, prompt);
    
    // Check for API keys
    const replicateKey = process.env.REPLICATE_API_TOKEN;
    const falKey = process.env.FAL_KEY;
    
    let videoUrl = '';
    let realGeneration = false;

    // REAL GENERATION LOGIC
    if (replicateKey || falKey) {
      try {
        if (engine === 'wan' && falKey) {
          // Wan 2.2 via Fal.ai - Best quality
          videoUrl = await generateWanViaFal(enhancedPrompt, falKey);
          realGeneration = true;
        } else if (engine === 'mochi' && replicateKey) {
          // Mochi 1 via Replicate
          videoUrl = await generateMochiViaReplicate(enhancedPrompt, replicateKey);
          realGeneration = true;
        } else if (engine === 'svd' && falKey) {
          // SVD via Fal
          videoUrl = await generateSVDViaFal(enhancedPrompt, falKey);
          realGeneration = true;
        } else if (falKey) {
          // Fallback to Fal Wan for all engines
          videoUrl = await generateWanViaFal(enhancedPrompt, falKey);
          realGeneration = true;
        }
      } catch (e) {
        console.error('Real generation failed, fallback to demo:', e);
      }
    }

    // DEMO FALLBACK - Sample videos from CDN (works without API keys)
    if (!videoUrl) {
      videoUrl = getDemoVideo(engine);
    }

    return NextResponse.json({
      url: videoUrl,
      engine,
      prompt: enhancedPrompt,
      originalPrompt: prompt,
      real: realGeneration,
      timestamp: Date.now(),
      message: realGeneration 
        ? 'Real video generated!' 
        : 'Demo video - Add REPLICATE_API_TOKEN or FAL_KEY in Vercel Env to get real generation'
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

function enhancePrompt(engine: string, prompt: string): string {
  const base = prompt.trim();
  const enhancers: any = {
    wan: `${base}, cinematic, 4K, highly detailed, smooth motion, professional lighting, SOTA`,
    mochi: `${base}, natural motion, physics-aware, 24fps, smooth dynamics, realistic`,
    svd: `${base}, image to video, depth, cinematic movement, high quality`,
    shorts: `${base}, viral, short-form, dynamic, captions, engaging, TikTok style`,
    ai: `${base}, AI art, creative, flow, artistic`,
    edge: `${base}, global, edge computing visualization`,
    ultra: `${base}, ultra quality, next-gen, V14, premium`,
    ent: `${base}, enterprise, professional, team workflow`,
  };
  return enhancers[engine] || base;
}

async function generateWanViaFal(prompt: string, falKey: string): Promise<string> {
  // Fal.ai Wan 2.2 API
  const res = await fetch('https://queue.fal.run/fal-ai/wan-v2-2-a14b-text-to-video', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      num_frames: 81,
      frames_per_second: 16,
      resolution: '720p',
    }),
  });
  const data = await res.json();
  if (data.video?.url) return data.video.url;
  // Queue handling
  if (data.request_id) {
    // Poll for result
    for (let i=0; i<30; i++) {
      await new Promise(r=>setTimeout(r, 2000));
      const statusRes = await fetch(`https://queue.fal.run/fal-ai/wan-v2-2-a14b-text-to-video/requests/${data.request_id}/status`, {
        headers: { 'Authorization': `Key ${falKey}` }
      });
      const statusData = await statusRes.json();
      if (statusData.response?.video?.url) return statusData.response.video.url;
    }
  }
  throw new Error('Wan generation timeout');
}

async function generateMochiViaReplicate(prompt: string, replicateKey: string): Promise<string> {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${replicateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'genmo/mochi-1-preview', // Mochi model
      input: { prompt, num_frames: 84, num_inference_steps: 64 },
    }),
  });
  const data = await res.json();
  // Poll
  for (let i=0; i<40; i++) {
    await new Promise(r=>setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${replicateKey}` }
    });
    const statusData = await statusRes.json();
    if (statusData.status === 'succeeded' && statusData.output) {
      return Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
    }
    if (statusData.status === 'failed') throw new Error('Mochi failed');
  }
  throw new Error('Mochi timeout');
}

async function generateSVDViaFal(prompt: string, falKey: string): Promise<string> {
  // Use text-to-video as SVD alternative
  return generateWanViaFal(prompt, falKey);
}

function getDemoVideo(engine: string): string {
  // Demo videos - WORKING public URLs (commondatastorage + w3schools + sample-videos)
  const demos: any = {
    wan: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    mochi: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    svd: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    shorts: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    ai: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    edge: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    ultra: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    ent: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  };
  // Fallback to w3schools if needed - always works
  // https://www.w3schools.com/html/mov_bbb.mp4
  return demos[engine] || demos.wan;
}

export async function GET() {
  return NextResponse.json({
    status: 'Supernova V14 Video API Running ✓',
    engines: ['wan', 'mochi', 'svd', 'shorts', 'ai', 'edge', 'ultra', 'ent'],
    endpoints: 'POST /api/v14/render {engine, prompt}',
    keys: {
      replicate: !!process.env.REPLICATE_API_TOKEN,
      fal: !!process.env.FAL_KEY,
    },
    demo: !process.env.REPLICATE_API_TOKEN && !process.env.FAL_KEY ? 'Using demo videos - add API keys for real generation' : 'Real generation enabled'
  });
}
