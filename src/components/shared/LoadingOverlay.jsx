import { Loader2, X } from 'lucide-react';

const SkeletonCard = () => (
  <div className="flex flex-col gap-3">
    <div className="aspect-video rounded-xl bg-white/5 animate-pulse" />
    <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
    <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
  </div>
);

const LoadingOverlay = ({
  visible = false,
  message = 'Processing...',
  progress,
  onCancel,
  skeleton = false,
  skeletonCount = 4,
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-white/10 bg-card-bg shadow-3xl">
        {skeleton ? (
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              {progress !== undefined && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                  {Math.round(progress)}%
                </span>
              )}
            </div>
            {message && (
              <p className="text-sm font-medium text-secondary text-center max-w-xs">
                {message}
              </p>
            )}
          </>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
