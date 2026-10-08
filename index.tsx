import React, { ReactNode, ErrorInfo, Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/ToastProvider';

// 環境變數墊片 (Shim)：確保瀏覽器端能讀取 process.env.GEMINI_API_KEY
// AI Studio 會在運行時注入此變數
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
  // Define state as a class property to fix TS error "Property 'state' does not exist"
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
            <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-red-100">
                <i className="fa-solid fa-bug text-3xl"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">應用程式發生錯誤</h1>
            <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto leading-relaxed">
               很抱歉，處理過程中發生了預期外的狀況。請嘗試重新載入頁面。
            </p>
            <div className="bg-white p-4 rounded-xl border border-slate-200 w-full max-w-sm mb-6 shadow-sm">
                <p className="text-[10px] text-slate-400 font-mono break-all text-left">
                    {this.state.error?.message || "Unknown Error"}
                </p>
            </div>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform">
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
  console.error("Critical: Root element not found");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err: any) {
    const errorOverlay = document.getElementById('error-overlay');
    const errorMsg = document.getElementById('error-msg');
    if (errorOverlay && errorMsg) {
      errorOverlay.style.display = 'flex';
      errorMsg.innerText = "React Mount Error: " + err.message;
    }
  }
}