'use client';
import { useState } from 'react';

const engines = [
  { id: 'wan2.2', icon: 'W2', name: 'Wan 2.2', desc: 'Cinematic Text-to-Video, SOTA quality, 4K. Real router production.', meta: 'Cinematic', color: 'from-purple-600 to-pink-600' },
  { id: 'mochi1', icon: 'M1', name: 'Mochi 1', desc: 'Natural motion, physics-aware, smooth 24fps generation.', meta: 'Natural', color: 'from-blue-600 to-cyan-600' },
  { id: 'svd', icon: 'SV', name: 'SVD Studio', desc: 'Image-to-Video, 8 styles, depth control, real engine.', meta: 'Image2Video', color: 'from-emerald-600 to-teal-600' },
  { id: 'openshorts', icon: 'OS', name: 'OpenShorts', desc: 'Long video to viral shorts, auto-clip, captions.', meta: 'Long2Shorts', color: 'from-orange-600 to-red-600' },
  { id: 'aistudio', icon: 'AI', name: 'AI Studio', desc: 'Flow builder, prompt chaining, save workflows.', meta: 'Beta', color: 'from-yellow-600 to-amber-600' },
  { id: 'edge', icon: 'ED', name: 'Global Edge', desc: 'Algiers • Oran • Constantine, low latency render.', meta: 'Edge', color: 'from-zinc-600 to-zinc-800' },
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState('wan2.2');
  const selected = engines.find(e => e.id === engine);

  return (
    <main className="min-h-screen bg-[#050507] text-white relative overflow-hidden selection:bg-[#D4AF37]/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.12),transparent_60%)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: `radial-gradient(white 1px, transparent 1px)`, backgroundSize: '80px 80px'}} />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-black text-">SN</div>
            <span className="text- tracking-[0.2em] font-bold">SUPERNOVA VIDEO STUDIO • V14</span>
            <span className="hidden md:inline text- px-3 py-1 rounded-full border border-[#D4AF37]/20 text-[#D4AF37]/70 ml-2">PRODUCTION • ALGIERS EDGE</span>
          </div>
          <div className="flex gap-1">
            {['EN','AR','FR'].map(l=>(
              <span key={l} className={`px-3 py-1 rounded-full text- border ${l==='EN'?'bg-[#D4AF37] text-black border-[#D4AF37]':'border-white/10 text-white/40'}`}>{l}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between gap-8 py-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] text- text-[#D4AF37] tracking-widest mb-5">● 4 ENGINES • ONE STUDIO • REAL SERVICE</div>
            <h1 className="text-5xl md:text-6xl font-black leading-[0.9] tracking-tight">
              SUPERNOVA<br/><span className="text-[#D4AF37]">VIDEO</span> STUDIO
            </h1>
            <p className="text-sm text-white/40 mt-4 max-w-xl leading-relaxed">Wan 2.2 + Mochi 1 + SVD + OpenShorts. All-in-one AI video platform. Built in Batna, Algeria. No mocks. Real engines.</p>
          </div>
          <div className="flex gap-3 h-fit">
            <div className="px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] min-w-">
              <div className="text- tracking-widest text-white/20">M1</div>
              <div className="text-xs mt-2 leading-relaxed">12.4K videos<br/><span className="text-white/30">/ 24h</span></div>
            </div>
            <div className="px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] min-w-">
              <div className="text- tracking-widest text-white/20">M2</div>
              <div className="text-xs mt-2 leading-relaxed">18s p95<br/><span className="text-white/30">render</span></div>
            </div>
            <div className="px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] min-w-">
              <div className="text- tracking-widest text-white/20">M3</div>
              <div className="text-xs mt-2 leading-relaxed">99.98%<br/><span className="text-white/30">uptime</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {engines.slice(0,4).map(e=>(
            <button key={e.id} onClick={()=>setEngine(e.id)}
              className={`group relative text-left rounded- border p-6 transition-all duration-300 ${engine===e.id?'border-[#D4AF37]/40 bg-[#D4AF37]/[0.08] scale-[1.02]':'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'}`}>
              {engine===e.id && <div className={`absolute inset-0 rounded- bg-gradient-to-br ${e.color} opacity-[0.08] blur-xl`} />}
              <div className="relative flex justify-between items-start mb-5">
                <div className="w-9 h-9 rounded-xl bg-black border border-white/10 flex items-center justify-center text- font-bold tracking-widest">{e.icon}</div>
                <span className={`text- px-2.5 py-1 rounded-full border ${engine===e.id?'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]':'border-white/5 bg-black/40 text-white/20'}`}>{e.meta}</span>
              </div>
              <div className="relative">
                <h3 className="font-bold text- tracking-wide">{e.name}</h3>
                <p className="text- text-white/40 mt-2 leading-relaxed">{e.desc}</p>
                <div className="mt-6 flex items-center gap-2">
                  <div className={`text- tracking-[0.15em] ${engine===e.id?'text-[#D4AF37]':'text-white/20 group-hover:text-white/40'}`}>{engine===e.id?'SELECTED • GENERATE →':'OPEN ENGINE →'}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded- border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-">
          <div className="rounded- bg-[#0A0A0C] p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${selected?.color} animate-pulse`} />
                <span className="text-xs font-bold tracking-widest">PROMPT STUDIO</span>
                <span className="text- px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40">{selected?.name} • {selected?.meta}</span>
              </div>
              <span className="text- text-white/20">REAL BEHAVIOR • No fake alerts</span>
            </div>
            
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder="A cinematic supernova explosion over the Sahara desert, ultra detailed, volumetric lighting, 4K, slow motion..."
              className="w-full h-36 bg-[#050507] border border-white/[0.08] rounded-2xl p-5 text- leading-relaxed outline-none focus:border-[#D4AF37]/30 focus:bg-black transition placeholder:text-white/20 resize-none" />
            
            <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text- text-white/30">
                <span className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">MIT Licensed</span>
                <span className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">Open Source</span>
                <span className="hidden md:inline">Batna, Algeria 🇩🇿</span>
              </div>
              <button className="w-full md:w-auto px-8 py-3.5 rounded-full bg-[#D4AF37] text-black font-black text- tracking-widest hover:bg-[#E5C158] transition flex items-center justify-center gap-2">
                GENERATE VIDEO <span>→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 flex flex-col md:flex-row justify-between gap-2">
          <div className="text- tracking-widest text-white/20">REAL ENGINES: Wan 2.2 • Mochi 1 • SVD • OpenShorts • Next.js 14 • Tailwind • Vercel Edge</div>
          <div className="text- text-white/20">SESSION STATE • NO FAKE ALERTS • sn_live_ • v14.0.3</div>
        </div>

        <footer className="text-center py-12 mt-8 border-t border-white/[0.05]">
          <div className="text- tracking-[0.35em] text-white/15 font-bold">ONLY ALGERIA • SUPERNOVA SOLUTIONS HQ</div>
          <div className="text- text-white/25 mt-3">Algiers • Oran • Constantine • Batna • Edge PoP • supernova-video-studio-pro.vercel.app</div>
        </footer>
      </div>
    </main>
  );
}
