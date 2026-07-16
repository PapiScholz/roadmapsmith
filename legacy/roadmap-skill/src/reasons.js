'use strict';

// Low-specificity reason strings produced by the deterministic validator for
// policy-level failures. These messages carry no file- or symbol-specific
// information and should not overwrite more informative existing annotations
// that a prior run or a human/agent authored.
const LOW_SPECIFICITY_REASONS = new Set([
  'validation failed',
  'implementation task requires deterministic Verify metadata or explicit Evidence to be marked complete',
  'implementation task requires Evidence line or high-confidence evidence (code + test) to be marked complete',
]);

/**
 * Returns true when `reason` is a low-specificity policy message — one that carries
 * no file- or symbol-specific diagnostic value and should not be used to overwrite
 * a more informative existing annotation.
 *
 * Input should be a normalized reason string (⚠️ prefix and warning prefixes already
 * stripped, as produced by normalizeWarningReason in src/sync/index.js).
 *
 * @param {string} reason
 * @returns {boolean}
 */
function isLowSpecificityReason(reason) {
  return LOW_SPECIFICITY_REASONS.has(String(reason || '').trim());
}

module.exports = { LOW_SPECIFICITY_REASONS, isLowSpecificityReason };
