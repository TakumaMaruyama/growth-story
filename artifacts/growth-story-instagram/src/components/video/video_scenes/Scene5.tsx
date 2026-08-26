import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 2000), // Outro transition
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center p-[6vw] justify-center"
      initial={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)' }}
      animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence>
        {phase < 2 && (
          <motion.div 
            className="w-full h-full flex flex-col items-center justify-center absolute inset-0 p-[6vw]"
            exit={{ scale: 1.2, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Timeline UI */}
            <div className="w-full relative h-[60vh] mb-[6vh] overflow-hidden rounded-[6vw] bg-white shadow-xl border border-[#d8e0ec] p-[5vw]">
              
              <div className="text-[4.5vw] font-bold text-[#172033] mb-[3vh]">タイムライン</div>
              
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[1.5vw] top-0 bottom-0 w-[2px] bg-[#d8e0ec]" />
                
                {/* Items sliding up */}
                <motion.div 
                  className="flex flex-col gap-[3vh]"
                  animate={{ y: ['0%', '-30%'] }}
                  transition={{ duration: 3, ease: 'linear' }}
                >
                  {/* Item 1 - Daily */}
                  <div className="relative pl-[6vw]">
                    <div className="absolute left-[0] top-[0.5vw] w-[3.5vw] h-[3.5vw] rounded-full bg-[#2563eb] border-2 border-white" />
                    <div className="flex items-center gap-[2vw] mb-[0.5vh]">
                      <div className="text-[2.8vw] text-[#475569] font-bold">8月26日</div>
                      <div className="text-[2.2vw] font-bold text-[#2563eb] bg-[#dbeafe] px-[2vw] py-[0.2vh] rounded-full">日誌</div>
                    </div>
                    <div className="text-[3.2vw] font-bold mb-[0.2vh]">練習日誌</div>
                    <div className="text-[2.8vw] text-[#475569]">自己評価 8/10・練習</div>
                  </div>
                  
                  {/* Item 2 - Goal */}
                  <div className="relative pl-[6vw]">
                    <div className="absolute left-[0] top-[0.5vw] w-[3.5vw] h-[3.5vw] rounded-full bg-[#c2410c] border-2 border-white" />
                    <div className="flex items-center gap-[2vw] mb-[0.5vh]">
                      <div className="text-[2.8vw] text-[#475569] font-bold">8月20日</div>
                      <div className="text-[2.2vw] font-bold text-[#c2410c] bg-[#ffedd5] px-[2vw] py-[0.2vh] rounded-full">大会目標</div>
                    </div>
                    <div className="text-[3.2vw] font-bold mb-[0.2vh]">春季記録会</div>
                    <div className="text-[2.8vw] text-[#475569]">100m自由形で自己ベスト</div>
                  </div>
                  
                  {/* Item 3 - Story */}
                  <div className="relative pl-[6vw]">
                    <div className="absolute left-[0] top-[0.5vw] w-[3.5vw] h-[3.5vw] rounded-full bg-[#7c3aed] border-2 border-white" />
                    <div className="flex items-center gap-[2vw] mb-[0.5vh]">
                      <div className="text-[2.8vw] text-[#475569] font-bold">8月15日</div>
                      <div className="text-[2.2vw] font-bold text-[#7c3aed] bg-[#ede9fe] px-[2vw] py-[0.2vh] rounded-full">競泳物語</div>
                    </div>
                    <div className="text-[3.2vw] font-bold mb-[0.2vh]">競泳物語 Ver.2</div>
                    <div className="text-[2.8vw] text-[#475569]">夏合宿を終えて</div>
                  </div>
                  
                  {/* Item 4 - Daily */}
                  <div className="relative pl-[6vw]">
                    <div className="absolute left-[0] top-[0.5vw] w-[3.5vw] h-[3.5vw] rounded-full bg-[#2563eb] border-2 border-white" />
                    <div className="flex items-center gap-[2vw] mb-[0.5vh]">
                      <div className="text-[2.8vw] text-[#475569] font-bold">8月10日</div>
                      <div className="text-[2.2vw] font-bold text-[#2563eb] bg-[#dbeafe] px-[2vw] py-[0.2vh] rounded-full">日誌</div>
                    </div>
                    <div className="text-[3.2vw] font-bold mb-[0.2vh]">練習日誌</div>
                    <div className="text-[2.8vw] text-[#475569]">自己評価 7/10・お休み</div>
                  </div>
                </motion.div>
              </div>

            </div>

            {/* Telop */}
            <div className="text-center w-full mt-auto mb-[10vh]">
              <motion.div
                className="inline-block bg-[#172033] text-white px-[4vw] py-[1vh] rounded-full text-[3vw] font-bold tracking-widest mb-[2vh]"
                initial={{ y: 20, opacity: 0 }}
                animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                STEP 04
              </motion.div>
              <motion.h2
                className="text-[6.5vw] font-black text-[#172033] leading-tight"
                initial={{ y: 20, opacity: 0 }}
                animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                過去の記録を<br/>
                <span className="text-[#172033]">タイムラインで一望</span>
              </motion.h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outro */}
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#1d4ed8]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.img 
              src={`${import.meta.env.BASE_URL}icons/icon-192.png`} 
              alt="Logo" 
              className="w-[18vw] h-[18vw] object-contain rounded-[4vw] mb-[3vh] shadow-xl"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            
            <motion.h1 
              className="text-[9vw] font-black text-white tracking-tight text-center leading-tight mb-[4vh]"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.2 }}
            >
              私の<span className="text-[#93c5fd]">競泳</span>物語
            </motion.h1>

            <motion.div
              className="text-white/90 font-medium text-[4vw] tracking-[0.1em]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              成長の軌跡を、すべてのスイマーに。
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}