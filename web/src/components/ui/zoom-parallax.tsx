'use client';

import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

export interface ParallaxCard {
  badge: string;
  title: string;
  description: string;
  bgClass: string;
  textClass: string;
  badgeBg?: string;
}

interface ZoomParallaxProps {
  /** Array of cards to be displayed in the parallax effect max 7 items */
  cards: ParallaxCard[];
}

export function ZoomParallax({ cards = [] }: ZoomParallaxProps) {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  });

  const scale4 = useTransform(scrollYProgress, [0, 1], [1, 4]);
  const scale5 = useTransform(scrollYProgress, [0, 1], [1, 5]);
  const scale6 = useTransform(scrollYProgress, [0, 1], [1, 6]);
  const scale8 = useTransform(scrollYProgress, [0, 1], [1, 8]);
  const scale9 = useTransform(scrollYProgress, [0, 1], [1, 9]);

  const scales = [scale4, scale5, scale6, scale5, scale6, scale8, scale9];

  return (
    <div ref={container} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#EBE0BA]">
        {cards.map((card, index) => {
          const scale = scales[index % scales.length];

          return (
            <motion.div
              key={index}
              style={{ scale }}
              className={`absolute top-0 flex h-full w-full items-center justify-center ${
                index === 1 ? '[&>div]:!-top-[30vh] [&>div]:!left-[5vw] [&>div]:!h-[28vh] [&>div]:!w-[32vw]' : ''
              } ${
                index === 2 ? '[&>div]:!-top-[12vh] [&>div]:!-left-[26vw] [&>div]:!h-[38vh] [&>div]:!w-[22vw]' : ''
              } ${
                index === 3 ? '[&>div]:!left-[28vw] [&>div]:!h-[26vh] [&>div]:!w-[26vw]' : ''
              } ${
                index === 4 ? '[&>div]:!top-[28vh] [&>div]:!left-[5vw] [&>div]:!h-[24vh] [&>div]:!w-[22vw]' : ''
              } ${
                index === 5 ? '[&>div]:!top-[28vh] [&>div]:!-left-[24vw] [&>div]:!h-[26vh] [&>div]:!w-[28vw]' : ''
              } ${
                index === 6 ? '[&>div]:!top-[24vh] [&>div]:!left-[27vw] [&>div]:!h-[18vh] [&>div]:!w-[18vw]' : ''
              }`}
            >
              <div
                className={`relative h-[26vh] w-[26vw] rounded-3xl p-4 sm:p-6 flex flex-col justify-center shadow-2xl border border-white/20 overflow-hidden transition-all ${card.bgClass} ${card.textClass}`}
              >
                <div className="mb-2 sm:mb-3">
                  <span
                    className={`text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10 inline-block ${
                      card.badgeBg || 'bg-black/20 text-white'
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>
                <h3 className="text-base sm:text-xl md:text-2xl font-black tracking-tight leading-tight mb-1.5 sm:mb-2">
                  {card.title}
                </h3>
                <p className="text-[10px] sm:text-xs md:text-sm leading-relaxed opacity-90 line-clamp-3">
                  {card.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
