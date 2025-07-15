'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/game'), {
  ssr: false,
  loading: () => <div className="text-center text-primary">Loading Game...</div>
});

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 overflow-hidden">
      <Game />
    </main>
  );
}
