import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  handleReset = () => {
    this.setState({ error: null, info: null });
  };
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="p-6 m-4 rounded-2xl border border-red-500/30 bg-red-500/10">
          <h2 className="text-lg font-bold text-red-300 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-200 mb-4">{String(this.state.error?.message || this.state.error)}</p>
          <button onClick={this.handleReset} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
