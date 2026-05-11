'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.name}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center h-full min-h-[120px] p-6"
          style={{
            background: 'var(--ds-bg-primary)',
            color: 'var(--ds-text-secondary)',
          }}
        >
          <div
            className="flex flex-col items-center gap-3 text-center max-w-xs"
          >
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.2)',
              }}
            >
              <span className="text-lg" style={{ color: 'var(--ds-error)' }}>
                !
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--ds-text-primary)' }}>
                Something went wrong in {this.props.name}
              </p>
              <p className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="gap-1.5 text-xs rounded-lg"
              style={{
                color: 'var(--ds-accent)',
                border: '1px solid rgba(37,99,235,0.3)',
                background: 'var(--ds-accent-glow)',
              }}
            >
              <RotateCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
