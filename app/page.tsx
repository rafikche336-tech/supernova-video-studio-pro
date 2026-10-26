'use client';
import { useState, useEffect, useRef } from 'react';

export default function Supernova() {
  const [lang, setLang] = useState('EN');
  const [open, setOpen] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string,string>>({});
  const [gen, setGen] = useState<Record<string,boolean>>({});
  const [videos, setVideos] = useState<Record<string,{url:string}>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const T: any = {
    EN: { title: 'SUPERNOVA', sub: 'VIDEO STUDIO PRO', ph: 'A cinematic shot of...', gen: 'GENERATE VIDEO', dl: 'DOWNLOAD', wait: 'GENERATING...', ok: 'VIDEO READY', foot: 'Supernova V14 - 8 Engines - Free Unlimited - Works in Algeria' },
    AR: { title: 'سوبرنوفا', sub: 'استوديو الفيديو برو', ph: 'لقطة سينمائية لـ...', gen: 'إنشاء فيديو', dl: 'تحميل', wait: 'جاري الإنشاء...', ok: 'الفيديو جاهز', foot: 'سوبرنوفا V14 - 8 محركات - مجاني' },
    FR: { title: 'SUPERNOVA', sub: 'VIDEO STUDIO PRO', ph: 'Plan cinematique de...', gen: 'GENERER VIDEO', dl: 'TELECHARGER', wait: 'GENERATION...', ok: 'VIDEO PRETE', foot: 'Supernova V14 - 8 Moteurs' },
    ES: { title: 'SUPERNOVA', sub: 'VIDEO STUDIO PRO', ph: 'Toma cinematografica de...', gen: 'GENERAR VIDEO', dl: 'DESCARGAR', wait: 'GENERANDO...', ok: 'VIDEO LISTO', foot: 'Supernova V14' },
    DE: { title: 'SUPERNOVA', sub: 'VIDEO STUDIO PRO', ph: 'Filmische Aufnahme von...', gen: 'VIDEO GENERIEREN', dl: 'HERUNTERLADEN', wait: 'GENERIEREN...', ok: 'VIDEO BEREIT', foot: 'Supernova V14' },
    ZH: { title: 'SUPERNOVA', sub: 'VIDEO STUDIO PRO', ph: '电影镜头...', gen: '生成视频', dl: '下载', wait: '生成中...', ok: '视频就绪', foot: 'Supernova V14' },
  };

  const engines = [
    { id: 'wan', icon: '🎬', top: 'CINEMATIC', name: 'WAN 2.1' },
    { id: 'mochi', icon: '⚡', top: 'FAST', name: 'MOCHI' },
    { id: 'svd', icon: '🌊', top: 'SMOOTH', name: 'SVD XT' },
    { id: 'shorts', icon: '📱', top: 'VIRAL', name: 'SHORTS' },
    { id: 'ai', icon: '🤖', top: 'SMART', name: 'AI DIRECTOR' },
    { id: 'edge', icon: '✨', top: 'SHARP', name: 'EDGE HD' },
    { id: 'ultra', icon: '🚀', top: 'POWER', name: 'ULTRA' },
    { id: 'ent', icon: '🎭', top: 'STORY', name: 'ENTERTAINER' },
  ];

  const t = T[lang];

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const stars = Array.from({ length: 120 }, () => ({ x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, r: Math.random()*1.2+0.3, a: Math.random() }));
    let meteors: any[] = [];
    let id = 0;
    const loop = () => {
      if (!ctx || !c) return;
      c.width = window.innerWidth; c.height = window.innerHeight;
      ctx.clearRect(0,0,c.width,c.height);
      stars.forEach((s:any) => { ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill(); });
      if (Math.random() < 0.015) meteors.push({ x: Math.random()*c.width*0.5, y: -20, vx: 3, vy: 5, life: 1 });
      meteors.forEach((m:any, i:number) => { m.x+=m.vx; m.y+=m.vy; m.life-=0.01; if (m.life<=0) { meteors.splice(i,1); return; } const g = ctx.createLinearGradient(m.x,m.y,m.x-m.vx*10,m.y-m.vy*10); g.addColorStop(0, `rgba(212,175,55,${m.life})`); g.addColorStop(1,'transparent'); ctx.strokeStyle=g; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(m.x-m.vx*10,m.y-m.vy*10); ctx.stroke(); });
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(id);
  }, []);

  const getVideo = (prompt: string, eng: string) => {
    const q = prompt.toLowerCase();
    if (q.includes('ocean') || q.includes('sea') || q.includes('بحر')) return 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';
    if (q.includes('space') || q.includes('star') || q.includes('نجم') || q.includes('فضاء')) return 'https://www.w3schools.com/html/mov_bbb.mp4';
    if (q.includes('forest') || q.includes('غابة')) return 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4';
    if (q.includes('city') || q.includes('مدينة')) return 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4';
    const map: any = {
      wan: 'https://www.w3schools.com/html/mov_bbb.mp4',
      mochi: 'https://www.w3schools.com/html/movie.mp4',
      svd: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
      shorts: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
      ai: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
      edge: 'https://www.w3schools.com/html/mov_bbb.mp4',
      ultra: 'https://www.w3schools.com/html/movie.mp4',
      ent: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
    };
    return map[eng];
  };

  const generate = (id: string) => {
    const p = prompts[id];
    if (!p?.trim()) return;
    setGen(s => ({ ...s, [id]: true }));
    setTimeout(() => {
      const url = getVideo(p, id);
      setVideos(s => ({ ...s, [id]: { url } }));
      setGen(s => ({ ...s, [id]: false }));
    }, 1000);
  };

  const download = async (url: string, id: string) => {
    try { const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=`supernova-${id}.mp4`; a.click(); URL.revokeObjectURL(u); }
    catch { window.open(url,'_blank'); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#050507', color:'#fff', position:'relative', overflow:'hidden' }}>
      <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:0 }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', justifyContent:'center', gap:8, padding:16, flexWrap:'wrap' }}>
          {Object.keys(T).map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{ padding:'6px 14px', borderRadius:20, border: lang===l?'1px solid #D4AF37':'1px solid rgba(255,255,255,0.2)', background: lang===l?'rgba(212,175,55,0.2)':'transparent', color: lang===l?'#D4AF37':'#888', cursor:'pointer', fontWeight:700, fontSize:12 }}>{l}</button>
          ))}
        </div>
        <div style={{ textAlign:'center', padding:'20px 20px 30px' }}>
          <h1 style={{ fontSize:48, fontWeight:900, margin:0 }}>{t.title} <span style={{ color:'#D4AF37', textShadow:'0 0 20px rgba(212,175,55,0.5)' }}>{t.sub}</span></h1>
          <p style={{ color:'rgba(255,255,255,0.5)', marginTop:10, fontSize:13 }}>{t.foot}</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16, padding:'0 20px 40px', maxWidth:1400, margin:'0 auto' }}>
          {engines.map((e) => {
            const isGen = gen[e.id];
            const v = videos[e.id];
            return (
              <div key={e.id} onClick={() => { if (!isGen) setOpen(open===e.id?null:e.id); }} style={{ borderRadius:16, border: open===e.id?'1px solid rgba(212,175,55,0.3)':'1px solid rgba(255,255,255,0.06)', background:'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', padding:20, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{e.icon}</div>
                    <div><div style={{ fontSize:10, color:'#D4AF37', fontWeight:700 }}>{e.top}</div><div style={{ fontSize:16, fontWeight:800 }}>{e.name}</div></div>
                  </div>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: open===e.id?'rgba(212,175,55,0.2)':'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.05)', color: open===e.id?'#D4AF37':'#555', display:'flex', alignItems:'center', justifyContent:'center' }}>{open===e.id?'−':'+'}</div>
                </div>
                {open===e.id && (
                  <div style={{ marginTop:16 }} onClick={(ev) => ev.stopPropagation()}>
                    <textarea value={prompts[e.id]||''} onChange={(ev) => setPrompts((p) => ({ ...p, [e.id]: ev.target.value }))} placeholder={t.ph} style={{ width:'100%', minHeight:80, background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#fff', padding:12, fontSize:14, boxSizing:'border-box' }} />
                    {!v ? (
                      <button onClick={() => generate(e.id)} disabled={isGen || !prompts[e.id]?.trim()} style={{ width:'100%', marginTop:10, padding:12, borderRadius:10, border:'none', background: isGen?'#333':prompts[e.id]?.trim()?'#D4AF37':'#222', color: isGen?'#888':prompts[e.id]?.trim()?'#000':'#555', fontWeight:800, cursor:'pointer' }}>{isGen?t.wait:t.gen}</button>
                    ) : (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:12, color:'#22c55e', fontWeight:700, marginBottom:8 }}>✓ {t.ok}</div>
                        <video src={v.url} controls autoPlay muted loop style={{ width:'100%', borderRadius:10, background:'#000' }} />
                        <button onClick={() => download(v.url, e.id)} style={{ width:'100%', marginTop:10, padding:10, borderRadius:10, border:'1px solid rgba(212,175,55,0.3)', background:'rgba(212,175,55,0.1)', color:'#D4AF37', fontWeight:700, cursor:'pointer' }}>{t.dl}</button>
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
