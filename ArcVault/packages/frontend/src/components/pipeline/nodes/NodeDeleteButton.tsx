'use client';

import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { X } from 'lucide-react';
import { usePipelineStore } from '@/stores/pipeline.store';

interface NodeDeleteButtonProps {
  nodeId: string;
}

/**
 * Small X button shown in the top-right corner of deletable nodes.
 * Visible on hover (via the parent's group class). Hidden during execution.
 */
export function NodeDeleteButton({ nodeId }: NodeDeleteButtonProps) {
  const { deleteElements } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteElements({ nodes: [{ id: nodeId }] });
    },
    [nodeId, deleteElements],
  );

  if (isExecuting) return null;

  return (
    <button
      onClick={handleDelete}
      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#D46B6B] text-white
                 flex items-center justify-center opacity-0 group-hover:opacity-100
                 transition-opacity duration-150 hover:bg-[#E57373] shadow-md z-10"
      title="Delete node"
    >
      <X className="w-3 h-3" />
    </button>
  );
}
