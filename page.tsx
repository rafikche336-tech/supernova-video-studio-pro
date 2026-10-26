'use client';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState('wan2.2');

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center py-12">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Supernova Video Studio
          </h1>
          <p className="mt-4 text-xl text-gray-400">All-in-One AI Video Studio - Wan 2.2 + Mochi 1 + SVD + OpenShorts</p>
          <p className="mt-2 text-sm text-gray-500">By SupernovaSolutionsHQ • Built in Batna, Algeria 🇩🇿</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { id: 'wan2.2', name: 'Wan 2.2', desc: 'Cinematic Text2Video' },
            { id: 'mochi1', name: 'Mochi 1', desc: 'Natural Motion' },
            { id: 'svd', name: 'SVD', desc: 'Image to Video' },
            { id: 'openshorts', name: 'OpenShorts', desc: 'Long to Shorts' },
          ].map(e => (
            <button key={e.id} onClick={() => setEngine(e.id)}
              className={`p-6 rounded-xl border text-left transition ${engine===e.id ? 'border-purple-500 bg-purple-500/20' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}`}>
              <div className="font-bold">{e.name}</div>
              <div className="text-sm text-gray-400">{e.desc}</div>
            </button>
          ))}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <label className="text-sm text-gray-400">Your prompt</label>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
            placeholder="A cinematic shot of a supernova exploding in deep space, 4K..."
            className="w-full mt-2 h-32 bg-black border border-gray-800 rounded-xl p-4 outline-none focus:border-purple-500" />
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">Engine: {engine} • MIT Licensed</span>
            <button className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200">Generate Video 🚀</button>
          </div>
        </div>

        <footer className="text-center mt-12 text-gray-600 text-sm">
          © 2026 SupernovaSolutionsHQ - supernova-video-studio
        </footer>
      </div>
    </main>
  );
}