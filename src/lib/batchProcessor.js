/**
 * Batch Processing Framework
 * Provides concurrent batch processing with progress tracking and cancellation.
 */

export function createBatchProcessor(options = {}) {
    const {
        concurrency = 2,
        onItemComplete = () => {},
        onItemError = () => {},
        onBatchComplete = () => {},
        onBatchError = () => {},
    } = options;

    const listeners = new Set();
    let queue = [];
    let active = 0;
    let cancelled = false;
    let completed = 0;
    let failed = 0;
    let total = 0;
    let processing = false;
    let startTime = null;
    let concurrencyValue = concurrency;

    function notify(state) {
        listeners.forEach((fn) => fn(state));
    }

    function getState() {
        return {
            queue: queue.map((item) => ({ ...item })),
            active,
            cancelled,
            completed,
            failed,
            total,
            processing,
            progress: total > 0 ? (completed + failed) / total : 0,
            startTime,
        };
    }

    function subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }

    function cancel() {
        cancelled = true;
        notify(getState());
    }

    function reset() {
        queue = [];
        active = 0;
        cancelled = false;
        completed = 0;
        failed = 0;
        total = 0;
        processing = false;
        startTime = null;
        notify(getState());
    }

    async function runProcessor(item, processorFn) {
        if (cancelled) {
            throw new Error('Batch cancelled');
        }
        return processorFn(item);
    }

    async function start(processorFn) {
        if (processing) {
            throw new Error('Batch already processing');
        }

        processing = true;
        cancelled = false;
        completed = 0;
        failed = 0;
        total = queue.length;
        startTime = Date.now();
        notify(getState());

        const results = [];

        try {
            while (queue.length > 0 || active > 0) {
                if (cancelled) {
                    break;
                }

                const availableSlots = Math.max(0, concurrencyValue - active);
                const batch = queue.splice(0, availableSlots);

                if (batch.length === 0 && active === 0) {
                    break;
                }

                active += batch.length;
                notify(getState());

                const promises = batch.map((item) =>
                    runProcessor(item, processorFn)
                        .then((result) => {
                            completed++;
                            onItemComplete(item, result, getState());
                            notify(getState());
                            if (result !== null && result !== undefined) {
                                results.push(result);
                            }
                            return result;
                        })
                        .catch((error) => {
                            failed++;
                            onItemError(item, error, getState());
                            notify(getState());
                            return null;
                        })
                        .finally(() => {
                            active = Math.max(0, active - 1);
                            notify(getState());
                        })
                );

                await Promise.all(promises);
            }

            if (!cancelled) {
                onBatchComplete(results, getState());
            } else {
                onBatchError(new Error('Batch cancelled'), getState());
            }

            notify(getState());
            return results;
        } catch (error) {
            onBatchError(error, getState());
            notify(getState());
            throw error;
        } finally {
            processing = false;
            notify(getState());
        }
    }

    return {
        getState,
        subscribe,
        cancel,
        reset,
        start,
        addItem: (item) => {
            queue.push(item);
            total = queue.length;
            notify(getState());
        },
        addItems: (items) => {
            queue.push(...items);
            total = queue.length;
            notify(getState());
        },
        setConcurrency: (value) => {
            concurrencyValue = Math.max(1, value);
            notify(getState());
        },
    };
}

export async function processBatch(items, processorFn, options = {}) {
    const {
        concurrency = 2,
        onItemComplete = () => {},
        onItemError = () => {},
        onBatchComplete = () => {},
        onBatchError = () => {},
    } = options;

    const processor = createBatchProcessor({
        concurrency,
        onItemComplete,
        onItemError,
        onBatchComplete,
        onBatchError,
    });

    processor.addItems(items);
    const results = await processor.start(processorFn);
    return results;
}

export function createBatchQueue() {
    let queue = [];
    const listeners = new Set();

    function notify() {
        listeners.forEach((fn) => fn(queue));
    }

    return {
        getItems() {
            return [...queue];
        },
        add(item) {
            queue.push({ ...item, id: item.id || crypto.randomUUID() });
            notify();
        },
        addItems(items) {
            queue.push(...items.map((item) => ({ ...item, id: item.id || crypto.randomUUID() })));
            notify();
        },
        remove(id) {
            queue = queue.filter((item) => item.id !== id);
            notify();
        },
        clear() {
            queue = [];
            notify();
        },
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        get length() {
            return queue.length;
        },
    };
}

export default {
    createBatchProcessor,
    processBatch,
    createBatchQueue,
};
