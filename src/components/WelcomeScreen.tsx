'use client';

import { motion } from 'framer-motion';
import { Hexagon, Zap, BookOpen, Bug, FolderTree, Globe, Image as ImageIcon } from 'lucide-react';

interface WelcomeScreenProps {
  onSendExample: (message: string) => void;
}

const examples: Array<{
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tint: string;
  title: string;
  description: string;
  message: string;
}> = [
  {
    icon: BookOpen,
    tint: '#4f46e5',
    title: 'Research a topic',
    description: 'Search the web and summarize findings on any subject',
    message: 'Search the web for the latest trends in AI agent frameworks in 2026 and give me a concise summary with sources.',
  },
  {
    icon: Bug,
    tint: '#e11d48',
    title: 'Debug my code',
    description: 'Diagnose a bug and propose a working fix',
    message: 'I have a React component that re-renders infinitely. It uses useEffect to fetch data. Walk me through what causes infinite loops in useEffect and how to fix it.',
  },
  {
    icon: FolderTree,
    tint: '#10b981',
    title: 'Analyze a project',
    description: 'Upload a ZIP and get architectural insights',
    message: 'Once I attach a project, analyze its structure and suggest improvements for organization, performance, and best practices.',
  },
  {
    icon: ImageIcon,
    tint: '#a855f7',
    title: 'Generate an image',
    description: 'Create an illustration from a text description',
    message: 'Generate a minimalist hero illustration of a hexagonal AI brain glowing in indigo, on a dark background.',
  },
  {
    icon: Globe,
    tint: '#06b6d4',
    title: 'Scrape a webpage',
    description: 'Extract structured data from any URL',
    message: 'Open https://news.ycombinator.com and list the top 10 headlines with their score and comment count.',
  },
  {
    icon: Zap,
    tint: '#f59e0b',
    title: 'Quick question',
    description: 'Just ask — no planning, instant reply',
    message: 'What is the difference between React.memo and useMemo? Give me a short, practical answer.',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.1 + i * 0.05 },
  }),
};

export function WelcomeScreen({ onSendExample }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-7 max-w-3xl w-full"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="relative"
        >
          <div
            className="flex items-center justify-center w-20 h-20 rounded-2xl animate-accent-glow"
            style={{
              background: 'var(--ds-gradient-accent)',
              boxShadow: '0 12px 32px -8px var(--ds-accent-glow-strong)',
            }}
          >
            <Hexagon className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
        </motion.div>

        <div className="text-center space-y-2.5">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: 'var(--ds-text-primary)' }}
          >
            <span className="gradient-text">Build anything</span>, faster.
          </h1>
          <p className="text-base max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--ds-text-secondary)' }}>
            An autonomous AI agent that writes code, researches the web, generates
            images, manages files, and talks to GitHub — all in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full mt-2">
          {examples.map((example, index) => {
            const Icon = example.icon;
            return (
              <motion.button
                key={index}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSendExample(example.message)}
                className="flex items-start gap-3 p-3.5 rounded-xl text-left group transition-smooth surface-elevated"
                style={{
                  background: 'var(--ds-bg-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = example.tint;
                  e.currentTarget.style.boxShadow = `0 8px 20px -8px ${example.tint}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ds-border)';
                  e.currentTarget.style.boxShadow = 'var(--ds-shadow-sm)';
                }}
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-smooth"
                  style={{
                    background: `${example.tint}1A`,
                    color: example.tint,
                  }}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: 'var(--ds-text-primary)' }}
                  >
                    {example.title}
                  </div>
                  <div
                    className="text-xs mt-0.5 line-clamp-2 leading-snug"
                    style={{ color: 'var(--ds-text-secondary)' }}
                  >
                    {example.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div
          className="text-[11px] text-center mt-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'var(--ds-bg-secondary)',
            border: '1px solid var(--ds-border)',
            color: 'var(--ds-text-muted)',
          }}
        >
          Tip: drop files into the input, paste images, or just say hi 👋
        </div>
      </motion.div>
    </div>
  );
}
