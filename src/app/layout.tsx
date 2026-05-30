import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'AI Agent — Autonomous Workspace',
  description:
    'A local AI agent with 20+ tools for web search, file management, code generation, image generation, GitHub integration, and RAG retrieval over your projects.',
  keywords: ['AI Agent', 'LangChain', 'Next.js', 'TypeScript', 'Tool Calling', 'AI Assistant', 'RAG'],
  authors: [{ name: 'AI Agent Builder' }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
