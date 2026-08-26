import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-[6cqw]"
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0 0)' }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* UI Mockup */}
      <motion.div
        className="w-full bg-white rounded-[6cqw] shadow-xl border border-[#d8e0ec] overflow-hidden mb-[6cqh] flex flex-col relative"
        style={{ height: '55cqh' }}
        initial={{ y: 50, opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        {/* Header */}
        <div className="bg-[#c2410c] px-[5cqw] py-[3cqh] text-white flex items-center justify-between">
          <div className="text-[4.5cqw] font-bold">大会目標</div>
          <div className="text-[3cqw] font-bold bg-white/20 px-[3cqw] py-[0.5cqh] rounded-full">
            あと 14 日
          </div>
        </div>
        
        {/* Content */}
        <div className="p-[5cqw] flex-1 flex flex-col items-center justify-center relative">
          
          <motion.div 
            className="text-[#475569] font-bold text-[3.5cqw] mb-[2cqh]"
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          >
            ターゲットタイム
          </motion.div>

          {/* Time Counter */}
          <motion.div 
            className="font-outfit font-black text-[12cqw] text-[#9a3412] leading-none tracking-tighter flex items-end gap-[1cqw] mb-[4cqh]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <motion.span
              initial={{ y: -20, opacity: 0 }}
              animate={phase >= 3 ? { y: 0, opacity: 1 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >0</motion.span>
            <span className="text-[8cqw] pb-[1cqh]">:</span>
            <motion.span
              initial={{ y: -20, opacity: 0 }}
              animate={phase >= 3 ? { y: 0, opacity: 1 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.1 }}
            >54</motion.span>
            <span className="text-[8cqw] pb-[1cqh]">.</span>
            <motion.span
              initial={{ y: -20, opacity: 0 }}
              animate={phase >= 3 ? { y: 0, opacity: 1 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25, delay: 0.2 }}
            >28</motion.span>
          </motion.div>

          {/* Progress element */}
          <div className="w-full relative h-[4cqw] bg-[#fef3c7] rounded-full overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-[#c2410c]"
              initial={{ width: '0%' }}
              animate={phase >= 3 ? { width: '68%' } : { width: '0%' }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <div className="w-full flex justify-between mt-[1cqh] text-[2.5cqw] font-outfit text-[#c2410c] font-bold">
            <span>START</span>
            <span>GOAL</span>
          </div>

        </div>
      </motion.div>

      {/* Telop */}
      <div className="text-center w-full">
        <motion.div
          className="inline-block bg-[#9a3412] text-white px-[4cqw] py-[1cqh] rounded-full text-[3cqw] font-bold tracking-widest mb-[2cqh]"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          STEP 02
        </motion.div>
        <motion.h2
          className="text-[6.5cqw] font-black text-[#172033] leading-tight"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          大会目標を設定し<br/>
          <span className="text-[#c2410c]">到達度</span>を確認
        </motion.h2>
      </div>
    </motion.div>
  );
}