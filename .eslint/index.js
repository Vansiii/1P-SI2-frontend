/**
 * Custom ESLint plugin for Angular subscription management
 */

const requireTakeUntilDestroyed = require('./rules/require-takeuntildestroyed');

module.exports = {
  rules: {
    'require-takeuntildestroyed': requireTakeUntilDestroyed,
  },
};
