'use client';

import dynamic from 'next/dynamic';

const PipelineCanvasWrapper = dynamic(
  () => import('@/components/pipeline/PipelineCanvasWrapper'),
  { ssr: false },
);

/**
 * Pipeline Builder page.
 *
 * Three-column layout:
 * - Left panel (280px): Block palette, saved configs, and pipeline summary.
 * - Center: React Flow canvas filling the remaining space.
 * - Right (320px, conditional): Execution log panel that slides in during execution.
 *
 * ReactFlow + PipelineCanvas are dynamically imported (client-only, ~300KB).
 */
export default function PipelinePage() {
  return <PipelineCanvasWrapper />;
}
