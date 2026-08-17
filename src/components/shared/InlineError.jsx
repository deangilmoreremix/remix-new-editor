import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

const InlineError = ({
  message = 'Something went wrong.',
  onReset,
  resetLabel = 'Try again',
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-200">{message}</p>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {resetLabel}
        </button>
      )}
    </div>
  );
};

export default InlineError;
