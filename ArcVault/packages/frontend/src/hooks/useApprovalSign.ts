'use client';

import { useCallback, useState } from 'react';
import { useSignMessage } from 'wagmi';

/**
 * Build the human-readable message shown in MetaMask for pipeline approval.
 * Must produce the same string on client and server so the signature can be verified.
 */
export function buildApprovalMessage(executionId: string, nodeId: string): string {
  return [
    'ArcVault Pipeline Approval',
    '',
    `Execution: ${executionId}`,
    `Node: ${nodeId}`,
    '',
    'I approve the continuation of this pipeline execution.',
  ].join('\n');
}

/**
 * Hook that wraps wagmi's `useSignMessage` to sign an approval message.
 *
 * Returns:
 * - `signApproval(executionId, nodeId)` — triggers MetaMask signature popup
 * - `isSigning` — true while MetaMask popup is open
 * - `error` — user-facing error string (rejection, etc.)
 * - `clearError` — reset error state
 */
export function useApprovalSign() {
  const { signMessageAsync } = useSignMessage();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const signApproval = useCallback(
    async (executionId: string, nodeId: string): Promise<string | null> => {
      setError(null);
      setIsSigning(true);
      try {
        const message = buildApprovalMessage(executionId, nodeId);
        const signature = await signMessageAsync({ message });
        return signature;
      } catch (err: unknown) {
        const msg =
          err instanceof Error && err.message.includes('User rejected')
            ? 'Signature rejected by user'
            : 'Failed to sign approval';
        setError(msg);
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [signMessageAsync],
  );

  return { signApproval, isSigning, error, clearError } as const;
}
