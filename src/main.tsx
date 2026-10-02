import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against third-party extension injection rejections (e.g. MetaMask in preview iframe)
if (typeof window !== 'undefined') {
  const isExtensionError = (errorOrMsg: any): boolean => {
    const str = String(
      (errorOrMsg && (errorOrMsg.message || errorOrMsg.stack || errorOrMsg)) || ''
    ).toLowerCase();
    return (
      str.includes('metamask') ||
      str.includes('failed to connect to metamask') ||
      str.includes('chrome-extension://') ||
      str.includes('moz-extension://') ||
      str.includes('ethereum') ||
      str.includes('web3')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isExtensionError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isExtensionError(event.error || event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Caught unhandled UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6 text-[#1E232A]">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-sm border border-stone-200 text-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold font-serif mb-2">Something went wrong</h2>
            <p className="text-sm text-stone-600 mb-6">
              {this.state.error?.message || 'An unexpected error occurred while loading the application.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-[#E85D43] hover:bg-[#D44E35] text-white rounded-xl font-medium text-sm transition-colors shadow-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

