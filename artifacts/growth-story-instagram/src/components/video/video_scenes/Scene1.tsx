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
      className="absolute inset-0 flex flex-col items-center justify-center p-[6cqw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center z-10 w-full">
        {/* Logo / App Name */}
        <motion.div
          className="bg-white px-[4cqw] py-[1.5cqh] rounded-[4cqw] shadow-[0_10px_30px_rgba(30,64,175,0.08)] mb-[6cqh] border border-[#d8e0ec] flex items-center justify-center gap-[2cqw]"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Logo" className="w-[8cqw] h-[8cqw] object-contain rounded-[1.5cqw]" />
          <h1 className="text-[7cqw] font-black text-[#172033] tracking-tight">
            私の<span className="text-[#1d4ed8]">競泳</span>物語
          </h1>
        </motion.div>

        {/* Floating elements */}
        <div className="relative w-full h-[35cqh] mb-[4cqh]">
          {/* Card 1 */}
          <motion.div
            className="absolute top-[5%] left-[5%] w-[40cqw] bg-white rounded-[3cqw] p-[3cqw] shadow-lg border border-[#d8e0ec]"
            initial={{ scale: 0, rotate: -20, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, rotate: -6, opacity: 1 } : { scale: 0, rotate: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.1 }}
          >
            <div className="w-[8cqw] h-[8cqw] rounded-full bg-[#dbeafe] flex items-center justify-center mb-[2cqw]">
              <div className="w-[4cqw] h-[4cqw] bg-[#2563eb] rounded-sm" />
            </div>
            <div className="h-[2cqw] w-[80%] bg-[#f4f7fb] rounded mb-[1cqw]" />
            <div className="h-[2cqw] w-[50%] bg-[#f4f7fb] rounded" />
          </motion.div>

          {/* Card 2 */}
          <motion.div
            className="absolute top-[25%] right-[5%] w-[42cqw] bg-white rounded-[3cqw] p-[3cqw] shadow-lg border border-[#d8e0ec]"
            initial={{ scale: 0, rotate: 20, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, rotate: 8, opacity: 1 } : { scale: 0, rotate: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.2 }}
          >
            <div className="w-[8cqw] h-[8cqw] rounded-full bg-[#ffedd5] flex items-center justify-center mb-[2cqw]">
              <div className="w-[4cqw] h-[4cqw] bg-[#c2410c] rounded-full" />
            </div>
            <div className="h-[2cqw] w-[70%] bg-[#f4f7fb] rounded mb-[1cqw]" />
            <div className="h-[2cqw] w-[60%] bg-[#f4f7fb] rounded" />
          </motion.div>

          {/* Card 3 */}
          <motion.div
            className="absolute bottom-[10%] left-[25%] w-[45cqw] bg-white rounded-[3cqw] p-[3cqw] shadow-lg border border-[#d8e0ec] z-10"
            initial={{ scale: 0, y: 50, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, y: 0, opacity: 1 } : { scale: 0, y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.3 }}
          >
            <div className="w-[8cqw] h-[8cqw] rounded-full bg-[#ede9fe] flex items-center justify-center mb-[2cqw]">
              <div className="w-[4cqw] h-[4cqw] bg-[#7c3aed] rounded-sm rotate-45" />
            </div>
            <div className="h-[2cqw] w-[90%] bg-[#f4f7fb] rounded mb-[1cqw]" />
            <div className="h-[2cqw] w-[40%] bg-[#f4f7fb] rounded" />
          </motion.div>
        </div>

        {/* Main Telop */}
        <div className="overflow-hidden">
          <motion.h2
            className="text-[6.5cqw] font-bold text-[#172033] text-center leading-[1.4]"
            initial={{ y: '100%' }}
            animate={phase >= 2 ? { y: '0%' } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            競泳選手の<br/>
            <span className="text-[#1d4ed8] font-black text-[7.5cqw]">「成長」</span>を可視化する
          </motion.h2>
        </div>
      </div>
    </motion.div>
  );
}