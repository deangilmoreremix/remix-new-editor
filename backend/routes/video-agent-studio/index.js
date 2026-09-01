// Video Agent Studio — HTTP surface (Express).
//
// Phase 4 + 8 + 10 + 12 + 20. The OpenChatCut-derived studio (running
// as an iframe in the SmartVideo app) calls these endpoints instead of
// writing directly to its own local-first storage. All endpoints:
//
//   - require a verified SmartVideo user id (from Clerk)
//   - scope every query to that user
//   - return JSON
//   - never echo provider keys or session tokens back to the browser
//   - never accept an arbitrary userId from the body
//
// The router is constructed by `createVideoAgentStudioRouter` so it
// can be tested with the in-memory repositories in isolation, and
// mounted in production with the real Postgres / Supabase / R2
// implementations.

import { Router } from 'express';
import { VIDEO_AGENT_EVENT_TYPES } from '../services/video-agent-studio/eventBus.js';
import { isSupportedCapability } from '../services/video-agent-studio/generationAdapter.js';
import {
  isAllowedUploadMime,
  MAX_UPLOAD_BYTES,
} from '../services/video-agent-studio/mediaStore.js';
import { requiresApproval } from '../services/video-agent-studio/creditLedger.js';

/**
 * @param {{
 *   projectRepository: import('../services/video-agent-studio/projectRepository.js').VideoAgentProjectRepository,
 *   mediaStore: import('../services/video-agent-studio/mediaStore.js').VideoAgentMediaStore,
 *   generationAdapter: import('../services/video-agent-studio/generationAdapter.js').SmartVideoGenerationAdapter,
 *   creditLedger: import('../services/video-agent-studio/creditLedger.js').CreditLedger,
 *   eventBus: import('../services/video-agent-studio/eventBus.js').InMemoryVideoAgentEventBus,
 *   getApprovalMode: (userId:string) => Promise<{mode:'AUTO'|'BALANCED'|'MANUAL', autoApproveThresholdCredits?:number}>,
 *   requireUser: (req:any) => Promise<{id:string}>,
 * }} deps
 */
export function createVideoAgentStudioRouter(deps) {
  const router = Router();

  // ---- Projects ----
  router.post('/projects', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const project = await deps.projectRepository.createProject(user.id, {
        name: req.body?.name,
        initialProjectDoc: req.body?.initialProjectDoc,
      });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  router.get('/projects', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const result = await deps.projectRepository.listProjects(user.id, {
        limit: Number(req.query?.limit) || 25,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/projects/:projectId', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const project = await deps.projectRepository.getProject(
        user.id,
        req.params.projectId,
      );
      if (!project) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  router.put('/projects/:projectId', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const project = await deps.projectRepository.saveProject(user.id, {
        projectId: req.params.projectId,
        projectDoc: req.body?.projectDoc || {},
        note: req.body?.note,
      });
      deps.eventBus.publish({
        id: crypto.randomUUID(),
        type: VIDEO_AGENT_EVENT_TYPES.TIMELINE_CHANGED,
        userId: user.id,
        projectId: project.id,
        createdAt: new Date().toISOString(),
        data: { revision: project.revision },
      });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/projects/:projectId', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      await deps.projectRepository.deleteProject(user.id, req.params.projectId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/projects/:projectId/versions', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const versions = await deps.projectRepository.listVersions(
        user.id,
        req.params.projectId,
        { limit: Number(req.query?.limit) || 50 },
      );
      res.json({ versions });
    } catch (err) {
      next(err);
    }
  });

  // ---- Media ----
  router.post('/projects/:projectId/assets', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      if (!isAllowedUploadMime(req.body?.mimeType)) {
        res.status(400).json({ error: 'mime_not_allowed' });
        return;
      }
      if (Number(req.body?.byteSize) > MAX_UPLOAD_BYTES) {
        res.status(413).json({ error: 'upload_too_large' });
        return;
      }
      const { asset, readUrl } = await deps.mediaStore.putAsset(
        user.id,
        req.params.projectId,
        {
          filename: req.body.filename,
          mimeType: req.body.mimeType,
          byteSize: req.body.byteSize,
          data: req.body.data,
        },
      );
      deps.eventBus.publish({
        id: crypto.randomUUID(),
        type: VIDEO_AGENT_EVENT_TYPES.ASSET_CREATED,
        userId: user.id,
        projectId: req.params.projectId,
        createdAt: new Date().toISOString(),
        data: { assetId: asset.id },
      });
      res.status(201).json({ asset, readUrl });
    } catch (err) {
      next(err);
    }
  });

  router.get('/projects/:projectId/assets', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const assets = await deps.mediaStore.listAssets(
        user.id,
        req.params.projectId,
      );
      res.json({ assets });
    } catch (err) {
      next(err);
    }
  });

  router.get('/assets/:assetId/url', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const url = await deps.mediaStore.getReadUrl(user.id, req.params.assetId);
      if (!url) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ url });
    } catch (err) {
      next(err);
    }
  });

  // ---- Generation (estimate / submit / status) ----
  router.post('/generation/estimate', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      if (!isSupportedCapability(req.body?.capability)) {
        res.status(400).json({ error: 'unsupported_capability' });
        return;
      }
      const estimate = await deps.generationAdapter.estimate(user.id, {
        capability: req.body.capability,
        inputs: req.body.inputs || {},
        target: req.body.target,
        preferredModelId: req.body.preferredModelId,
        preferredProvider: req.body.preferredProvider,
      });
      res.json({ estimate });
    } catch (err) {
      next(err);
    }
  });

  router.post('/generation/submit', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      if (!isSupportedCapability(req.body?.capability)) {
        res.status(400).json({ error: 'unsupported_capability' });
        return;
      }
      const estimate = await deps.generationAdapter.estimate(user.id, {
        capability: req.body.capability,
        inputs: req.body.inputs || {},
        target: req.body.target,
        preferredModelId: req.body.preferredModelId,
        preferredProvider: req.body.preferredProvider,
      });
      const approvalMode = await deps.getApprovalMode(user.id);
      if (
        requiresApproval(approvalMode, estimate.creditsEstimated) &&
        !req.body?.approvalToken
      ) {
        res.status(202).json({
          status: 'awaiting_approval',
          estimate,
          approvalMode,
        });
        return;
      }
      const job = await deps.generationAdapter.submit(
        user.id,
        {
          capability: req.body.capability,
          inputs: req.body.inputs || {},
          target: req.body.target,
          preferredModelId: req.body.preferredModelId,
          preferredProvider: req.body.preferredProvider,
        },
        { creditsReserved: estimate.creditsEstimated },
      );
      // Reserve credits (would also persist to DB in production).
      try {
        await deps.creditLedger.reserve(
          user.id,
          job.jobId,
          estimate.creditsEstimated,
        );
      } catch (e) {
        await deps.generationAdapter.cancel(user.id, job.jobId);
        res.status(402).json({ error: 'insufficient_credits' });
        return;
      }
      deps.eventBus.publish({
        id: crypto.randomUUID(),
        type: VIDEO_AGENT_EVENT_TYPES.GENERATION_QUEUED,
        userId: user.id,
        projectId: job.projectId,
        jobId: job.jobId,
        createdAt: new Date().toISOString(),
        data: { capability: req.body.capability },
      });
      res.status(202).json({ job, estimate });
    } catch (err) {
      next(err);
    }
  });

  router.get('/generation/jobs/:jobId', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      const job = await deps.generationAdapter.getJob(user.id, req.params.jobId);
      if (!job) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ job });
    } catch (err) {
      next(err);
    }
  });

  router.post('/generation/jobs/:jobId/cancel', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      await deps.generationAdapter.cancel(user.id, req.params.jobId);
      res.json({ status: 'cancelled' });
    } catch (err) {
      next(err);
    }
  });

  // ---- SSE event stream ----
  router.get('/events', async (req, res, next) => {
    try {
      const user = await deps.requireUser(req);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const send = (event) => {
        res.write(`id: ${event.id}\n`);
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };
      const unsubscribe = deps.eventBus.subscribe(user.id, send);
      // Keep-alive comment every 25s so proxies don't close the stream.
      const keepAlive = setInterval(() => res.write(`: keep-alive\n\n`), 25_000);
      req.on('close', () => {
        clearInterval(keepAlive);
        unsubscribe();
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
