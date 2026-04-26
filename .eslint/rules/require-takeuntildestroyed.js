/**
 * Custom ESLint rule to enforce takeUntilDestroyed() usage with subscribe()
 * 
 * This rule detects .subscribe() calls that are not followed by takeUntilDestroyed()
 * in the pipe chain, helping prevent memory leaks in Angular components.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce takeUntilDestroyed() usage with subscribe() to prevent memory leaks',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingTakeUntilDestroyed: 
        'Observable subscription should use .pipe(takeUntilDestroyed()) to prevent memory leaks. ' +
        'Import takeUntilDestroyed from @angular/core/rxjs-interop and inject DestroyRef.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Detect .subscribe() calls
      CallExpression(node) {
        // Check if this is a .subscribe() call
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'subscribe'
        ) {
          // Check if the subscribe is on a pipe() call
          const hasPipe = node.callee.object.type === 'CallExpression' &&
                         node.callee.object.callee.type === 'MemberExpression' &&
                         node.callee.object.callee.property.name === 'pipe';

          if (!hasPipe) {
            // No pipe() before subscribe() - definitely missing takeUntilDestroyed
            context.report({
              node,
              messageId: 'missingTakeUntilDestroyed',
            });
            return;
          }

          // Check if pipe() contains takeUntilDestroyed
          const pipeCall = node.callee.object;
          const pipeArguments = pipeCall.arguments;
          
          const hasTakeUntilDestroyed = pipeArguments.some(arg => {
            // Check for takeUntilDestroyed() call
            if (arg.type === 'CallExpression' &&
                arg.callee.type === 'Identifier' &&
                arg.callee.name === 'takeUntilDestroyed') {
              return true;
            }
            return false;
          });

          if (!hasTakeUntilDestroyed) {
            context.report({
              node,
              messageId: 'missingTakeUntilDestroyed',
            });
          }
        }
      },
    };
  },
};
