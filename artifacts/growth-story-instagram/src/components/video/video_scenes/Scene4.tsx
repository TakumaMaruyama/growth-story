import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center p-[6vw]"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* UI Mockup */}
      <motion.div
        className="w-full bg-white rounded-[6vw] shadow-xl border border-[#d8e0ec] overflow-hidden mb-[6vh] flex flex-col relative"
        style={{ height: '55vh' }}
        initial={{ y: 50, opacity: 0, rotate: -2 }}
        animate={phase >= 1 ? { y: 0, opacity: 1, rotate: 0 } : { y: 50, opacity: 0, rotate: -2 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      >
        {/* Header */}
        <div className="bg-[#7c3aed] px-[5vw] py-[3vh] text-white flex items-center justify-between">
          <div className="text-[4.5vw] font-bold">競泳物語</div>
          <div className="text-[3vw] font-outfit font-bold bg-white/20 px-[3vw] py-[0.5vh] rounded-full">
            1 / 15
          </div>
        </div>
        
        {/* Content */}
        <div className="p-[5vw] flex-1 flex flex-col relative">
          
          <motion.div 
            className="w-[12vw] h-[12vw] rounded-full bg-[#ede9fe] flex items-center justify-center mb-[3vh]"
            initial={{ scale: 0 }}
            animate={phase >= 2 ? { scale: 1 } : { scale: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <span className="font-outfit font-black text-[5vw] text-[#7c3aed]">Q1</span>
          </motion.div>

          <motion.div 
            className="text-[4.5vw] font-bold text-[#172033] leading-snug mb-[4vh]"
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          >
            水泳を始めたきっかけは<br/>何ですか？
          </motion.div>

          {/* Typing area */}
          <motion.div 
            className="w-full bg-[#f4f7fb] rounded-[4vw] p-[4vw] min-h-[15vh] border border-[#d8e0ec]"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          >
            <div className="text-[#475569] text-[3.5vw] font-medium leading-relaxed">
              {'友達と一緒に通い始めたのがきっかけで...'.split('').map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.1, delay: i * 0.05 }}
                >
                  {char}
                </motion.span>
              ))}
              <motion.span 
                className="inline-block w-[2px] h-[3.5vw] bg-[#7c3aed] ml-[1vw] align-middle"
                animate={phase >= 3 ? { opacity: [0, 1, 0] } : { opacity: 0 }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            </div>
          </motion.div>

        </div>
      </motion.div>

      {/* Telop */}
      <div className="text-center w-full">
        <motion.div
          className="inline-block bg-[#6d28d9] text-white px-[4vw] py-[1vh] rounded-full text-[3vw] font-bold tracking-widest mb-[2vh]"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          STEP 03
        </motion.div>
        <motion.h2
          className="text-[6.5vw] font-black text-[#172033] leading-tight"
          initial={{ y: 20, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          15の質問で、自分だけの<br/>
          <span className="text-[#7c3aed]">「物語」</span>を
        </motion.h2>
      </div>
    </motion.div>
  );
}