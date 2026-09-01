// Video Agent Studio — credit reservation contract.
//
// Phase 12. The Video Agent Studio never silently exceeds a user's
// budget. Every paid generation must go through:
//
//   estimate -> reserve -> execute -> reconcile
//
// The reserve step is what makes the system safe under concurrency and
// under crashes: once reserved, the credit balance reflects the
// pending job. If the job completes successfully, the reservation is
// finalised. If it fails or is cancelled, the reservation is released.
//
// This module is intentionally a contract only. The production
// implementation MUST plug into the existing SmartVideo credit ledger
// (see `supabase/migrations/*` for usage/billing tables) — it must
// NOT introduce a second credit system.

/**
 * @typedef {Object} CreditReservation
 * @property {string} reservationId
 * @property {string} userId
 * @property {string} jobId
 * @property {number} credits
 * @property {'pending'|'finalised'|'released'} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ApprovalMode
 * @property {'AUTO'|'BALANCED'|'MANUAL'} mode
 * @property {number} [autoApproveThresholdCredits] - ignored unless mode==='AUTO'
 */

export const APPROVAL_MODES = Object.freeze(['AUTO', 'BALANCED', 'MANUAL']);

/**
 * Decide whether a given cost needs explicit user approval given the
 * user's approval mode. This is the single source of truth used by
 * the agent + generation-adapter to decide when to surface an
 * approval prompt.
 *
 * @param {ApprovalMode} mode
 * @param {number} creditsEstimated
 * @param {{expensiveThresholdCredits?: number}} [opts]
 * @returns {boolean} true when the user must approve before the job
 *   is submitted.
 */
export function requiresApproval(mode, creditsEstimated, opts = {}) {
  const expensive = opts.expensiveThresholdCredits ?? 25;
  if (mode === 'MANUAL') return true;
  if (mode === 'BALANCED') return creditsEstimated >= expensive;
  // AUTO: explicit per-user threshold wins; otherwise no approval.
  if (typeof mode?.autoApproveThresholdCredits === 'number') {
    return creditsEstimated > mode.autoApproveThresholdCredits;
  }
  return false;
}

/**
 * @typedef {import('./types.js').CreditLedger}
 */

/**
 * In-memory implementation, used by tests. The production
 * implementation writes to the existing `usage_events` and
 * `credit_reservations` tables.
 */
export class InMemoryCreditLedger {
  constructor() {
    /** @type {Map<string, number>} userId -> available credits */
    this.balances = new Map();
    /** @type {Map<string, CreditReservation>} */
    this.reservations = new Map();
  }

  /**
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getBalance(userId) {
    return this.balances.get(userId) ?? 0;
  }

  /**
   * @param {string} userId
   * @param {number} credits
   * @returns {Promise<CreditReservation>}
   */
  async reserve(userId, jobId, credits) {
    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error('credits must be a non-negative finite number');
    }
    const balance = await this.getBalance(userId);
    if (credits > balance) {
      throw new Error('insufficient credits');
    }
    const now = new Date().toISOString();
    const reservation = {
      reservationId: crypto.randomUUID(),
      userId,
      jobId,
      credits,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.reservations.set(reservation.reservationId, reservation);
    this.balances.set(userId, balance - credits);
    return reservation;
  }

  /**
   * @param {string} userId
   * @param {string} reservationId
   * @returns {Promise<void>}
   */
  async finalise(userId, reservationId) {
    const r = this.reservations.get(reservationId);
    if (!r || r.userId !== userId) throw new Error('reservation not found');
    r.status = 'finalised';
    r.updatedAt = new Date().toISOString();
  }

  /**
   * @param {string} userId
   * @param {string} reservationId
   * @returns {Promise<void>}
   */
  async release(userId, reservationId) {
    const r = this.reservations.get(reservationId);
    if (!r || r.userId !== userId) throw new Error('reservation not found');
    if (r.status === 'pending') {
      this.balances.set(userId, (this.balances.get(userId) ?? 0) + r.credits);
    }
    r.status = 'released';
    r.updatedAt = new Date().toISOString();
  }
}
