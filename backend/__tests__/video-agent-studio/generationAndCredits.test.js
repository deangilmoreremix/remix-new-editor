import { describe, it, expect } from '@jest/globals';
import { InMemorySmartVideoGenerationAdapter, isSupportedCapability, SUPPORTED_CAPABILITIES } from '../../services/video-agent-studio/generationAdapter.js';
import { InMemoryCreditLedger, requiresApproval } from '../../services/video-agent-studio/creditLedger.js';

describe('SmartVideoGenerationAdapter', () => {
  it('rejects unsupported capabilities', async () => {
    const a = new InMemorySmartVideoGenerationAdapter();
    expect(isSupportedCapability('video.generate')).toBe(true);
    expect(isSupportedCapability('totally.fake')).toBe(false);
    await expect(
      a.estimate('user-1', { capability: 'totally.fake', inputs: {} }),
    ).rejects.toThrow();
  });

  it('estimates and submits a job with reservation', async () => {
    const a = new InMemorySmartVideoGenerationAdapter();
    const est = await a.estimate('user-1', {
      capability: 'video.generate',
      inputs: { prompt: 'a cat' },
      target: { projectId: 'p1' },
    });
    expect(est.creditsEstimated).toBeGreaterThanOrEqual(0);
    const job = await a.submit('user-1', {
      capability: 'video.generate',
      inputs: { prompt: 'a cat' },
      target: { projectId: 'p1' },
    }, { creditsReserved: est.creditsEstimated });
    expect(job.status).toBe('queued');
    expect(job.userId).toBe('user-1');
    const fetched = await a.getJob('user-1', job.jobId);
    expect(fetched?.jobId).toBe(job.jobId);
    expect(await a.getJob('user-2', job.jobId)).toBeNull();
  });

  it('refuses a job whose reservation is missing or negative', async () => {
    const a = new InMemorySmartVideoGenerationAdapter();
    await expect(
      a.submit('user-1', { capability: 'video.generate', inputs: {} }, { creditsReserved: -1 }),
    ).rejects.toThrow();
  });

  it('cancellation flips status to cancelled', async () => {
    const a = new InMemorySmartVideoGenerationAdapter();
    const est = await a.estimate('user-1', { capability: 'audio.tts', inputs: {} });
    const job = await a.submit('user-1', { capability: 'audio.tts', inputs: {} }, { creditsReserved: est.creditsEstimated });
    await a.cancel('user-1', job.jobId);
    const after = await a.getJob('user-1', job.jobId);
    expect(after?.status).toBe('cancelled');
  });
});

describe('CreditLedger', () => {
  it('refuses to reserve more than the available balance', async () => {
    const l = new InMemoryCreditLedger();
    l.balances.set('user-1', 10);
    await expect(l.reserve('user-1', 'job-1', 11)).rejects.toThrow();
  });

  it('reserve -> release returns credits', async () => {
    const l = new InMemoryCreditLedger();
    l.balances.set('user-1', 10);
    const r = await l.reserve('user-1', 'job-1', 4);
    expect(await l.getBalance('user-1')).toBe(6);
    await l.release('user-1', r.reservationId);
    expect(await l.getBalance('user-1')).toBe(10);
  });

  it('reserve -> finalise does not return credits', async () => {
    const l = new InMemoryCreditLedger();
    l.balances.set('user-1', 10);
    const r = await l.reserve('user-1', 'job-1', 4);
    await l.finalise('user-1', r.reservationId);
    expect(await l.getBalance('user-1')).toBe(6);
  });

  it('requiresApproval follows BALANCED / MANUAL / AUTO rules', () => {
    expect(requiresApproval({ mode: 'MANUAL' }, 1)).toBe(true);
    expect(requiresApproval({ mode: 'BALANCED' }, 1)).toBe(false);
    expect(requiresApproval({ mode: 'BALANCED' }, 100)).toBe(true);
    expect(requiresApproval({ mode: 'AUTO' }, 1000)).toBe(false);
    expect(requiresApproval({ mode: 'AUTO', autoApproveThresholdCredits: 5 }, 10)).toBe(true);
  });
});
