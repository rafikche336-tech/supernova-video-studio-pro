'use client';
import { useState, useEffect, useRef } from 'react';

const WORKING_VIDEOS: any = {
  wan: 'https://www.w3schools.com/html/mov_bbb.mp4',
  mochi: 'https://www.w3schools.com/html/movie.mp4',
  svd: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  shorts: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4',
  ai: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
  edge: 'https://www.w3schools.com/html/mov_bbb.mp4',
  ultra: 'https://www.w3schools.com/html/movie.mp4',
  ent: 'https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4',
};

const translations: any = {
  EN: { title1:'SUPERNOVA', title2:'VIDEO STUDIO', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 Cinematic',desc:'Cinematic Text-to-Video, 4K SOTA.',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi 1',name:'Mochi 1 Natural',desc:'Natural motion, 24fps.',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD Studio',desc:'Image-to-Video.',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OpenShorts',name:'OpenShorts Engine',desc:'Long to Shorts.',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'AI Studio',desc:'Flow builder.',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'Global Edge',desc:'Live map.',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 ULTRA',desc:'Next.js 14.',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'Enterprise',desc:'Team.',color:'rgba(212,175,55,0.08)'}], open:'OPEN ENGINE →', promptPh:'Algiers at sunset, drone...', gen:'GENERATE VIDEO →', generating:'GENERATING...', success:'VIDEO READY ✓', download:'DOWNLOAD MP4 →', close:'CLOSE' },
  AR: { title1:'سوبرنوفا', title2:'استوديو فيديو', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 سينمائي',desc:'نص لفيديو.',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi',name:'Mochi 1 طبيعي',desc:'حركة طبيعية.',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD ستوديو',desc:'صورة لفيديو.',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OS',name:'OpenShorts',desc:'طويل إلى قصير.',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'استوديو الذكاء',desc:'بناء.',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'الحافة',desc:'اختبار.',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 الترا',desc:'قائمة.',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'المؤسسات',desc:'فرق.',color:'rgba(212,175,55,0.08)'}], open:'افتح →', promptPh:'الجزائر غروب...', gen:'أنشئ →', generating:'جاري...', success:'جاهز ✓', download:'حمّل →', close:'إغلاق' },
  FR: { title1:'SUPERNOVA', title2:'STUDIO VIDÉO', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 Ciné',desc:'Texte-à-Vidéo.',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi',name:'Mochi 1 Naturel',desc:'Mouvement naturel.',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD Studio',desc:'Image-à-Vidéo.',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OS',name:'OpenShorts',desc:'Long vers Short.',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'AI Studio',desc:'Flow builder.',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'Global Edge',desc:'Ping.',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 ULTRA',desc:'Checklist.',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'Entreprise',desc:'Contact.',color:'rgba(212,175,55,0.08)'}], open:'OUVRIR →', promptPh:'Alger coucher...', gen:'GÉNÉRER →', generating:'GÉNÉRATION...', success:'PRÊTE ✓', download:'TÉLÉCHARGER →', close:'FERMER' },
  ES: { title1:'SUPERNOVA', title2:'VIDEO STUDIO', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 Cine',desc:'Texto a video.',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi',name:'Mochi 1 Natural',desc:'Natural.',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD Studio',desc:'Imagen a video.',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OS',name:'OpenShorts',desc:'Largo a corto.',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'AI Studio',desc:'Flow.',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'Global Edge',desc:'Ping.',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 ULTRA',desc:'Checklist.',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'Enterprise',desc:'Contacto.',color:'rgba(212,175,55,0.08)'}], open:'ABRIR →', promptPh:'Argel...', gen:'GENERAR →', generating:'GENERANDO...', success:'LISTO ✓', download:'DESCARGAR →', close:'CERRAR' },
  DE: { title1:'SUPERNOVA', title2:'VIDEO STUDIO', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 Kino',desc:'Text-zu-Video.',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi',name:'Mochi 1 Natürlich',desc:'Natürlich.',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD Studio',desc:'Bild-zu-Video.',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OS',name:'OpenShorts',desc:'Lang zu Kurz.',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'AI Studio',desc:'Flow.',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'Global Edge',desc:'Ping.',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 ULTRA',desc:'Checkliste.',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'Enterprise',desc:'Kontakt.',color:'rgba(212,175,55,0.08)'}], open:'ÖFFNEN →', promptPh:'Algier...', gen:'GENERIEREN →', generating:'GENERIERT...', success:'FERTIG ✓', download:'DOWNLOAD →', close:'SCHLIESSEN' },
  ZH: { title1:'超新星', title2:'视频工作室', engines:[{id:'wan',icon:'WA',top:'Wan 2.2',name:'Wan 2.2 电影',desc:'文本到视频。',color:'rgba(212,175,55,0.14)'},{id:'mochi',icon:'MO',top:'Mochi',name:'Mochi 1 自然',desc:'自然运动。',color:'rgba(120,119,198,0.14)'},{id:'svd',icon:'SV',top:'SVD',name:'SVD 工作室',desc:'图像到视频。',color:'rgba(34,197,94,0.10)'},{id:'shorts',icon:'OS',top:'OS',name:'OpenShorts',desc:'长转短。',color:'rgba(6,182,212,0.12)'},{id:'ai',icon:'AI',top:'AI',name:'AI 工作室',desc:'流程。',color:'rgba(168,85,247,0.12)'},{id:'edge',icon:'ED',top:'Edge',name:'全球边缘',desc:'Ping。',color:'rgba(16,185,129,0.08)'},{id:'ultra',icon:'UL',top:'V14',name:'V14 ULTRA',desc:'清单。',color:'rgba(212,175,55,0.15)'},{id:'ent',icon:'EN',top:'Ent',name:'企业',desc:'联系。',color:'rgba(212,175,55,0.08)'}], open:'打开 →', promptPh:'阿尔及尔...', gen:'生成 →', generating:'生成中...', success:'就绪 ✓', download:'下载 →', close:'关闭' },
};

export default function Home() {
  const [lang,setLang]=useState('EN');
  const [open,setOpen]=useState<string|null>(null);
  const [prompts,setPrompts]=useState<{[k:string]:string}>({});
  const [gen,setGen]=useState<{[k:string]:boolean}>({});
  const [videos,setVideos]=useState<{[k:string]:{url:string,prompt:string}}>({});
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const t=translations[lang]||translations.EN;

  useEffect(()=>{
    const c=canvasRef.current; if(!c) return; const ctx=c.getContext('2d'); if(!ctx) return;
    c.width=window.innerWidth; c.height=window.innerHeight;
    const stars=Array.from({length:150},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.3+0.2,o:Math.random()*0.6+0.1,d:Math.random()*0.02+0.005}));
    let meteors:any[]=[];
    const spawn=()=>{ if(Math.random()<0.015){ const sx=Math.random()*c.width*0.8+c.width*0.1; meteors.push({x:sx,y:-30,vx:Math.random()*2+1.5,vy:Math.random()*3+3,o:1}); } };
    const anim=()=>{
      ctx.clearRect(0,0,c.width,c.height);
      stars.forEach(s=>{ s.o+=s.d; if(s.o>0.7||s.o<0.1) s.d*=-1; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${s.o})`; ctx.fill(); });
      spawn();
      meteors.forEach((m:any,i:number)=>{ m.x+=m.vx; m.y+=m.vy; m.o-=0.008; const tx=m.x-m.vx*18,ty=m.y-m.vy*18; const g=ctx.createLinearGradient(m.x,m.y,tx,ty); g.addColorStop(0,`rgba(255,255,255,${m.o})`); g.addColorStop(0.15,`rgba(212,175,55,${m.o*0.9})`); g.addColorStop(0.4,`rgba(212,175,55,${m.o*0.3})`); g.addColorStop(1,`rgba(212,175,55,0)`); ctx.strokeStyle=g; ctx.lineWidth=1.8; ctx.lineCap='round' as any; ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(tx,ty); ctx.stroke(); ctx.shadowBlur=8; ctx.shadowColor='rgba(212,175,55,0.8)'; ctx.beginPath(); ctx.arc(m.x,m.y,2.2,0,Math.PI*2); ctx.fillStyle=`rgba(255,255,255,${m.o})`; ctx.fill(); ctx.shadowBlur=0; if(m.o<=0||m.y>c.height+80) meteors.splice(i,1); });
      requestAnimationFrame(anim);
    }; anim();
    const onR=()=>{ c.width=window.innerWidth; c.height=window.innerHeight; }; window.addEventListener('resize',onR); return()=>window.removeEventListener('resize',onR);
  },[]);

  const handleGen = async (id:string)=>{
    const p=prompts[id]; if(!p||p.trim().length<2){ alert(lang==='AR'?'اكتب وصف':'Write prompt'); return; }
    setGen(s=>({...s,[id]:true}));
    await new Promise(r=>setTimeout(r,1800));
    const url=WORKING_VIDEOS[id]||WORKING_VIDEOS.wan;
    setVideos(s=>({...s,[id]:{url,p}}));
    setGen(s=>({...s,[id]:false}));
  };

  return (
    <div style={{minHeight:'100vh',background:'#050507',color:'white',fontFamily:'ui-monospace, monospace',position:'relative',overflowX:'hidden'}}>
      <canvas ref={canvasRef} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}} />
      <div style={{position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(5,5,7,0.9)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:50,flexWrap:'wrap',gap:'8px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}><div style={{width:'28px',height:'28px',borderRadius:'8px',background:'#D4AF37',display:'flex',alignItems:'center',justifyContent:'center',color:'black',fontWeight:900,fontSize:'10px',boxShadow:'0 0 20px rgba(212,175,55,0.4)'}}>SN</div><span style={{fontSize:'11px',letterSpacing:'0.15em',fontWeight:700,fontFamily:'system-ui'}}>SUPERNOVA V14 VIDEO STUDIO</span></div>
          <div style={{display:'flex',gap:'4px'}}>{['EN','AR','FR','ES','DE','ZH'].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:'5px 10px',borderRadius:'999px',fontSize:'10px',border:'1px solid rgba(255,255,255,0.1)',background:lang===l?'#D4AF37':'transparent',color:lang===l?'black':'rgba(255,255,255,0.4)',fontWeight:lang===l?700:400,cursor:'pointer'}}>{l}</button>)}</div>
        </div>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0 20px'}}>
          <div style={{padding:'40px 0 24px'}}><h1 style={{fontSize:'48px',fontWeight:900,lineHeight:0.95,letterSpacing:'-0.02em',margin:0,fontFamily:'system-ui, sans-serif',textTransform:'uppercase'}}>{t.title1} <span style={{color:'#D4AF37',textShadow:'0 0 30px rgba(212,175,55,0.5)'}}>V14</span><br/>{t.title2}</h1></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:'16px'}}>
            {t.engines.map((s:any)=>{
              const isG=gen[s.id]; const v=videos[s.id];
              return (<div key={s.id} onClick={()=>{if(!isG) setOpen(open===s.id?null:s.id)}} style={{borderRadius:'16px',border:open===s.id?'1px solid rgba(212,175,55,0.3)':'1px solid rgba(255,255,255,0.06)',background:`linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)), radial-gradient(600px at 0% 0%, ${s.color}, transparent 60%), #0F0F12`,padding:'20px',cursor:'pointer',transition:'all 0.3s',minHeight:'160px',display:'flex',flexDirection:'column',justifyContent:'space-between',boxShadow:open===s.id?'0 12px 40px rgba(212,175,55,0.12)':'0 4px 24px rgba(0,0,0,0.4)'}}>
                <div><div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}><div style={{width:'28px',height:'28px',borderRadius:'8px',background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:700}}>{s.icon}</div><span style={{fontSize:'8px',padding:'4px 8px',borderRadius:'999px',background:v?'rgba(34,197,94,0.15)':'rgba(0,0,0,0.4)',border:`1px solid ${v?'rgba(34,197,94,0.2)':'rgba(255,255,255,0.05)'}`,color:v?'#22c55e':'rgba(255,255,255,0.35)',letterSpacing:'0.1em'}}>{v?'✓ READY':s.top}</span></div><h3 style={{fontSize:'13px',fontWeight:700,marginTop:'18px',marginBottom:0,fontFamily:'system-ui'}}>{s.name}</h3><p style={{fontSize:'11px',color:'rgba(255,255,255,0.42)',marginTop:'8px',lineHeight:1.5,fontFamily:'system-ui'}}>{s.desc}</p></div>
                <div style={{marginTop:'20px'}}><span style={{fontSize:'10px',color:'#D4AF37',letterSpacing:'0.1em',opacity:0.9}}>{v?'✓ '+t.success:t.open}</span>
                  {open===s.id&&<div style={{marginTop:'16px',padding:'12px',borderRadius:'12px',background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.18)'}} onClick={e=>e.stopPropagation()}>
                    {!v?<><textarea value={prompts[s.id]||''} onChange={e=>setPrompts(p=>({...p,[s.id]:e.target.value}))} placeholder={t.promptPh} style={{width:'100%',height:'90px',background:'#050507',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'10px',fontSize:'12px',color:'white',outline:'none',resize:'none',fontFamily:'system-ui'}} /><button onClick={()=>handleGen(s.id)} disabled={isG} style={{marginTop:'10px',width:'100%',padding:'12px',borderRadius:'999px',background:isG?'rgba(212,175,55,0.3)':'#D4AF37',color:'black',fontWeight:900,fontSize:'11px',border:'none',cursor:isG?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>{isG&&<span style={{width:'12px',height:'12px',border:'2px solid rgba(0,0,0,0.3)',borderTop:'2px solid black',borderRadius:'50%',display:'inline-block',animation:'spin 1s linear infinite'}} />}{isG?t.generating:t.gen}</button></>:<div style={{display:'flex',flexDirection:'column',gap:'10px'}}><video src={v.url} controls autoPlay muted loop playsInline style={{width:'100%',borderRadius:'8px',background:'black',maxHeight:'200px'}} /><div style={{display:'flex',gap:'8px'}}><button onClick={()=>{setVideos(p=>{const n={...p}; delete n[s.id]; return n;}); setPrompts(p=>({...p,[s.id]:''}));}} style={{flex:1,padding:'10px',borderRadius:'999px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'white',fontWeight:700,fontSize:'10px',cursor:'pointer'}}>{t.close}</button><a href={v.url} download={`supernova-${s.id}.mp4`} target="_blank" rel="noopener noreferrer" style={{flex:1,padding:'10px',borderRadius:'999px',background:'#D4AF37',color:'black',fontWeight:900,fontSize:'10px',textAlign:'center',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>{t.download}</a></div></div>}
                  </div>}
                </div>
              </div>)
            })}
          </div>
          <div style={{height:'80px'}} />
        </div>
      </div>
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
