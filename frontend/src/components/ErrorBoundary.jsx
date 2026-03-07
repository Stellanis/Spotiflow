import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-spotify-dark text-white flex flex-col items-center justify-center p-4">
                    <div className="bg-spotify-light border border-white/10 rounded-xl p-8 max-w-2xl w-full text-center shadow-2xl">
                        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                        <h1 className="text-3xl font-bold mb-4">Oops! Something went wrong.</h1>
                        <p className="text-spotify-grey mb-8">
                            An unexpected error occurred in the application. You can try refreshing the page to fix this issue.
                        </p>

                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-spotify-green hover:bg-green-500 text-white font-medium rounded-full transition-colors inline-flex items-center gap-2 mb-8"
                        >
                            <RefreshCcw className="w-5 h-5" />
                            Refresh Application
                        </button>

                        {this.state.error && (
                            <div className="bg-black/50 p-4 rounded-lg text-left overflow-x-auto max-h-64 custom-scrollbar">
                                <p className="text-red-400 font-mono text-sm mb-2">{this.state.error.toString()}</p>
                                <pre className="text-xs text-spotify-grey font-mono whitespace-pre-wrap">
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
