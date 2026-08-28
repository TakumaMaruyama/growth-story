import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-[6cqw]"
      initial={{ clipPath: 'circle(0% at 50% 100%)' }}
      animate={{ clipPath: 'circle(150% at 50% 100%)' }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* UI Mockup */}
      <motion.div
        className="w-full bg-white rounded-[6cqw] shadow-xl border border-[#d8e0ec] overflow-hidden mb-[6cqh] flex flex-col"
        style={{ height: '55cqh' }}
        initial={{ y: 50, opacity: 0 }}
        animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        {/* Header */}
        <div className="bg-[#2563eb] px-[5cqw] py-[3cqh] text-white flex items-center justify-between">
          <div className="text-[4.5cqw] font-bold">練習日誌</div>
          <div className="text-[3.5cqw] font-outfit font-semibold opacity-80">08.26 TUE</div>
        </div>
        
        {/* Content */}
        <div className="p-[5cqw] flex-1 flex flex-col gap-[3cqh]">
          <div>
            <div className="text-[#475569] text-[3cqw] font-bold mb-[1cqh]">今日の調子</div>
            <div className="flex gap-[2cqw]">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.div
                  key={star}
                  className="w-[8cqw] h-[8cqw] rounded-full bg-[#f4f7fb] flex items-center justify-center"
                  animate={phase >= 2 && star <= 4 ? { backgroundColor: '#2563eb', scale: [1, 1.2, 1] } : {}}
                  transition={{ delay: 1.2 + star * 0.1, duration: 0.4 }}
                >
                  <div className={`w-[4cqw] h-[4cqw] rounded-full ${phase >= 2 && star <= 4 ? 'bg-white' : 'bg-[#d8e0ec]'}`} />
                </motion.div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="text-[#475569] text-[3cqw] font-bold mb-[1cqh]">練習メニュー</div>
            <div className="bg-[#f4f7fb] rounded-[3cqw] p-[3cqw] space-y-[2cqw]">
              <motion.div 
                className="h-[2cqw] bg-[#d8e0ec] rounded-full w-[80%]"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.5, delay: 1.8 }}
              />
              <motion.div 
                className="h-[2cqw] bg-[#d8e0ec] rounded-full w-[60%]"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.5, delay: 2.0 }}
              />
              <motion.div 
                className="h-[2cqw] bg-[#d8e0ec] rounded-full w-[90%]"
                style={{ originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.5, delay: 2.2 }}
              />
            </div>
          </div>

          <motion.div 
            className="mt-auto bg-[#2563eb] text-white text-center py-[2.5cqh] rounded-[3cqw] font-bold text-[3.5cqw]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', delay: 2.5 }}
          >
            記録を保存
          </motion.div>
        </div>
      </motion.div>

      {/* Telop */}
      <div className="text-center w-full">
        <motion.div
          className="inline-block bg-[#1e40af] text-white px-[4cqw] py-[1cqh] rounded-full text-[3cqw] font-bold tracking-widest mb-[2cqh]"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          STEP 01
        </motion.div>
        <motion.h2
          className="text-[6.5cqw] font-black text-[#172033] leading-tight"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          練習日誌で<br/>
          <span className="text-[#2563eb]">日々の努力</span>を記録
        </motion.h2>
      </div>
    </motion.div>
  );
}