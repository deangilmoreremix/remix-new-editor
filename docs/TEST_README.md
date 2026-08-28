# SmartVideo Platform — Test Suite

**Version:** 1.0  
**Date:** 2026-08-28  

---

## Overview

This test suite provides comprehensive coverage for the SmartVideo / OpenThorn platform, including:

- **Authentication & Authorization** — Clerk/Supabase auth flows, admin RBAC
- **AI Website Builder** — Agent loop, code generation, preview, deploy
- **30+ Studios** — Image, Video, Cinema, Render, Timeline, etc.
- **Supabase Data Layer** — RLS, persistence, fallback behavior
- **API Endpoints** — Vercel Functions, Express routes, security enforcement
- **Security** — SQL injection, XSS, CSRF, CORS, rate limiting, encryption
- **Performance** — Load times, rendering speed, memory usage
- **Data Loss & Recovery** — Network failures, concurrent edits, crash recovery
- **Accessibility** — Heading hierarchy, keyboard nav, ARIA, contrast

---

## Test Structure

```
src/test/                           # Unit & integration tests
├── auth-flow.test.jsx              # Authentication flows
├── api-endpoints.test.js           # API contract tests
├── admin-rbac.test.jsx             # Admin authorization
├── security.test.js                # Security tests
├── render-studio.test.js           # Render studio
├── project-builder.test.js         # Project builder
├── data-loss-recovery.test.js      # Data loss & recovery
├── error-boundary.test.js          # Error boundaries
├── accessibility.test.js           # Accessibility
├── studio-smoke.test.js            # Studio smoke tests
├── performance.test.js             # Performance tests
├── render-actions.test.js          # Render actions (existing)
├── api-integration.test.js         # API integration (existing)
├── ... (30+ existing test files)

e2e/                                # End-to-end tests
└── workflows.spec.ts               # User journey E2E tests

src/lib/__tests__/                  # Library unit tests
src/lib/editor/__tests__/           # Editor unit tests
backend/tests/                       # Backend tests
```

---

## Running Tests

### Run all tests
```bash
npm test
```

### Run unit tests only
```bash
npm run test:unit
```

### Run integration tests
```bash
npm run test:integration
```

### Run E2E tests
```bash
npm run test:e2e
```

### Run with coverage
```bash
npm run test:coverage
```

### Run all tests including E2E
```bash
npm run test:all
```

### Run security audit
```bash
npm run test:security
```

### Run CI pipeline
```bash
npm run test:ci
```

---

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Authentication | 90% | ⏳ |
| API Endpoints | 85% | ⏳ |
| Studios | 75% | ⏳ |
| Supabase Layer | 80% | ⏳ |
| Security | 95% | ⏳ |
| Performance | 70% | ⏳ |
| E2E Workflows | 60% | ⏳ |

---

## Test Categories

### 1. Authentication & Authorization
- Email/password sign-up/sign-in
- OAuth (Google, GitHub)
- Password reset
- Session persistence
- Protected route redirects
- Admin route guards
- Self-escalation prevention

### 2. AI Website Builder
- Project creation from prompt
- Agent code generation
- In-browser preview (esbuild-wasm)
- Project refinement
- Cloudflare Pages deployment
- Search and filter
- Device preview switching

### 3. Studios (30+)
- Load without errors
- Error boundaries
- Cleanup on unmount
- Auth state respect
- Loading/error states
- Navigation

### 4. Supabase Data Layer
- Projects CRUD
- Render drafts/templates
- Render queue
- Provider key encryption
- RLS policy enforcement
- Hybrid localStorage + Supabase sync

### 5. API Endpoints
- `/api/deploy` — Cloudflare Pages deployment
- `/api/provider-keys` — Key encryption
- `/api/admin` — Admin operations
- `/api/supabase-oauth` — BYO-Supabase OAuth
- `/api/migrate` — Schema migration
- CSRF enforcement
- Rate limiting
- CORS restrictions

### 6. Security
- No hardcoded secrets
- SQL injection prevention
- XSS prevention
- CSRF protection
- CORS restrictions
- Rate limiting
- RLS enforcement
- Provider key encryption
- HTTPS enforcement
- Security headers

### 7. Performance
- Initial page load <3s
- Project list render (100 items) <100ms
- Search filter <50ms
- Agent response <5s
- Preview build <10s
- Deploy <60s
- Memory usage <500MB (1hr session)

### 8. Data Loss & Recovery
- Network failure retry
- Concurrent edit safety
- Partial failure recovery
- Browser crash recovery
- Database rollback consistency
- Render queue persistence

### 9. Accessibility
- Heading hierarchy
- Accessible names
- Keyboard navigation
- Focus management
- ARIA live regions
- Color contrast

---

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Nightly scheduled runs

### Required Checks
1. `npm run lint` — must pass
2. `npm run test:unit` — must pass
3. `npm run test:security` — no high/critical vulnerabilities
4. `npm run build` — must succeed
5. `npm run test:e2e` — must pass on staging

---

## Test Data

### Fixtures
- `tests/fixtures/sample-video.mp4` — Sample video for render tests
- `tests/fixtures/sample-image.jpg` — Sample image for studio tests

### Mock Data
- Mock Supabase client for unit tests
- Mock AI provider responses
- Mock Cloudflare Pages API
- Mock esbuild-wasm output

---

## Writing New Tests

### Unit Test Template
```javascript
import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should do something', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test('user can complete workflow', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

---

## Troubleshooting

### Tests fail with "Cannot find module"
```bash
npm install
```

### E2E tests fail with "Cannot connect to server"
```bash
npm run dev &
npm run test:e2e
```

### Coverage report not generated
```bash
npm run test:coverage
```

### Vitest hangs
```bash
# Kill any running vitest processes
pkill -f vitest
npm test
```

---

## Maintenance

- Update test plan when features change
- Add tests for bug fixes (regression tests)
- Review coverage reports monthly
- Archive old test data quarterly
- Update E2E selectors when UI changes
