import React, { ReactNode, ErrorInfo, Component } from 'react';
import ReactDOM from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';
import './index.css';
import App from './App';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';

if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = (window as any).process.env || {};
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mb-5 shadow-xs">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900 mb-2">應用程式發生異常</h1>
          <p className="text-sm text-slate-600 mb-6 max-w-sm mx-auto leading-relaxed">
            很抱歉，處理過程中發生預期外的狀況。請重新載入頁面繼續操作。
          </p>
          <div className="bg-white p-4 rounded-xl border border-slate-200 w-full max-w-md mb-6 shadow-xs">
            <p className="text-xs text-slate-500 font-mono break-all text-left">
              {this.state.error?.message || 'Unknown Error'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            重新載入頁面
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Critical: Root element not found');
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ToastProvider>
            <ConfirmDialogProvider>
              <App />
            </ConfirmDialogProvider>
          </ToastProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err: any) {
    const errorOverlay = document.getElementById('error-overlay');
    const errorMsg = document.getElementById('error-msg');
    if (errorOverlay && errorMsg) {
      errorOverlay.style.display = 'flex';
      errorMsg.innerText = 'React Mount Error: ' + err.message;
    }
  }
}