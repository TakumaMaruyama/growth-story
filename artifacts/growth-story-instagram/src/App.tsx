import VideoWithControls from '@/components/video/VideoWithControls';

export default function App() {
  return (
    <div className="w-full h-[100dvh] bg-[#111] flex items-center justify-center overflow-hidden">
      <div
        className="relative shadow-2xl bg-black"
        style={{
          aspectRatio: '9/16',
          width: 'min(100vw, calc(100dvh * 9 / 16))',
          height: 'min(100dvh, calc(100vw * 16 / 9))',
        }}
      >
        <VideoWithControls />
      </div>
    </div>
  );
}
