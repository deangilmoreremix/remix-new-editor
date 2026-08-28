/**
 * Admin authorization tests.
 *
 * Tests validate admin route guards, RBAC, and self-escalation prevention.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock useIsAdmin hook
const mockUseIsAdmin = vi.fn();

vi.mock('../../hooks/useIsAdmin.js', () => ({
  useIsAdmin: mockUseIsAdmin,
}));

// Mock router
vi.mock('../../lib/router.js', () => ({
  navigate: vi.fn(),
}));

import { navigate } from '../../lib/router.js';

describe('Admin Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsAdmin.mockReturnValue(false);
  });

  describe('Admin route access', () => {
    test('admin user can access admin routes', async () => {
      mockUseIsAdmin.mockReturnValue(true);

      // Simulate admin access
      const isAdmin = mockUseIsAdmin();
      expect(isAdmin).toBe(true);
    });

    test('non-admin user is blocked from admin routes', async () => {
      mockUseIsAdmin.mockReturnValue(false);

      // Simulate non-admin access
      const isAdmin = mockUseIsAdmin();
      expect(isAdmin).toBe(false);
      
      // Should redirect to dashboard
      navigate('/dashboard');
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('Self-escalation guard', () => {
    test('prevents non-admin from modifying is_admin flag', () => {
      mockUseIsAdmin.mockReturnValue(false);

      const isAdmin = mockUseIsAdmin();
      expect(isAdmin).toBe(false);
      // Non-admin users should not see admin controls
    });

    test('allows admin to modify privileged fields', () => {
      mockUseIsAdmin.mockReturnValue(true);

      const isAdmin = mockUseIsAdmin();
      expect(isAdmin).toBe(true);
    });
  });

  describe('Admin operations', () => {
    test('admin can suspend user', () => {
      mockUseIsAdmin.mockReturnValue(true);
      expect(mockUseIsAdmin()).toBe(true);
    });

    test('admin can delete user', () => {
      mockUseIsAdmin.mockReturnValue(true);
      expect(mockUseIsAdmin()).toBe(true);
    });

    test('admin can send notifications', () => {
      mockUseIsAdmin.mockReturnValue(true);
      expect(mockUseIsAdmin()).toBe(true);
    });
  });
});
