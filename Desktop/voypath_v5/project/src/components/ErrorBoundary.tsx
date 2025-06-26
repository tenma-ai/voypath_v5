import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-glass">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Something went wrong
            </h2>
            
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              An unexpected error occurred. Don't worry, we can try to fix this.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-2xl hover:from-primary-600 hover:to-secondary-700 transition-all duration-300 font-semibold"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 font-semibold"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs">
                  <div className="text-red-600 dark:text-red-400 font-mono">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  <pre className="mt-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="mt-2 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}