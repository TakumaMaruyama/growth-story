import VideoWithControls from '@/components/video/VideoWithControls';
import { useEffect, useState } from 'react';

export default function App() {
  const [isIframed, setIsIframed] = useState(true);

  useEffect(() => {
    setIsIframed(window.self !== window.top);
  }, []);

  if (!isIframed) {
    return (
      <div className="w-full h-screen bg-black overflow-hidden">
        <VideoWithControls />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#111] flex items-center justify-center overflow-hidden">
      <div
        className="relative shadow-2xl bg-black"
        style={{
          aspectRatio: '9/16',
          width: 'min(100vw, calc(100vh * 9 / 16))',
          height: 'min(100vh, calc(100vw * 16 / 9))',
        }}
      >
        <VideoWithControls />
      </div>
    </div>
  );
}
