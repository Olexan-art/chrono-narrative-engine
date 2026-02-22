import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isChunkError: boolean;
}

/** Detect stale JS chunk errors that happen after a new deploy */
function isChunkLoadError(error: Error): boolean {
  const msg = error?.message || '';
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically') ||
    msg.includes('error loading dynamically') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const chunkError = isChunkLoadError(error);
    if (chunkError) {
      // Auto-reload immediately (once per 10s to avoid infinite loop)
      const lastReload = Number(sessionStorage.getItem('chunkReloadAt') || '0');
      if (Date.now() - lastReload > 10_000) {
        sessionStorage.setItem('chunkReloadAt', String(Date.now()));
        window.location.reload();
      }
    }
    return { hasError: true, error, isChunkError: chunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // For chunk errors show a lightweight "updating" screen while reload fires
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-xl font-bold text-foreground">Оновлення...</p>
            <p className="text-muted-foreground text-sm">
              Сторінка оновлюється після нового деплою.
            </p>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-2xl font-bold text-foreground">Щось пішло не так</p>
          <p className="text-muted-foreground text-sm max-w-md">
            Something went wrong while rendering this page.
          </p>
          <button
            className="px-4 py-2 border border-border rounded text-sm hover:bg-muted transition-colors"
            onClick={() => {
              this.setState({ hasError: false, error: undefined, isChunkError: false });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
