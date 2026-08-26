import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-[6vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center z-10 w-full">
        {/* Logo / App Name */}
        <motion.div
          className="bg-white px-[4vw] py-[1.5vh] rounded-[4vw] shadow-[0_10px_30px_rgba(30,64,175,0.08)] mb-[6vh] border border-[#d8e0ec] flex items-center justify-center gap-[2vw]"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Logo" className="w-[8vw] h-[8vw] object-contain rounded-[1.5vw]" />
          <h1 className="text-[7vw] font-black text-[#172033] tracking-tight">
            私の<span className="text-[#1d4ed8]">競泳</span>物語
          </h1>
        </motion.div>

        {/* Floating elements */}
        <div className="relative w-full h-[35vh] mb-[4vh]">
          {/* Card 1 */}
          <motion.div
            className="absolute top-[5%] left-[5%] w-[40vw] bg-white rounded-[3vw] p-[3vw] shadow-lg border border-[#d8e0ec]"
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, rotate: -6, opacity: 1 } : { scale: 0, rotate: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.1 }}
          >
            <div className="w-[8vw] h-[8vw] rounded-full bg-[#dbeafe] flex items-center justify-center mb-[2vw]">
              <div className="w-[4vw] h-[4vw] bg-[#2563eb] rounded-sm" />
            </div>
            <div className="h-[2vw] w-[80%] bg-[#f4f7fb] rounded mb-[1vw]" />
            <div className="h-[2vw] w-[50%] bg-[#f4f7fb] rounded" />
          </motion.div>

          {/* Card 2 */}
          <motion.div
            className="absolute top-[25%] right-[5%] w-[42vw] bg-white rounded-[3vw] p-[3vw] shadow-lg border border-[#d8e0ec]"
            initial={{ scale: 0, rotate: 20, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, rotate: 8, opacity: 1 } : { scale: 0, rotate: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.2 }}
          >
            <div className="w-[8vw] h-[8vw] rounded-full bg-[#ffedd5] flex items-center justify-center mb-[2vw]">
              <div className="w-[4vw] h-[4vw] bg-[#c2410c] rounded-full" />
            </div>
            <div className="h-[2vw] w-[70%] bg-[#f4f7fb] rounded mb-[1vw]" />
            <div className="h-[2vw] w-[60%] bg-[#f4f7fb] rounded" />
          </motion.div>

          {/* Card 3 */}
          <motion.div
            className="absolute bottom-[10%] left-[25%] w-[45vw] bg-white rounded-[3vw] p-[3vw] shadow-lg border border-[#d8e0ec] z-10"
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, y: 0, opacity: 1 } : { scale: 0, y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.3 }}
          >
            <div className="w-[8vw] h-[8vw] rounded-full bg-[#ede9fe] flex items-center justify-center mb-[2vw]">
              <div className="w-[4vw] h-[4vw] bg-[#7c3aed] rounded-sm rotate-45" />
            </div>
            <div className="h-[2vw] w-[90%] bg-[#f4f7fb] rounded mb-[1vw]" />
            <div className="h-[2vw] w-[40%] bg-[#f4f7fb] rounded" />
          </motion.div>
        </div>

        {/* Main Telop */}
        <div className="overflow-hidden">
          <motion.h2
            className="text-[6.5vw] font-bold text-[#172033] text-center leading-[1.4]"
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            競泳選手の<br/>
            <span className="text-[#1d4ed8] font-black text-[7.5vw]">「成長」</span>を可視化する
          </motion.h2>
        </div>
      </div>
    </motion.div>
  );
}