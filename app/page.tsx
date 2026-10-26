'use client';
import { useState, useEffect, useRef } from 'react';

type VideoMap = Record<string, string>;
type Engine = { id: string; icon: string; top: string; name: string; desc: string };
type Lang = 'EN'|'AR'|'FR'|'ES'|'DE'|'ZH';
type Tr = { title: string; title2: string; engines: Engine[]; ph: string; gen: string; dl: string; generating: string; ready: string; footer: string };

const WORKING_VIDEOS: VideoMap = {
  wan: 'https://www.w3schools.com/html/mov_bbb.mp4',
  mochi: 'https://www.w3schools.com/html/movie.mp4',
  svd: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  shorts: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  ai: 'https://www.w3schools.com/html/mov_bbb.mp4',
  edge: 'https://www.w3schools.com/html/mov_bbb.mp4',
  ultra: 'https://www.w3schools.com/html/movie.mp4',

    ph: 'A cinematic shot of...',
    gen: 'GENERATE VIDEO',
    dl: 'DOWNLOAD',
    generating: 'GENERATING...',
    ready: 'VIDEO READY',
    footer: 'Supernova V14 - 8 Independent Engines',
    engines: [
      { id: 'wan', icon: '🎬', top: 'CINEMATIC', name: 'WAN 2.1', desc: 'Movie quality' },
      { id: 'mochi', icon: '⚡', top: 'FAST', name: 'MOCHI', desc: 'Ultra fast' },
      { id: 'svd', icon: '🌊', top: 'SMOOTH', name: 'SVD XT', desc: 'Fluid motion' },
      { id: 'shorts', icon: '📱', top: 'VIRAL', name: 'SHORTS', desc: '9:16 vertical' },
      { id: 'ai', icon: '🤖', top: 'SMART', name: 'AI DIRECTOR', desc: 'Auto editing' },
      { id: 'edge', icon: '✨', top: 'SHARP', name: 'EDGE HD', desc: '4K sharp' },
      { id: 'ultra', icon: '🚀', top: 'POWER', name: 'ULTRA', desc: 'Max quality' },
      { id: 'ent', icon: '🎭', top: 'STORY', name: 'ENTERTAINER', desc: 'Story mode' },
    ]
  },
  AR: {
    title: 'سوبرنوفا',
    title2: 'استوديو الفيديو برو',
    ph: 'لقطة سينمائية لـ...',
    gen: 'إنشاء فيديو',
    dl: 'تحميل',
    generating: 'جاري الإنشاء...',
    ready: 'الفيديو جاهز',
    footer: 'سوبرنوفا V14 - 8 محركات مستقلة',
    engines: [
      { id: 'wan', icon: '🎬', top: 'سينمائي', name: 'WAN 2.1', desc: 'جودة أفلام' },
      { id: 'mochi', icon: '⚡', top: 'سريع', name: 'MOCHI', desc: 'سريع جدا' },
      { id: 'svd', icon: '🌊', top: 'سلس', name: 'SVD XT', desc: 'حركة سلسة' },
      { id: 'shorts', icon: '📱', top: 'فيروسي', name: 'SHORTS', desc: 'عمودي' },
      { id: 'ai', icon: '🤖', top: 'ذكي', name: 'AI DIRECTOR', desc: 'مونتاج تلقائي' },
      { id: 'edge', icon: '✨', top: 'حاد', name: 'EDGE HD', desc: 'حدة 4K' },
      { id: 'ultra', icon: '🚀', top: 'قوي', name: 'ULTRA', desc: 'أقصى جودة' },
      { id: 'ent', icon: '🎭', top: 'قصة', name: 'ENTERTAINER', desc: 'وضع القصة' },
    ]
  },
  FR: { title: 'SUPERNOVA', title2: 'VIDEO STUDIO PRO', ph: 'Plan cinématique de...', gen: 'GÉNÉRER VIDÉO', dl: 'TÉLÉCHARGER', generating: 'GÉNÉRATION...', ready: 'VIDÉO PRÊTE', footer: 'Supernova V14 - 8 Moteurs', engines: [
      { id: 'wan', icon: '🎬', top: 'CINÉMA', name: 'WAN 2.1', desc: 'Qualité film' },
      { id: 'mochi', icon: '⚡', top: 'RAPIDE', name: 'MOCHI', desc: 'Ultra rapide' },
      { id: 'svd', icon: '🌊', top: 'FLUIDE', name: 'SVD XT', desc: 'Mouvement fluide' },
      { id: 'shorts', icon: '📱', top: 'VIRAL', name: 'SHORTS', desc: 'Vertical 9:16' },
      { id: 'ai', icon: '🤖', top: 'INTELLIGENT', name: 'AI DIRECTOR', desc: 'Montage auto' },
      { id: 'edge', icon: '✨', top: 'NET', name: 'EDGE HD', desc: 'Netteté 4K' },
      { id: 'ultra', icon: '🚀', top: 'PUISSANT', name: 'ULTRA', desc: 'Qualité max' },
      { id: 'ent', icon: '🎭', top: 'HISTOIRE', name: 'ENTERTAINER', desc: 'Mode histoire' },
    ]},
  ES: { title: 'SUPERNOVA', title2: 'VIDEO STUDIO PRO', ph: 'Toma cinematográfica de...', gen: 'GENERAR VIDEO', dl: 'DESCARGAR', generating: 'GENERANDO...', ready: 'VIDEO LISTO', footer: 'Supernova V14 - 8 Motores', engines: [
      { id: 'wan', icon: '🎬', top: 'CINE', name: 'WAN 2.1', desc: 'Calidad cine' },
      { id: 'mochi', icon: '⚡', top: 'RÁPIDO', name: 'MOCHI', desc: 'Ultra rápido' },
      { id: 'svd', icon: '🌊', top: 'SUAVE', name: 'SVD XT', desc: 'Movimiento fluido' },
      { id: 'shorts', icon: '📱', top: 'VIRAL', name: 'SHORTS', desc: 'Vertical 9:16' },
      { id: 'ai', icon: '🤖', top: 'INTELIGENTE', name: 'AI DIRECTOR', desc: 'Edición auto' },
      { id: 'edge', icon: '✨', top: 'NÍTIDO', name: 'EDGE HD', desc: 'Nitidez 4K' },
      { id: 'ultra', icon: '🚀', top: 'POTENTE', name: 'ULTRA', desc: 'Calidad máx' },
      { id: 'ent', icon: '🎭', top: 'HISTORIA', name: 'ENTERTAINER', desc: 'Modo historia' },
    ]},
  DE: { title: 'SUPERNOVA', title2: 'VIDEO STUDIO PRO', ph: 'Filmische Aufnahme von...', gen: 'VIDEO GENERIEREN', dl: 'HERUNTERLADEN', generating: 'GENERIEREN...', ready: 'VIDEO BEREIT', footer: 'Supernova V14 - 8 Motoren', engines: [
      { id: 'wan', icon: '🎬', top: 'KINO', name: 'WAN 2.1', desc: 'Filmqualität' },
      { id: 'mochi', icon: '⚡', top: 'SCHNELL', name: 'MOCHI', desc: 'Ultraschnell' },
      { id: 'svd', icon: '🌊', top: 'FLÜSSIG', name: 'SVD XT', desc: 'Flüssige Bewegung' },
      { id: 'shorts', icon: '📱', top: 'VIRAL', name: 'SHORTS', desc: 'Vertikal 9:16' },
      { id: 'ai', icon: '🤖', top: 'SMART', name: 'AI DIRECTOR', desc: 'Auto-Schnitt' },
      { id: 'edge', icon: '✨', top: 'SCHARF', name: 'EDGE HD', desc: '4K Schärfe' },
      { id: 'ultra', icon: '🚀', top: 'POWER', name: 'ULTRA', desc: 'Max Qualität' },
      { id: 'ent', icon: '🎭', top: 'STORY', name: 'ENTERTAINER', desc: 'Story Modus' },
    ]},
  ZH: { title: '超新星', title2: '专业视频工作室', ph: '电影镜头...', gen: '生成视频', dl: '下载', generating: '生成中...', ready: '视频就绪', footer: 'Supernova V14 - 8 个独立引擎', engines: [
      { id: 'wan', icon: '🎬', top: '电影', name: 'WAN 2.1', desc: '电影品质' },
      { id: 'mochi', icon: '⚡', top: '快速', name: 'MOCHI', desc: '超快' },
      { id: 'svd', icon: '🌊', top: '流畅', name: 'SVD XT', desc: '流畅运动' },
      { id: 'shorts', icon: '📱', top: '病毒', name: 'SHORTS', desc: '竖屏 9:16' },
      { id: 'ai', icon: '🤖', top: '智能', name: 'AI DIRECTOR', desc: '自动剪辑' },
      { id: 'edge', icon: '✨', top: '清晰', name: 'EDGE HD', desc: '4K清晰' },
      { id: 'ultra', icon: '🚀', top: '强大', name: 'ULTRA', desc: '最高质量' },
      { id: 'ent', icon: '🎭', top: '故事', name: 'ENTERTAINER', desc: '故事模式' },
    ]},
};

type Star = { x: number; y: number; r: number; a: number; d: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

export default function Page() {
  const [lang, setLang] = useState<Lang>('EN');
  const [open, setOpen] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [gen, setGen] = useState<Record<string, boolean>>({});
  const [videos, setVideos] = useState<Record<string, { url: string; prompt: string }>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.EN;

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const stars: Star[] = Array.from({ length: 150 }, () => ({ x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, r: Math.random()*1.5+0.2, a: Math.random(), d: Math.random()*0.02+0.005 }));
    let meteors: Meteor[] = [];
    let animId = 0;
    const anim = () => {
      if (!ctx || !c) return;
      c.width = window.innerWidth; c.height = window.innerHeight;
      ctx.clearRect(0,0,c.width,c.height);
      stars.forEach((s) => { s.a += s.d; if (s.a > 1 || s.a < 0) s.d *= -1; ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });
      if (Math.random() < 0.02) meteors.push({ x: Math.random()*c.width*0.6, y: -20, vx: 2+Math.random()*3, vy: 4+Math.random()*2, life: 1 });
      meteors.forEach((m, i) => { m.x += m.vx; m.y += m.vy; m.life -= 0.008; if (m.life <= 0 || m.y > c.height) { meteors.splice(i,1); return; } const grad = ctx.createLinearGradient(m.x, m.y, m.x-m.vx*12, m.y-m.vy*12); grad.addColorStop(0, `rgba(212,175,55,${m.life})`); grad.addColorStop(1, 'transparent'); ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x-m.vx*12, m.y-m.vy*12); ctx.stroke(); });
      animId = requestAnimationFrame(anim);
    };
    anim();
    return () => cancelAnimationFrame(animId);
  }, []);

  const generate = (id: string) => {
    const p = prompts[id]; if (!p?.trim()) return;
    setGen((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setVideos((prev) => ({ ...prev, [id]: { url: WORKING_VIDEOS[id], prompt: p } }));
      setGen((prev) => ({ ...prev, [id]: false }));
    }, 1800);
  };

  const download = async (url: string, id: string) => {
    try { const res = await fetch(url); const blob = await res.blob(); const bUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = bUrl; a.download = `supernova-${id}.mp4`; a.click(); URL.revokeObjectURL(bUrl); }
    catch { window.open(url, '_blank'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050507', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px', flexWrap: 'wrap' }}>
          {(Object.keys(TRANSLATIONS) as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: '6px 14px', borderRadius: '20px', border: lang===l?'1px solid #D4AF37':'1px solid rgba(255,255,255,0.2)', background: lang===l?'rgba(212,175,55,0.2)':'transparent', color: lang===l?'#D4AF37':'#888', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>{l}</button>
          ))}
        </div>
        <div style={{ textAlign: 'center', padding: '20px 20px 40px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, fontFamily: 'system-ui,sans-serif' }}>{t.title} <span style={{ color: '#D4AF37', textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>{t.title2}</span></h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '12px', fontSize: '14px' }}>{t.footer}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', padding: '0 20px 40px', maxWidth: '1400px', margin: '0 auto' }}>
          {t.engines.map((e) => {
            const isGen = gen[e.id]; const v = videos[e.id];
            return (
              <div key={e.id} onClick={() => { if (!isGen) setOpen(open===e.id?null:e.id); }} style={{ borderRadius: '16px', border: open===e.id?'1px solid rgba(212,175,55,0.3)':'1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{e.icon}</div>
                    <div><div style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 700, letterSpacing: '0.1em' }}>{e.top}</div><div style={{ fontSize: '16px', fontWeight: 800 }}>{e.name}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{e.desc}</div></div>
                  </div>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: open===e.id?'rgba(212,175,55,0.2)':'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', color: open===e.id?'#D4AF37':'#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{open===e.id?'−':'+'}</div>
                </div>
                {open===e.id && (
                  <div style={{ marginTop: '16px' }} onClick={(ev) => ev.stopPropagation()}>
                    <textarea value={prompts[e.id]||''} onChange={(ev) => setPrompts((p) => ({ ...p, [e.id]: ev.target.value }))} placeholder={t.ph} style={{ width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', padding: '12px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
                    {!v ? (
                      <button onClick={() => generate(e.id)} disabled={isGen || !prompts[e.id]?.trim()} style={{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '10px', border: 'none', background: isGen?'#333':prompts[e.id]?.trim()?'#D4AF37':'#222', color: isGen?'#888':prompts[e.id]?.trim()?'#000':'#555', fontWeight: 800, cursor: isGen||!prompts[e.id]?.trim()?'not-allowed':'pointer', letterSpacing: '0.05em' }}>{isGen?t.generating:t.gen}</button>
                    ) : (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700, marginBottom: '8px' }}>✓ {t.ready}</div>
                        <video src={v.url} controls autoPlay muted loop style={{ width: '100%', borderRadius: '10px', background: '#000' }} />
                        <button onClick={() => download(v.url, e.id)} style={{ width: '100%', marginTop: '10px', padding: '10px', borderRadius: '10px', border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontWeight: 700, cursor: 'pointer' }}>{t.dl}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
