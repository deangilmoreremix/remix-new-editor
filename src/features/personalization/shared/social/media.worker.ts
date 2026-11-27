/// <reference lib="webworker" />
/**
 * Image preparation off the main thread (reframe / resize / compress with OffscreenCanvas). One job per message; the page stops a job
 * by terminating the worker. The logic lives in imageOps.ts so it is shared with the main-thread fallback and unit-tested.
 */
import { handleWorkerRequest, type WorkerRequest } from './imageOps'

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const reply = await handleWorkerRequest(e.data)
  ;(self as unknown as Worker).postMessage(reply)
}
