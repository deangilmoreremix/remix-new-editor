import { useMemo } from 'react';
import { Download, X, RefreshCw, ImageOff, Loader2 } from 'lucide-react';

const BatchResultGrid = ({
    results = [],
    visible = false,
    loading = false,
    progress = 0,
    active = 0,
    failed = 0,
    onSelect,
    onDownload,
    onCancel,
    onClear,
    onRetry,
    title = 'Batch Results',
    emptyMessage = 'No results yet',
    gridCols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
}) => {
    const completed = results.length;
    const hasResults = results.length > 0;

    const grid = useMemo(() => {
        if (!visible) return null;
        if (loading && !hasResults) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm font-medium text-secondary">
                        Generating batch... {Math.round(progress * 100)}%
                    </p>
                    {active > 0 && (
                        <p className="text-xs text-muted">{active} generation{active !== 1 ? 's' : ''} in progress</p>
                    )}
                </div>
            );
        }

        if (!hasResults && !loading) {
            return (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <ImageOff className="w-10 h-10 text-muted" />
                    <p className="text-sm text-muted">{emptyMessage}</p>
                </div>
            );
        }

        return (
            <div className={`grid ${gridCols} gap-3`}>
                {results.map((result, index) => (
                    <div
                        key={result.id || index}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 hover:border-primary/50 hover:shadow-glow transition-all cursor-pointer"
                        onClick={() => onSelect?.(result, index)}
                    >
                        {result.url ? (
                            <img
                                src={result.url}
                                alt={result.prompt || `Batch result ${index + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <ImageOff className="w-8 h-8 text-muted" />
                            </div>
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDownload?.(result, index);
                                }}
                                className="p-2 bg-primary text-black rounded-lg hover:scale-110 transition-transform"
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            {onRetry && result.status === 'failed' && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRetry?.(result, index);
                                    }}
                                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                    title="Retry"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {result.status === 'failed' && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/80 text-white text-[10px] font-bold rounded-md">
                                Failed
                            </div>
                        )}

                        {result.status === 'processing' && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary/80 text-black text-[10px] font-bold rounded-md flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }, [visible, loading, progress, active, results, hasResults, emptyMessage, gridCols, onSelect, onDownload, onRetry]);

    if (!visible) return null;

    return (
        <div className="w-full animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <div className="flex items-center gap-2">
                    {loading && (
                        <span className="text-xs text-muted">
                            {Math.round(progress * 100)}% ({completed}/{results.length + failed})
                        </span>
                    )}
                    {onCancel && loading && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                        </button>
                    )}
                    {onClear && !loading && hasResults && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {loading && (
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </div>
            )}

            {grid}
        </div>
    );
};

export default BatchResultGrid;
