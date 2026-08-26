import { useEffect } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import type { ComponentType } from 'react';

import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  home: 3500,
  dailyLog: 4000,
  goal: 4000,
  story: 4000,
  timeline: 4500,
};

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  home: Scene1,
  dailyLog: Scene2,
  goal: Scene3,
  story: Scene4,
  timeline: Scene5,
};

const BGS = [
  '#f4f7fb', // Home
  '#dbeafe', // Daily (blue)
  '#ffedd5', // Goal (orange)
  '#ede9fe', // Story (purple)
  '#f4f7fb', // Timeline (bg)
];

const ACCENT_COLORS = [
  '#1d4ed8', // primary
  '#2563eb', // daily
  '#c2410c', // goal
  '#7c3aed', // story
  '#172033', // foreground
];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const safeSceneIndex = Math.max(0, sceneIndex);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  return (
    <div className="w-full h-screen overflow-hidden relative font-sans text-[#172033]">
      {/* Persistent Background */}
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: BGS[safeSceneIndex] }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
      
      {/* Background abstract shape to add depth */}
      <motion.div
        className="absolute w-[150vw] h-[150vw] rounded-full opacity-[0.03] pointer-events-none"
        style={{ top: '-20vh', left: '-25vw', backgroundColor: '#000' }}
        animate={{ 
          scale: [1, 1.1, 1],
          y: safeSceneIndex * 20,
          rotate: safeSceneIndex * 45
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />
      
      <motion.div
        className="absolute w-[120vw] h-[120vw] rounded-full opacity-[0.04] pointer-events-none"
        style={{ bottom: '-30vh', right: '-30vw', backgroundColor: '#000' }}
        animate={{ 
          scale: [1, 1.2, 1],
          x: safeSceneIndex * -10,
          rotate: safeSceneIndex * -30
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* Progress Bar at top */}
      <motion.div
        className="absolute top-0 left-0 h-[0.8vh] z-50 origin-left"
        animate={{ backgroundColor: ACCENT_COLORS[safeSceneIndex] }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="h-full bg-black/20"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: (safeSceneIndex + 1) / 5 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: 0, width: '100vw' }}
        />
      </motion.div>

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}