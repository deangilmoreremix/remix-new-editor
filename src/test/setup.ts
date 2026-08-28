/**
 * Vitest global setup and utilities.
 *
 * Provides:
 * - Global test utilities
 * - Mock factories
 * - Test data generators
 */

import { vi } from 'vitest';

// Mock crypto for tests
export const mockCrypto = {
  subtle: {
    generateKey: vi.fn(() => Promise.resolve({})),
    encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(16))),
    decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(16))),
    importKey: vi.fn(() => Promise.resolve({})),
  },
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
};

// Mock localStorage
export const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k]; },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
};

// Mock Supabase client
export const createMockSupabase = () => ({
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn(),
  },
});

const mockSupabase = createMockSupabase();

// Mock fetch
export const createMockFetch = () => vi.fn();

// Test data generators
export const generateMockProject = (overrides = {}) => ({
  id: `proj-${Date.now()}`,
  title: 'Test Project',
  user_id: 'user-123',
  files: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const generateMockDraft = (overrides = {}) => ({
  id: `draft-${Date.now()}`,
  label: 'Test Draft',
  video_url: 'https://example.com/video.mp4',
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const generateMockTemplate = (overrides = {}) => ({
  id: `template-${Date.now()}`,
  label: 'Test Template',
  config: {},
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const generateMockUser = (overrides = {}) => ({
  id: `user-${Date.now()}`,
  email: 'test@example.com',
  ...overrides,
});

export const generateMockRenderJob = (overrides = {}) => ({
  id: `job-${Date.now()}`,
  video_url: 'https://example.com/video.mp4',
  action: 'enhance',
  status: 'pending',
  user_id: 'user-123',
  created_at: new Date().toISOString(),
  ...overrides,
});

// Assertion helpers
export const expectArrayLength = (arr: any[], length: number) => {
  expect(arr).toHaveLength(length);
};

export const expectToHaveProperty = (obj: any, prop: string) => {
  expect(obj).toHaveProperty(prop);
};

export const expectToBeString = (value: any) => {
  expect(typeof value).toBe('string');
};

export const expectToBeNumber = (value: any) => {
  expect(typeof value).toBe('number');
};

export const expectToBeBoolean = (value: any) => {
  expect(typeof value).toBe('boolean');
};

export const expectToBeDate = (value: any) => {
  expect(new Date(value).getTime()).not.toBeNaN();
};
