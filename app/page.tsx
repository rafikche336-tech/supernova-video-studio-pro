'use client';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [engine, setEngine] = useState('wan2.2');
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center py-12">
          <h1 className="text-6xl font-bold">Supernova Video Studio</h1>
          <p className="mt-4 text-xl text-gray-400">All-in-One AI Video Studio</p>
        </header>
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
            placeholder="A cinematic shot of a supernova exploding..."
            className="w-full h-32 bg-black border border-gray-800 rounded-xl p-4" />
          <button className="mt-4 bg-white text-black px-8 py-3 rounded-full font-bold">Generate Video 🚀</button>
        </div>
      </div>
    </main>
  );
}
