// JSDoc type definitions for the Video Agent Studio integration layer.
//
// These types are intentionally JSDoc (not TypeScript) so the
// integration layer can be consumed by both the existing JS-based
// SmartVideo backend and any future TS migration. The upstream
// OpenChatCut-derived studio has its own TypeScript types in
// apps/video-agent-studio/; this module only describes the SmartVideo
// adapter surface that the studio talks to.

/**
 * @typedef {import('../services/video-agent-studio/projectRepository.js').VideoAgentProjectRepository} VideoAgentProjectRepository
 * @typedef {import('../services/video-agent-studio/mediaStore.js').VideoAgentMediaStore} VideoAgentMediaStore
 * @typedef {import('../services/video-agent-studio/generationAdapter.js').SmartVideoGenerationAdapter} SmartVideoGenerationAdapter
 * @typedef {import('../services/video-agent-studio/creditLedger.js').CreditLedger} CreditLedger
 */
export {};
