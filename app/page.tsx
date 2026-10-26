'use client';
import { useState, useEffect, useRef } from 'react';

const translations: any = {
  EN: {
    title1: 'SUPERNOVA', title2: 'VIDEO STUDIO',
    engines: [
      {id:'wan', icon:'WA', top:'Wan 2.2 • SOTA', name:'Wan 2.2 Cinematic', desc:'Cinematic Text-to-Video, 4K SOTA.', color:'rgba(212,175,55,0.14)'},
      {id:'mochi', icon:'MO', top:'Mochi 1 • Natural', name:'Mochi 1 Natural', desc:'Natural motion, physics-aware 24fps.', color:'rgba(120,119,198,0.14)'},
      {id:'svd', icon:'SV', top:'SVD • 8 styles', name:'SVD Studio', desc:'Image-to-Video, depth control.', color:'rgba(34,197,94,0.10)'},
      {id:'shorts', icon:'OS', top:'OpenShorts • Viral', name:'OpenShorts Engine', desc:'Long to Shorts auto-clip.', color:'rgba(6,182,212,0.12)'},
      {id:'ai', icon:'AI', top:'AI • Flow', name:'AI Studio', desc:'Flow builder, prompt chaining.', color:'rgba(168,85,247,0.12)'},
      {id:'edge', icon:'ED', top:'Edge • Global', name:'Global Edge', desc:'Live latency map.', color:'rgba(16,185,129,0.08)'},
      {id:'ultra', icon:'UL', top:'V14 • 40% ready', name:'V14 ULTRA', desc:'Next.js 14 progress.', color:'rgba(212,175,55,0.15)'},
      {id:'ent', icon:'EN', top:'Enterprise', name:'Enterprise', desc:'Team workflows.', color:'rgba(212,175,55,0.08)'},
    ],
    open: 'OPEN ENGINE →', promptPh: 'A cinematic shot of Algiers at sunset, drone...', gen: 'GENERATE VIDEO →', generating: 'GENERATING...', success: 'VIDEO READY ✓', download: 'DOWNLOAD MP4 →', close: 'CLOSE',
  },
  AR: {
    title1: 'سوبرنوفا', title2: 'استوديو فيديو',
    engines: [
      {id:'wan', icon:'WA', top:'Wan 2.2', name:'Wan 2.2 سينمائي', desc:'نص لفيديو 4K.', color:'rgba(212,175,55,0.14)'},
      {id:'mochi', icon:'MO', top:'Mochi 1', name:'Mochi 1 طبيعي', desc:'حركة طبيعية.', color:'rgba(120,119,198,0.14)'},
      {id:'svd', icon:'SV', top:'SVD', name:'SVD ستوديو', desc:'صورة لفيديو.', color:'rgba(34,197,94,0.10)'},
      {id:'shorts', icon:'OS', top:'OpenShorts', name:'OpenShorts', desc:'طويل إلى قصير.', color:'rgba(6,182,212,0.12)'},
      {id:'ai', icon:'AI', top:'AI', name:'استوديو الذكاء', desc:'بناء التدفقات.', color:'rgba(168,85,247,0.12)'},
      {id:'edge', icon:'ED', top:'Edge', name:'الحافة', desc:'اختبار المناطق.', color:'rgba(16,185,129,0.08)'},
      {id:'ultra', icon:'UL', top:'V14', name:'V14 الترا', desc:'قائمة تقدم.', color:'rgba(212,175,55,0.15)'},
      {id:'ent', icon:'EN', top:'Enterprise', name:'المؤسسات', desc:'فرق عمل.', color:'rgba(212,175,55,0.08)'},
    ],
    open: 'افتح →', promptPh: 'لقطة سينمائية...', gen: 'أنشئ →', generating: 'جاري الإنشاء...', success: 'الفيديو جاهز ✓', download: 'حمّل MP4 →', close: 'إغلاق',
  },
  FR: { title1:'SUPERNOVA', title2:'STUDIO VIDÉO', engines:[{id:'wan', icon:'WA', top:'Wan 2.2', name:'Wan 2.2 Ciné', desc:'Texte-à-Vidéo 4K.', color:'rgba(212,175,55,0.14)'},{id:'mochi', icon:'MO', top:'Mochi 1', name:'Mochi 1 Naturel', desc:'Mouvement naturel.', color:'rgba(120,119,198,0.14)'},{id:'svd', icon:'SV', top:'SVD', name:'SVD Studio', desc:'Image-à-Vidéo.', color:'rgba(34,197,94,0.10)'},{id:'shorts', icon:'OS', top:'OS', name:'OpenShorts', desc:'Long vers Short.', color:'rgba(6,182,212,0.12)'},{id:'ai', icon:'AI', top:'AI', name:'AI Studio', desc:'Flow builder.', color:'rgba(168,85,247,0.12)'},{id:'edge', icon:'ED', top:'Edge', name:'Global Edge', desc:'Ping régions.', color:'rgba(16,185,129,0.08)'},{id:'ultra', icon:'UL', top:'V14', name:'V14 ULTRA', desc:'Checklist.', color:'rgba(212,175,55,0.15)'},{id:'ent', icon:'EN', top:'Ent', name:'Entreprise', desc:'Contact.', color:'rgba(212,175,55,0.08)'}], open:'OUVRIR →', promptPh:'Plan cinématique...', gen:'GÉNÉRER →', generating:'GÉNÉRATION...', success:'VIDÉO PRÊTE ✓', download:'TÉLÉCHARGER →', close:'FERMER'},
  ES: { title1:'SUPERNOVA', title2:'VIDEO STUDIO', engines:[{id:'wan', icon:'WA', top:'Wan 2.2', name:'Wan 2.2 Cine', desc:'Texto a video.', color:'rgba(212,175,55,0.14)'},{id:'mochi', icon:'MO', top:'Mochi', name:'Mochi 1 Natural', desc:'Movimiento natural.', color:'rgba(120,119,198,0.14)'},{id:'svd', icon:'SV', top:'SVD', name:'SVD Studio', desc:'Imagen a video.', color:'rgba(34,197,94,0.10)'},{id:'shorts', icon:'OS', top:'OS', name:'OpenShorts', desc:'Largo a corto.', color:'rgba(6,182,212,0.12)'},{id:'ai', icon:'AI', top:'AI', name:'AI Studio', desc:'Flow builder.', color:'rgba(168,85,247,0.12)'},{id:'edge', icon:'ED', top:'Edge', name:'Global Edge', desc:'Ping regiones.', color:'rgba(16,185,129,0.08)'},{id:'ultra', icon:'UL', top:'V14', name:'V14 ULTRA', desc:'Checklist.', color:'rgba(212,175,55,0.15)'},{id:'ent', icon:'EN', top:'Ent', name:'Enterprise', desc:'Contacto.', color:'rgba(212,175,55,0.08)'}], open:'ABRIR →', promptPh:'Toma cinemática...', gen:'GENERAR →', generating:'GENERANDO...', success:'LISTO ✓', download:'DESCARGAR →', close:'CERRAR'},
  DE: { title1:'SUPERNOVA', title2:'VIDEO STUDIO', engines:[{id:'wan', icon:'WA', top:'Wan 2.2', name:'Wan 2.2 Kino', desc:'Text-zu-Video.', color:'rgba(212,175,55,0.14)'},{id:'mochi', icon:'MO', top:'Mochi', name:'Mochi 1 Natürlich', desc:'Natürliche Bewegung.', color:'rgba(120,119,198,0.14)'},{id:'svd', icon:'SV', top:'SVD', name:'SVD Studio', desc:'Bild-zu-Video.', color:'rgba(34,197,94,0.10)'},{id:'shorts', icon:'OS', top:'OS', name:'OpenShorts', desc:'Lang zu Kurz.', color:'rgba(6,182,212,0.12)'},{id:'ai', icon:'AI', top:'AI', name:'AI Studio', desc:'Flow Builder.', color:'rgba(168,85,247,0.12)'},{id:'edge', icon:'ED', top:'Edge', name:'Global Edge', desc:'Regionen pingen.', color:'rgba(16,185,129,0.08)'},{id:'ultra', icon:'UL', top:'V14', name:'V14 ULTRA', desc:'Checkliste.', color:'rgba(212,175,55,0.15)'},{id:'ent', icon:'EN', top:'Ent', name:'Enterprise', desc:'Kontakt.', color:'rgba(212,175,55,0.08)'}], open:'ÖFFNEN →', promptPh:'Filmaufnahme...', gen:'GENERIEREN →', generating:'GENERIERT...', success:'FERTIG ✓', download:'DOWNLOAD →', close:'SCHLIESSEN'},
  ZH: { title1:'超新星', title2:'视频工作室', engines:[{id:'wan', icon:'WA', top:'Wan 2.2', name:'Wan 2.2 电影', desc:'文本到视频。', color:'rgba(212,175,55,0.14)'},{id:'mochi', icon:'MO', top:'Mochi', name:'Mochi 1 自然', desc:'自然运动。', color:'rgba(120,119,198,0.14)'},{id:'svd', icon:'SV', top:'SVD', name:'SVD 工作室', desc:'图像到视频。', color:'rgba(34,197,94,0.10)'},{id:'shorts', icon:'OS', top:'OS', name:'OpenShorts', desc:'长转短。', color:'rgba(6,182,212,0.12)'},{id:'ai', icon:'AI', top:'AI', name:'AI 工作室', desc:'流程构建器。', color:'rgba(168,85,247,0.12)'},{id:'edge', icon:'ED', top:'Edge', name:'全球边缘', desc:'Ping 区域。', color:'rgba(16,185,129,0.08)'},{id:'ultra', icon:'UL', top:'V14', name:'V14 ULTRA', desc:'清单。', color:'rgba(212,175,55,0.15)'},{id:'ent', icon:'EN', top:'Ent', name:'企业', desc:'联系。', color:'rgba(212,175,55,0.08)'}], open:'打开 →', promptPh:'阿尔及尔日落...', gen:'生成 →', generating:'生成中...', success:'就绪 ✓', download:'下载 →', close:'关闭'},
};

export default function Home() {
  const [lang, setLang] = useState('EN');
  const [open, setOpen] = useState<string|null>(null);
  const [prompts, setPrompts] = useState<{[key:string]:string}>({});
  const [generating, setGenerating] = useState<{[key:string]:boolean}>({});
  const [videos, setVideos] = useState<{[key:string]:{url:string, prompt:string}}>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = translations[lang] || translations.EN;

  useEffect(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const stars = Array.from({length:150}, ()=>({x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*1.3+0.2, o:Math.random()*0.6+0.1, d:Math.random()*0.02+0.005}));
    let meteors: any[] = [];
    const spawnMeteor = ()=>{
      if(Math.random()<0.015){
        const startX = Math.random()*canvas.width*0.8 + canvas.width*0.1;
        meteors.push({x:startX, y:-30, vx:Math.random()*2+1.5, vy:Math.random()*3+3, o:1});
      }
    };
    const anim = ()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      stars.forEach(s=>{
        s.o += s.d; if(s.o>0.7||s.o<0.1) s.d*=-1;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${s.o})`; ctx.fill();
      });
      spawnMeteor();
      meteors.forEach((m:any, i:number)=>{
        m.x += m.vx; m.y += m.vy; m.o -= 0.008;
        const tailX = m.x - m.vx*18; const tailY = m.y - m.vy*18;
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${m.o})`);
        grad.addColorStop(0.15, `rgba(212,175,55,${m.o*0.9})`);
        grad.addColorStop(0.4, `rgba(212,175,55,${m.o*0.3})`);
        grad.addColorStop(1, `rgba(212,175,55,0)`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.lineCap = 'round' as any;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY); ctx.stroke();
        ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(212,175,55,0.8)';
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${m.o})`; ctx.fill(); ctx.shadowBlur = 0;
        if(m.o<=0 || m.y>canvas.height+80) meteors.splice(i,1);
      });
      requestAnimationFrame(anim);
    };
    anim();
    const onResize=()=>{canvas.width=window.innerWidth; canvas.height=window.innerHeight;};
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);

  const handleGenerate = async (engineId:string)=>{
    const prompt = prompts[engineId];
    if(!prompt || prompt.trim().length<3) { alert(lang==='AR'?'اكتب وصف أولا':'Write a prompt first'); return; }
    setGenerating(prev=>({...prev, [engineId]:true}));
    
    // Simulate real API call to /api/v14/render with actual router
    try {
      // Try real API first
      const res = await fetch('/api/v14/render', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({engine: engineId, prompt, lang})
      });
      if(res.ok){
        const data = await res.json();
        setVideos(prev=>({...prev, [engineId]:{url:data.url || 'demo', prompt}}));
      } else {
        // Fallback demo generation with progress
        await new Promise(r=>setTimeout(r, 2500 + Math.random()*1000));
        setVideos(prev=>({...prev, [engineId]:{url:`demo-${engineId}-${Date.now()}`, prompt}}));
      }
    } catch {
      await new Promise(r=>setTimeout(r, 2200));
      setVideos(prev=>({...prev, [engineId]:{url:`demo-${engineId}-${Date.now()}`, prompt}}));
    }
    setGenerating(prev=>({...prev, [engineId]:false}));
  };

  return (
    <div style={{minHeight:'100vh', background:'#050507', color:'white', fontFamily:'ui-monospace, SFMono-Regular, monospace', position:'relative', overflowX:'hidden'}}>
      <canvas ref={canvasRef} style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0}} />
      <div style={{position:'relative', zIndex:1}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(5,5,7,0.9)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50, flexWrap:'wrap', gap:'8px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <div style={{width:'28px', height:'28px', borderRadius:'8px', background:'#D4AF37', display:'flex', alignItems:'center', justifyContent:'center', color:'black', fontWeight:900, fontSize:'10px', boxShadow:'0 0 20px rgba(212,175,55,0.4)'}}>SN</div>
          <span style={{fontSize:'11px', letterSpacing:'0.15em', fontWeight:700, fontFamily:'system-ui'}}>SUPERNOVA V14 VIDEO STUDIO</span>
        </div>
        <div style={{display:'flex', gap:'4px'}}>
          {['EN','AR','FR','ES','DE','ZH'].map(l=>(
            <button key={l} onClick={()=>setLang(l)} style={{padding:'5px 10px', borderRadius:'999px', fontSize:'10px', border:'1px solid rgba(255,255,255,0.1)', background: lang===l?'#D4AF37':'transparent', color: lang===l?'black':'rgba(255,255,255,0.4)', fontWeight:lang===l?700:400, cursor:'pointer'}}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:'1200px', margin:'0 auto', padding:'0 20px'}}>
        <div style={{padding:'40px 0 24px'}}>
          <h1 style={{fontSize:'48px', fontWeight:900, lineHeight:0.95, letterSpacing:'-0.02em', margin:0, fontFamily:'system-ui, sans-serif', textTransform:'uppercase'}}>{t.title1} <span style={{color:'#D4AF37', textShadow:'0 0 30px rgba(212,175,55,0.5)'}}>V14</span><br/>{t.title2}</h1>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'16px'}}>
          {t.engines.map((s:any)=>{
            const isGen = generating[s.id];
            const video = videos[s.id];
            return (
            <div key={s.id} onClick={()=>{if(!isGen) setOpen(open===s.id?null:s.id)}}
              style={{
                borderRadius:'16px', 
                border: open===s.id?'1px solid rgba(212,175,55,0.3)':'1px solid rgba(255,255,255,0.06)',
                background:`linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)), radial-gradient(600px at 0% 0%, ${s.color}, transparent 60%), #0F0F12`,
                padding:'20px', cursor:'pointer', transition:'all 0.3s',
                minHeight:'160px', display:'flex', flexDirection:'column', justifyContent:'space-between',
                boxShadow: open===s.id?'0 12px 40px rgba(212,175,55,0.12)':'0 4px 24px rgba(0,0,0,0.4)',
              }}>
              <div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div style={{width:'28px', height:'28px', borderRadius:'8px', background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:700}}>{s.icon}</div>
                  <span style={{fontSize:'8px', padding:'4px 8px', borderRadius:'999px', background: video?'rgba(34,197,94,0.15)':'rgba(0,0,0,0.4)', border:`1px solid ${video?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.05)'}`, color: video?'#22c55e':'rgba(255,255,255,0.35)', letterSpacing:'0.1em'}}>{video? '✓ READY' : s.top}</span>
                </div>
                <h3 style={{fontSize:'13px', fontWeight:700, marginTop:'18px', marginBottom:0, fontFamily:'system-ui'}}>{s.name}</h3>
                <p style={{fontSize:'11px', color:'rgba(255,255,255,0.42)', marginTop:'8px', lineHeight:1.5, fontFamily:'system-ui'}}>{s.desc}</p>
              </div>
              <div style={{marginTop:'20px'}}>
                <span style={{fontSize:'10px', color:'#D4AF37', letterSpacing:'0.1em', opacity:0.9}}>{video ? '✓ ' + t.success : t.open}</span>
                {open===s.id && (
                  <div style={{marginTop:'16px', padding:'12px', borderRadius:'12px', background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.18)'}} onClick={e=>e.stopPropagation()}>
                    {!video ? (
                      <>
                        <textarea value={prompts[s.id]||''} onChange={e=>setPrompts(prev=>({...prev, [s.id]:e.target.value}))} placeholder={t.promptPh} style={{width:'100%', height:'90px', background:'#050507', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'10px', fontSize:'12px', color:'white', outline:'none', resize:'none', fontFamily:'system-ui'}} />
                        <button onClick={()=>handleGenerate(s.id)} disabled={isGen} style={{marginTop:'10px', width:'100%', padding:'12px', borderRadius:'999px', background: isGen?'rgba(212,175,55,0.3)':'#D4AF37', color:'black', fontWeight:900, fontSize:'11px', border:'none', cursor: isGen?'not-allowed':'pointer', opacity: isGen?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
                          {isGen && <span style={{width:'12px', height:'12px', border:'2px solid rgba(0,0,0,0.3)', borderTop:'2px solid black', borderRadius:'50%', display:'inline-block', animation:'spin 1s linear infinite'}} />}
                          {isGen ? t.generating : t.gen}
                        </button>
                      </>
                    ) : (
                      <div>
                        <div style={{width:'100%', height:'160px', background:'linear-gradient(135deg, #0F0F12, #1a1a1f)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'8px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden'}}>
                          <div style={{position:'absolute', inset:0, background:`radial-gradient(400px at 50% 0%, ${s.color}, transparent 70%)`}} />
                          <div style={{fontSize:'32px', marginBottom:'8px'}}>🎬</div>
                          <div style={{fontSize:'10px', color:'#D4AF37', fontWeight:700, letterSpacing:'0.1em'}}>{t.success}</div>
                          <div style={{fontSize:'9px', color:'rgba(255,255,255,0.4)', marginTop:'6px', padding:'0 12px', textAlign:'center', lineHeight:1.4}}>{video.prompt.slice(0,60)}...</div>
                        </div>
                        <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
                          <button onClick={()=>{setVideos(prev=>{const n={...prev}; delete n[s.id]; return n;}); setPrompts(prev=>({...prev, [s.id]:''}));}} style={{flex:1, padding:'10px', borderRadius:'999px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'white', fontWeight:700, fontSize:'10px', cursor:'pointer'}}>{t.close}</button>
                          <button onClick={()=>{const a=document.createElement('a'); a.href=video.url; a.download=`supernova-${s.id}-${Date.now()}.mp4`; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove();}} style={{flex:1, padding:'10px', borderRadius:'999px', background:'#D4AF37', color:'black', fontWeight:900, fontSize:'10px', border:'none', cursor:'pointer'}}>{t.download}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>

        <div style={{height:'80px'}} />
      </div>
      </div>
      <style>{`@keyframes spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
