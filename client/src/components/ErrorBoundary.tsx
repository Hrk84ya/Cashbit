import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary caught:', error, info.componentStack); }
  handleRetry = () => { this.setState({ hasError: false, error: null }); };
  handleReload = () => { window.location.reload(); };

  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">{this.state.error?.message || 'An unexpected error occurred.'}</p>
        <div className="flex gap-3">
          <button onClick={this.handleRetry} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"><RotateCcw className="h-4 w-4" /> Try again</button>
          <button onClick={this.handleReload} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md border hover:bg-muted"><RefreshCw className="h-4 w-4" /> Reload page</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
