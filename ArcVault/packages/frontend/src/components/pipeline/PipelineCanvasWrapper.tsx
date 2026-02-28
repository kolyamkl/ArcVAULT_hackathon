'use client';

import { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { clsx } from 'clsx';
import { BlockPalette } from '@/components/pipeline/BlockPalette';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineSummary } from '@/components/pipeline/PipelineSummary';
import { PipelineCanvas } from '@/components/pipeline/PipelineCanvas';
import { ExecutionLog } from '@/components/pipeline/ExecutionLog';
import { PipelineHistoryTable } from '@/components/pipeline/PipelineHistoryTable';

type PipelineTab = 'builder' | 'history';

const TABS: { key: PipelineTab; label: string }[] = [
  { key: 'builder', label: 'Builder' },
  { key: 'history', label: 'History' },
];

export default function PipelineCanvasWrapper() {
  const [activeTab, setActiveTab] = useState<PipelineTab>('builder');

  return (
    <ReactFlowProvider>
      <div className="flex h-[calc(100vh-64px)] -m-6 overflow-hidden">
        {/* Left sidebar: block palette + summary (builder only) */}
        {activeTab === 'builder' && (
          <aside className="w-[280px] flex-shrink-0 border-r border-[#383430] bg-transparent overflow-y-auto flex flex-col">
            <BlockPalette />
            <PipelineSummary />
          </aside>
        )}

        {/* Center: toolbar + tab bar + content */}
        <div className="flex-1 flex flex-col min-w-0">
          <PipelineToolbar />

          {/* Tab bar */}
          <div className="flex border-b border-[#383430] px-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors relative',
                  activeTab === tab.key
                    ? 'text-[#C9A962]'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A962]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'builder' ? (
            <main className="flex-1 relative">
              <PipelineCanvas />
            </main>
          ) : (
            <div className="flex-1 overflow-hidden">
              <PipelineHistoryTable />
            </div>
          )}
        </div>

        {/* Execution log (builder only) */}
        {activeTab === 'builder' && <ExecutionLog />}
      </div>
    </ReactFlowProvider>
  );
}
