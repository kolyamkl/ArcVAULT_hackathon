'use client';

import type { NodeStatus } from '@/stores/pipeline.store';

// ---------------------------------------------------------------------------
// Status-driven style map (shared across all nodes)
// ---------------------------------------------------------------------------

export const statusClasses: Record<NodeStatus, string> = {
  pending: 'border-[#A09D95] opacity-60',
  processing: 'border-[#E0A84C] animate-pulse shadow-[#E0A84C]/20 shadow-lg',
  completed: 'border-[#7EC97A] shadow-[#7EC97A]/20 shadow-lg',
  failed: 'border-[#D46B6B] shadow-[#D46B6B]/20 shadow-lg',
  awaiting_approval: 'border-[#A78BFA] animate-pulse shadow-[#A78BFA]/20 shadow-lg',
  paused: 'border-[#60A5FA] shadow-[#60A5FA]/20 shadow-lg',
};

// Re-export FieldInput and FieldSelect as shared primitives
// (kept inline in Employee/Contractor nodes for backwards compat, but new nodes import from here)

export { FieldInput, FieldSelect } from './FieldInput';
