#!/usr/bin/env node

/**
 * Script to install Git hooks
 * Run with: node scripts/install-hooks.js
 */

const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '..', '.git', 'hooks');
const sourceHooksDir = path.join(__dirname, '..', '.git-hooks');

// Ensure .git/hooks directory exists
if (!fs.existsSync(hooksDir)) {
  console.error('❌ .git/hooks directory not found. Are you in a Git repository?');
  process.exit(1);
}

// Copy pre-commit hook
const preCommitSource = path.join(sourceHooksDir, 'pre-commit');
const preCommitDest = path.join(hooksDir, 'pre-commit');

try {
  fs.copyFileSync(preCommitSource, preCommitDest);
  
  // Make executable (Unix-like systems)
  if (process.platform !== 'win32') {
    fs.chmodSync(preCommitDest, '755');
  }
  
  console.log('✅ Git hooks installed successfully!');
  console.log('   - pre-commit: Runs ESLint to check subscriptions');
} catch (error) {
  console.error('❌ Failed to install Git hooks:', error.message);
  process.exit(1);
}
