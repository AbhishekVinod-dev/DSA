'use client';
import { useTransform, motion, useScroll, MotionValue } from 'motion/react';
import { useRef, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ProjectData {
  title: string;
  description: string;
  color: string;
  /** Optional stock image. When omitted a JSX `visual` is rendered instead. */
  link?: string;
  visual?: ReactNode;
  /** Small label rendered above the title, e.g. "Step 01" or "FR-05". */
  tag?: string;
  /** Optional footnote line under the description. */
  footnote?: string;
}

interface CardProps {
  i: number;
  title: string;
  description: string;
  url?: string;
  visual?: ReactNode;
  color: string;
  tag?: string;
  footnote?: string;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}

export const Card = ({
  i,
  title,
  description,
  url,
  visual,
  color,
  tag,
  footnote,
  progress,
  range,
  targetScale,
}: CardProps) => {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'start start'],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1]);
  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      ref={container}
      className='h-screen flex items-center justify-center sticky top-0'
    >
      <motion.div
        style={{
          backgroundColor: color,
          scale,
          top: `calc(-5vh + ${i * 25}px)`,
        }}
        className={`flex flex-col sm:flex-row relative -top-[15%] sm:-top-[25%] h-auto sm:h-[450px] w-[90%] sm:w-[75%] rounded-2xl p-6 sm:p-10 origin-top shadow-2xl border border-white/10 text-white`}
      >
        <div className={`flex flex-col sm:flex-row h-full w-full gap-6 sm:gap-10`}>
          <div className={`w-full sm:w-[45%] flex flex-col justify-between`}>
            <div>
              <span className="text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-black/20 mb-3 inline-block">
                {tag ?? `Step 0${i + 1}`}
              </span>
              <h2 className='text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-left'>{title}</h2>
              <p className='text-sm sm:text-base leading-relaxed text-white/90'>{description}</p>
              {footnote && (
                <p className='mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/60'>{footnote}</p>
              )}
            </div>
            <span className='flex items-center gap-2 pt-4 mt-auto'>
              <a
                href={'/auth'}
                className='underline font-semibold cursor-pointer text-sm hover:text-white/80'
              >
                Open the console
              </a>
              <svg
                width='22'
                height='12'
                viewBox='0 0 22 12'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                className="fill-white"
              >
                <path
                  d='M21.5303 6.53033C21.8232 6.23744 21.8232 5.76256 21.5303 5.46967L16.7574 0.696699C16.4645 0.403806 15.9896 0.403806 15.6967 0.696699C15.4038 0.989592 15.4038 1.46447 15.6967 1.75736L19.9393 6L15.6967 10.2426C15.4038 10.5355 15.4038 11.0104 15.6967 11.3033C15.9896 11.5962 16.4645 11.5962 16.7574 11.3033L21.5303 6.53033ZM0 6.75L21 6.75V5.25L0 5.25L0 6.75Z'
                />
              </svg>
            </span>
          </div>

          <div
            className={`relative w-full sm:w-[55%] h-[220px] sm:h-full rounded-xl overflow-hidden shadow-inner border border-white/10`}
          >
            {url ? (
              <motion.div className={`w-full h-full`} style={{ scale: imageScale }}>
                <img src={url} alt={title} className='absolute inset-0 w-full h-full object-cover' />
              </motion.div>
            ) : (
              <div className={cn('h-full w-full')}>{visual}</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface ComponentRootProps {
  projects: ProjectData[];
}

const Component = forwardRef<HTMLElement, ComponentRootProps>(({ projects }, ref) => {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  });

  return (
    <div ref={container} className="relative">
      {projects.map((project, i) => {
        const targetScale = 1 - (projects.length - i) * 0.05;
        return (
          <Card
            key={`p_${i}`}
            i={i}
            url={project.link}
            visual={project.visual}
            tag={project.tag}
            footnote={project.footnote}
            title={project.title}
            color={project.color}
            description={project.description}
            progress={scrollYProgress}
            range={[i * 0.25, 1]}
            targetScale={targetScale}
          />
        );
      })}
    </div>
  );
});

Component.displayName = 'Component';

export default Component;
