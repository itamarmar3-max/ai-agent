'use client';

import { motion } from 'framer-motion';
import { Bot, Code, Image, Globe, Hexagon } from 'lucide-react';

interface WelcomeScreenProps {
  onSendExample: (message: string) => void;
}

const examples = [
  {
    icon: '🤖',
    title: 'Build Android App',
    description: 'Create a complete Android app with Kotlin and Jetpack Compose',
    message: 'Build an Android task management app with Kotlin, MVVM architecture, and Jetpack Compose. Include a dashboard, task list with swipe actions, and a settings screen.',
  },
  {
    icon: '🔬',
    title: 'Research a Topic',
    description: 'Search the web and summarize findings on any subject',
    message: 'Search the web for the latest trends in AI agent frameworks in 2025 and summarize the key findings.',
  },
  {
    icon: '🐛',
    title: 'Debug My Code',
    description: 'Find and fix bugs in your codebase with detailed analysis',
    message: 'Help me debug a React component that re-renders infinitely. The component uses useEffect with a missing dependency array and fetches data from an API.',
  },
  {
    icon: '📁',
    title: 'Analyze My Project',
    description: 'Scan your project files and provide architectural insights',
    message: 'Analyze the current project structure and suggest improvements for code organization, performance optimization, and best practices.',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.15 + i * 0.08 },
  }),
};

export function WelcomeScreen({ onSendExample }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 max-w-2xl w-full"
      >
        {/* Logo - Hexagon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-center w-16 h-16 rounded-2xl"
          style={{
            background: 'var(--ds-accent-glow)',
            border: '1px solid rgba(37,99,235,0.2)',
          }}
        >
          <Hexagon className="w-8 h-8" style={{ color: 'var(--ds-accent)' }} />
        </motion.div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--ds-text-primary)' }}
          >
            What can I help you build?
          </h1>
          <p className="text-base max-w-md mx-auto" style={{ color: 'var(--ds-text-secondary)' }}>
            An autonomous AI agent that can write code, search the web, generate
            images, and manage files.
          </p>
        </div>

        {/* Examples grid - 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
          {examples.map((example, index) => (
            <motion.button
              key={index}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSendExample(example.message)}
              className="flex items-start gap-3 p-4 rounded-xl text-left group transition-smooth"
              style={{
                background: 'var(--ds-bg-secondary)',
                border: '1px solid var(--ds-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)';
                e.currentTarget.style.background = 'var(--ds-bg-tertiary)';
                e.currentTarget.style.boxShadow = '0 0 20px var(--ds-accent-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--ds-border)';
                e.currentTarget.style.background = 'var(--ds-bg-secondary)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span className="text-2xl mt-0.5 shrink-0">{example.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium" style={{ color: 'var(--ds-text-primary)' }}>
                  {example.title}
                </div>
                <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--ds-text-secondary)' }}>
                  {example.description}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
