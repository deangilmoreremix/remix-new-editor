# SmartVideo / OpenThorn — Comprehensive Test Plan

**Version:** 1.0  
**Date:** 2026-08-28  
**Owner:** QA / Engineering  
**Status:** Draft — Ready for Review  

---

## 1. Test Strategy

### 1.1 Objectives
- Validate the AI website builder agent loop from prompt to deployed Cloudflare Pages site.
- Validate all 30+ studios render, generate, and persist data correctly.
- Verify shared Clerk/Supabase auth, BYO-Keys provider security, and admin RLS boundaries.
- Confirm Supabase persistence, RLS policies, and fallback behavior under failure.
- Ensure API endpoints enforce auth, CSRF, rate limits, and encryption.
- Validate error boundaries, performance budgets, and accessibility.

### 1.2 Scope
- **In scope:** Client React app, Vercel serverless functions, Express backend, Supabase database/migrations, Cloudflare Pages deploy flow.
- **Out of scope:** Third-party AI provider uptime (test with mocks), Cloudflare Pages infrastructure (verify via deploy API only).

### 1.3 Test Pyramid
```
         /\
        /E2E\        User journey tests (Playwright / Puppeteer)
       /─────\
      /  API  \      Integration tests for Vercel functions + Express routes
     /─────────\
    /   Unit    \    Vitest tests for actions, stores, utilities, components
   /─────────────\
```

### 1.4 Tools
- **Unit / Integration:** Vitest + React Testing Library
- **E2E:** Playwright
- **API Contract:** Vitest + fetch / supertest mocks
- **Performance:** Lighthouse CI + custom Playwright metrics
- **Security:** `npm audit`, manual CSRF / XSS / SQLi checks

---

## 2. Authentication & Authorization

### 2.1 Functional Requirements
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| A-01 | Email/password sign-up via Supabase Auth | High | ⏳ |
| A-02 | Email/password sign-in via Supabase Auth | High | ⏳ |
| A-03 | Google OAuth sign-in | High | ⏳ |
| A-04 | GitHub OAuth sign-in | High | ⏳ |
| A-05 | Password reset via email | Medium | ⏳ |
| A-06 | Session persists across reloads | High | ⏳ |
| A-07 | Protected routes redirect unauthenticated users | High | ⏳ |
| A-08 | Admin routes block non-admin users | Medium | ⏳ |
| A-09 | `useIsAdmin()` reflects `profiles.is_admin` | Medium | ⏳ |
| A-10 | Sign-out clears session and local state | High | ⏳ |
| A-11 | Auth state changes update UI reactively | Medium | ⏳ |
| A-12 | Self-escalation guard prevents non-admin privilege changes | High | ⏳ |

### 2.2 Edge Cases
- [ ] Session expires during active use → redirect to sign-in without crash.
- [ ] Network failure during `getSession()` → loading state resolves gracefully.
- [ ] Invalid credentials → error message shown, no lockout.
- [ ] OAuth provider returns error → fallback UI shown.
- [ ] Concurrent tabs sign in/out → state syncs without flash.
- [ ] Email confirmation flow completes end-to-end.
- [ ] User deletes account → all dependent data cascades delete via Supabase.
- [ ] Admin suspends user → user is immediately blocked from protected routes.

### 2.3 User Workflows
1. **New user signup:** Landing → Sign up → Email confirmation → Dashboard.
2. **Returning user login:** Landing → Sign in → Dashboard.
3. **OAuth login:** Landing → Sign in with Google/GitHub → Dashboard.
4. **Password reset:** Sign in → Forgot password → Email link → New password → Sign in.
5. **Session recovery:** Close tab → Reopen → Still signed in.

---

## 3. AI Website Builder (Project Builder)

### 3.1 Functional Requirements
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PB-01 | User creates project from prompt | High | ⏳ |
| PB-02 | Agent generates React/TypeScript code | High | ⏳ |
| PB-03 | Agent writes files to virtual filesystem | High | ⏳ |
| PB-04 | In-browser preview builds via esbuild-wasm | High | ⏳ |
| PB-05 | User can refine project with follow-up prompt | High | ⏳ |
| PB-06 | Agent edits existing files | High | ⏳ |
| PB-07 | User can toggle between preview and code view | High | ⏳ |
| PB-08 | User can preview on desktop/tablet/phone | Medium | ⏳ |
| PB-09 | User can deploy to Cloudflare Pages | High | ⏳ |
| PB-10 | Deployed site is accessible via URL | High | ⏳ |
| PB-11 | Project files persist in Supabase `projects` | High | ⏳ |
| PB-12 | Agent fails over across providers (max 2 switches) | Medium | ⏳ |
| PB-13 | Loop detection prevents infinite retries | Medium | ⏳ |
| PB-14 | Deterministic verification gate on `done` tool | Medium | ⏳ |
| PB-15 | Conversation-prefix prompt caching works | Low | ⏳ |

### 3.2 Edge Cases
- [ ] Empty prompt → validation error, no agent call.
- [ ] Agent times out → error shown, project not lost.
- [ ] Network drops during generation → auto-retry, data not lost.
- [ ] Very large generated codebase → preview builds within timeout.
- [ ] Deploy fails → error shown, project preserved.
- [ ] Concurrent edits in two tabs → last write wins, no corruption.
- [ ] Project with special characters in title → saved correctly.
- [ ] esbuild-wasm fails to bundle → fallback error message.

### 3.3 User Workflows
1. **Create project:** Dashboard → Enter prompt → Agent builds → Preview → Deploy.
2. **Refine project:** Dashboard → Select project → Refine prompt → Agent edits → Preview updated.
3. **Share project:** Dashboard → Select project → Copy link → Recipient views preview.
4. **Delete project:** Dashboard → Right-click → Delete → Confirm → Removed.

---

## 4. Studios (30+)

### 4.1 Functional Requirements Matrix
| Studio | Core Feature | Persistence | Preview | Priority |
|--------|-------------|-------------|---------|----------|
| Image | AI image generation | Supabase / localStorage | Canvas | Medium |
| Video | Text/image-to-video | localStorage | Player | Medium |
| Cinema | Cinematic movements | localStorage | Player | Medium |
| Character | Consistent character gen | localStorage | Canvas | Low |
| Effects | 350+ visual effects | localStorage | Canvas | Medium |
| Edit | Object/inpaint/relight | localStorage | Timeline | Medium |
| Upscale | AI enhancement 2x-4x | localStorage | Canvas | Low |
| Audio | Audio processing | localStorage | Player | Medium |
| Avatar | Avatar generation | localStorage | Canvas | Low |
| Influencer | AI influencer content | localStorage | Canvas | Low |
| Commercial | Product photography | localStorage | Player | Medium |
| Storyboard | Sequential frame gen | localStorage | Canvas | Medium |
| Training | Model training | localStorage | Player | Medium |
| VideoTools | Video utilities | localStorage | Varies | Medium |
| Chat | Chat-based interaction | localStorage | Chat UI | Medium |
| LipSync | Lip synchronization | localStorage | Player | Low |
| Render | Video render + queue | **Supabase** | Player | High |
| Video Agent | AI video agent | localStorage | Chat/Preview | Medium |
| Director | Director mode | localStorage | Timeline | Medium |
| Timeline | Timeline editor | hybrid Supabase | Timeline | Medium |
| AI VFX | AI visual effects | localStorage | Canvas | Medium |
| Assist | AI assistance | localStorage | Chat UI | Medium |
| Apps | Apps hub | N/A | N/A | Low |
| Explore | Discover | N/A | N/A | Low |

### 4.2 Common Requirements for All Studios
- [ ] Studio loads without console errors.
- [ ] Studio has error boundary.
- [ ] Studio cleans up on unmount (no memory leaks).
- [ ] Studio respects auth state.
- [ ] Studio shows loading state while initializing.
- [ ] Studio shows error state on failure.
- [ ] Studio navigable from header/landing.

### 4.3 Edge Cases
- [ ] Studio navigated to directly via URL without prior auth → redirects.
- [ ] Studio receives malformed input → graceful error.
- [ ] Studio backend service returns 500 → UI shows retry option.
- [ ] User navigates away during long operation → operation cancelled or resumed.
- [ ] Browser back button during studio operation → state preserved.

---

## 5. Supabase Data Layer

### 5.1 Functional Requirements
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| DB-01 | Projects CRUD works | High | ⏳ |
| DB-02 | Project files saved correctly | High | ⏳ |
| DB-03 | Chat history persisted | Medium | ⏳ |
| DB-04 | Provider keys encrypted at rest | Critical | ⏳ |
| DB-05 | RLS policies enforce user isolation | Critical | ⏳ |
| DB-06 | Render drafts/templates persist | High | ✅ |
| DB-07 | Render queue persists | High | ✅ |
| DB-08 | Community posts CRUD works | Medium | ⏳ |
| DB-09 | Profiles update correctly | Medium | ⏳ |
| DB-10 | Notifications delivered | Low | ⏳ |
| DB-11 | Realtime collaborators work | Medium | ⏳ |
| DB-12 | Hybrid localStorage + Supabase sync works | Medium | ⏳ |

### 5.2 Edge Cases
- [ ] Network timeout during write → retry with exponential backoff.
- [ ] Concurrent writes to same project → last write wins, no corruption.
- [ ] Large file (>1MB) → chunked upload or compression.
- [ ] Orphaned records → cleanup job runs.
- [ ] Schema migration fails → rollback, no data loss.
- [ ] RLS policy gap → penetration test catches it.
- [ ] Service role key leaked → detect via audit log, rotate automatically.
- [ ] Database connection pool exhausted → queue requests, return 503.

---

## 6. API Endpoints

### 6.1 Functional Requirements
| ID | Endpoint | Method | Auth | Priority | Status |
|----|----------|--------|------|----------|--------|
| API-01 | `/api/deploy` | POST | Required | High | ⏳ |
| API-02 | `/api/provider-keys` | POST | Required | High | ⏳ |
| API-03 | `/api/admin` | POST | Admin | Medium | ⏳ |
| API-04 | `/api/supabase-oauth` | GET/POST | Required | Medium | ⏳ |
| API-05 | `/api/migrate` | POST | Required | High | ⏳ |
| API-06 | `/api/csrf` | GET | None | Medium | ⏳ |
| API-07 | `/api/ai-agent` | POST | Required | High | ⏳ |
| API-08 | `/api/scene-detection` | POST | Required | Medium | ⏳ |
| API-09 | `/api/semantic-search` | POST | Required | Medium | ⏳ |
| API-10 | `/api/speech-transcription` | POST | Required | Medium | ⏳ |
| API-11 | `/api/agents` | POST | Required | Medium | ⏳ |

### 6.2 Edge Cases
- [ ] Missing auth header → 401.
- [ ] Invalid token → 401.
- [ ] Expired token → 401 with clear error.
- [ ] Rate limit exceeded → 429 with Retry-After.
- [ ] CSRF token missing → 403.
- [ ] Invalid origin → CORS block.
- [ ] Oversized payload → 413.
- [ ] Malformed JSON → 400.
- [ ] Server error → 500 with generic message (no stack trace).
- [ ] Provider key encryption/decryption round-trip succeeds.
- [ ] Deploy to Cloudflare Pages returns manifest URL.

---

## 7. Security Testing

### 7.1 Functional Requirements
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SEC-01 | No hardcoded secrets in repo | Critical | ✅ |
| SEC-02 | SQL injection prevented | Critical | ✅ |
| SEC-03 | XSS prevented in all studios | Critical | ⏳ |
| SEC-04 | CSRF protection on mutating endpoints | High | ✅ |
| SEC-05 | CORS restricted to allowed origins | High | ✅ |
| SEC-06 | Rate limiting works globally | High | ✅ |
| SEC-07 | RLS policies prevent data leakage | Critical | ✅ |
| SEC-08 | Provider keys encrypted at rest | Critical | ⏳ |
| SEC-09 | HTTPS enforced in production | High | ✅ |
| SEC-10 | Security headers present (HSTS, CSP, etc.) | High | ✅ |
| SEC-11 | Self-escalation guard active | High | ✅ |

### 7.2 Edge Cases
- [ ] SQL injection via URL params → blocked.
- [ ] XSS via project titles → escaped.
- [ ] CSRF without token → rejected.
- [ ] CORS from unauthorized origin → blocked.
- [ ] Rate limit burst → throttled, not permanently blocked.
- [ ] Path traversal in file ops → blocked.
- [ ] SSRF in API calls → blocked by allowlist.

---

## 8. Performance Testing

### 8.1 Functional Requirements
| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| PERF-01 | Initial page load | <3s on 3G | ⏳ |
| PERF-02 | Project list render (100 items) | <100ms | ⏳ |
| PERF-03 | Search filter (100 items) | <50ms | ⏳ |
| PERF-04 | Agent response time | <5s simple request | ⏳ |
| PERF-05 | Preview build time | <10s simple project | ⏳ |
| PERF-06 | Deploy time | <60s | ⏳ |
| PERF-07 | Database query (projects) | <100ms | ⏳ |
| PERF-08 | Memory usage (1hr session) | <500MB | ⏳ |
| PERF-09 | esbuild-wasm bundle (large project) | <15s | ⏳ |
| PERF-10 | Studio lazy load time | <2s | ⏳ |

### 8.2 Edge Cases
- [ ] 100+ projects → smooth scrolling.
- [ ] 1000+ render queue items → no lag.
- [ ] Large project (100+ files) → preview builds within timeout.
- [ ] Slow API (2s latency) → loading states, no timeout.
- [ ] Memory pressure → garbage collection, no leak.
- [ ] Multiple tabs open → no conflicts.

---

## 9. Data Loss & Recovery

### 9.1 Functional Requirements
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| DL-01 | Save during network failure → retry succeeds | High | ⏳ |
| DL-02 | Concurrent edit → no data corruption | High | ⏳ |
| DL-03 | Partial failure (some files saved) → recovery possible | High | ⏳ |
| DL-04 | Browser crash → data recovered on reopen | High | ⏳ |
| DL-05 | Database rollback → data consistent | High | ⏳ |
| DL-06 | Render queue preserved across reloads | Medium | ✅ |
| DL-07 | Hybrid localStorage + Supabase sync preserves data | Medium | ⏳ |

### 9.2 Test Scenarios
1. **Network failure during save:**
   - Start saving project → Disable network → Re-enable → Verify auto-retry succeeds.

2. **Concurrent edits:**
   - Open project in two tabs → Edit both → Save both → Verify no corruption.

3. **Browser crash:**
   - Start building project → Kill browser → Reopen → Verify state recovered.

4. **Partial failure:**
   - Save 10 files → Network fails on file 5 → Verify 1-4 saved, 5 retried, 6-10 saved.

---

## 10. Implementation Plan

### Phase 1: Critical Path (Week 1)
- [ ] A-01 through A-12: Authentication tests.
- [ ] PB-01 through PB-08: Dashboard/Project CRUD tests.
- [ ] SEC-01 through SEC-05: Security tests.
- [ ] DL-01 through DL-04: Data loss tests.

### Phase 2: Core Studios (Week 2)
- [ ] R-01 through R-15: Render studio tests.
- [ ] PB-09 through PB-15: Project builder tests.
- [ ] DB-01 through DB-07: Database tests.
- [ ] API-01 through API-05: API endpoint tests.

### Phase 3: Coverage Expansion (Week 3)
- [ ] 4.1: Other studios smoke tests.
- [ ] SEC-06 through SEC-11: Advanced security tests.
- [ ] PERF-01 through PERF-10: Performance tests.
- [ ] 9.2: Data recovery tests.

### Phase 4: Polish (Week 4)
- [ ] Edge case tests.
- [ ] Accessibility tests.
- [ ] E2E workflow tests.
- [ ] Load tests.

---

## 11. Test Execution Checklist

### Pre-Deployment Checklist
- [ ] All unit tests pass (`npm test`).
- [ ] All integration tests pass.
- [ ] All e2e tests pass (`npx playwright test`).
- [ ] No console errors in production build.
- [ ] Lighthouse score >90 for all pages.
- [ ] Security scan passes (`npm audit`).
- [ ] No hardcoded secrets in code.
- [ ] RLS policies verified.
- [ ] CORS configuration verified.
- [ ] Rate limiting tested.
- [ ] Error boundaries tested.
- [ ] Memory leak test passes (1hr session).

---

## 12. CI/CD Integration

### Required Checks
1. **Lint:** `npm run lint` — must pass.
2. **TypeScript:** `tsc --noEmit` — must pass.
3. **Unit tests:** `npm test` — must pass.
4. **Build:** `npm run build` — must succeed.
5. **E2E:** `npx playwright test` — must pass on staging.
6. **Security:** `npm audit` — 0 high/critical vulnerabilities.
7. **Secrets scan:** `git secrets --scan` — no hardcoded secrets.

---

## 13. Monitoring & Alerts

### Production Metrics
- Error rate <0.1%.
- API latency p95 <500ms.
- Page load time p95 <3s.
- Database query p95 <200ms.
- Render queue processing time <5min per job.
- Auth success rate >99%.

### Alerts
- Error rate spike >1%.
- API latency p95 >1s.
- Database connection failures.
- Render queue backlog >100 jobs.
- Auth failure rate >5%.

---

## 14. Appendix: Existing Test Coverage

### Current Test Files
- `src/test/render-actions.test.js` — Render draft/template actions.
- `src/test/api-integration.test.js` — MuAPI client methods.
- `src/test/api-key-manager.test.js` — Provider key management.
- `src/test/api-key-scalability.test.js` — Key storage scalability.
- `src/test/apiClient.test.js` — API client unit tests.
- `src/test/brandApi.test.js` — Brand API tests.
- `src/test/errorBoundary.test.js` — Error boundary behavior.
- `src/test/generation-history.test.js` — Generation history CRUD.
- `src/test/logger.test.js` — Logger utility.
- `src/test/modelCatalog.test.js` — Model catalog service.
- `src/test/performance.test.js` — Performance benchmarks.
- `src/test/render-ai-actions.test.js` — AI render actions.
- `src/test/render-export-worker.test.js` — Export worker.
- `src/test/render-frame-processor.test.js` — Frame processing.
- `src/test/render-queue-store.test.js` — Render queue store.
- `src/test/renderpage-init.test.js` — RenderPage initialization.
- `src/test/settings-modal-validation.test.js` — Settings validation.
- `src/test/template-gtm-integration.test.js` — Template GTM.
- `src/test/timeline-component.test.js` — Timeline UI.
- `src/test/timeline-editor-core-integration.test.js` — Timeline core.
- `src/test/timeline-events.test.js` — Timeline events.
- `src/test/timeline-playback.test.js` — Timeline playback.
- `src/test/timeline-renderer.test.js` — Timeline renderer.
- `src/test/timeline-state.test.js` — Timeline state.
- `src/test/timeline-utils.test.js` — Timeline utilities.
- `src/test/unified-timeline-editor-phase4-integration.test.js` — Unified timeline.
- `src/test/validator.test.js` — Input validators.
- `src/lib/__tests__/agent/*.test.js` — Agent unit tests.
- `src/lib/editor/__tests__/*.test.js` — Editor unit tests.
- `backend/tests/*.test.js` — Backend service tests.

### Gaps to Fill
- No dedicated auth flow tests (A-01 through A-12).
- No API endpoint contract tests (API-01 through API-11).
- No E2E user journey tests.
- No security penetration tests.
- No performance regression tests.
- No accessibility tests.
- Limited cross-studio smoke tests.
