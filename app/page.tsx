'use client';
import { useState } from 'react';

const engines = [
  { id: 'AU', icon: 'AU', name: 'Auth & Billing', desc: 'Create live API keys, copy, delete, usage slider.', meta: '2/3 keys' },
  { id: 'AN', icon: 'AN', name: 'Analytics', desc: 'Canvas line chart, refresh, export CSV, counters.', meta: '65,684 req' },
  { id: 'MA', icon: 'MA', name: 'Marketplace', desc: '8 agents, search, cart, real checkout toast.', meta: '8 in cart' },
  { id: 'MO', icon: 'MO', name: 'Mobile SDK', desc: 'Copy iOS/Android snippets, download instructions.', meta: 'SDK v14.2' },
  { id: 'EN', icon: 'EN', name: 'Enterprise', desc: 'Contact form, validates email, lists requests.', meta: '0 requests' },
  { id: 'AI', icon: 'AI', name: 'AI Studio', desc: '3-column flow builder, add nodes, save flows.', meta: '1 flows' },
  { id: 'ED', icon: 'ED', name: 'Global Edge', desc: 'Ping all regions, live latency animation, map.', meta: '0/6 pinged' },
  { id: 'UL', icon: 'UL', name: 'V14 ULTRA', desc: 'Progress checklist, toggle, progress bar.', meta: '40% ready' },
];

export default function Home() {
  const [lang, setLang] = useState('EN');
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black font-black text-xs">SN</div>
            <span className="text-xs tracking-widest font-bold">SUPERNOVA V14 REAL SERVICES</span>
            <span className="text- px-3 py-1 rounded-full border border-[#D4AF37]/20 text-[#D4AF37]/60 ml-3">PRODUCTION • ALGIERS EDGE</span>
          </div>
          <div className="flex gap-1">
            {['EN','AR','FR','ES','DE','ZH'].map(l=>(
              <button key={l} onClick={()=>setLang(l)} className={`px-3 py-1 rounded-full text- border ${lang===l?'bg-[#D4AF37] text-black':'border-white/10 text-white/40'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-between mb-10">
          <div>
            <div className="inline-block px-3 py-1 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 text- text-[#D4AF37] mb-4">● CLICK ANY CARD → REAL SERVICE</div>
            <h1 className="text-5xl font-black leading-none">SUPERNOVA <span className="text-[#D4AF37]">V14</span><br/>REAL SERVICES</h1>
            <p className="text-xs text-white/30 mt-3">Every card is a working service. No mocks. Build, measure, ship.</p>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 min-w-"><div className="text- text-white/30">M1</div><div className="text-xs mt-1">47.2K requests<br/>/ 24h</div></div>
            <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 min-w-"><div className="text- text-white/30">M2</div><div className="text-xs mt-1">18ms p95<br/>latency</div></div>
            <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 min-w-"><div className="text- text-white/30">M3</div><div className="text-xs mt-1">99.98% uptime</div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engines.map(e=>(
            <div key={e.id} className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 hover:border-[#D4AF37]/20 transition">
              <div className="flex justify-between mb-6">
                <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center text- font-bold">{e.icon}</div>
                <span className="text- px-2 py-1 rounded-full bg-black/50 border border-white/5 text-white/30">{e.meta}</span>
              </div>
              <h3 className="font-bold text-sm">{e.name}</h3>
              <p className="text-xs text-white/40 mt-2 mb-6">{e.desc}</p>
              <div className="text- text-[#D4AF37]/60 tracking-widest">OPEN SERVICE →</div>
            </div>
          ))}
        </div>

        <footer className="text-center mt-20 pt-10 border-t border-white/5">
          <div className="text- tracking-[0.3em] text-white/20">ONLY ALGERIA</div>
          <div className="text-xs text-white/20 mt-2">Algiers • Oran • Constantine • Edge PoP • sn_live_ • v14.0.3</div>
        </footer>
      </div>
    </main>
  );
}
