'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePipelines } from '@/hooks/usePipelines';
import { usePipelineStore } from '@/stores/pipeline.store';
import { Button } from '@/components/shared/Button';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatRelativeTime } from '@/lib/utils';
import {
  Plus,
  Save,
  Copy,
  Trash2,
  FileText,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Saved Pipelines Dropdown
// ---------------------------------------------------------------------------

function SavedPipelinesDropdown({ onClose }: { onClose: () => void }) {
  const { data: pipelines, isLoading } = usePipelines();
  const { currentPipelineId, isDirty, resetPipeline, setCurrentPipeline } =
    usePipelineStore();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    // Use capture phase so the click doesn't also fire the toggle button
    document.addEventListener('mousedown', handleClickOutside, true);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleLoad = useCallback(
    (id: string, name: string) => {
      if (isDirty) {
        const confirmed = window.confirm('Discard unsaved changes?');
        if (!confirmed) return;
      }
      setCurrentPipeline(id, name);
      onClose();
    },
    [isDirty, setCurrentPipeline, onClose],
  );

  const handleDelete = useCallback(
    (id: string) => {
      window.dispatchEvent(
        new CustomEvent('pipeline:delete', { detail: { id } }),
      );
      setDeleteConfirmId(null);
      if (currentPipelineId === id) {
        resetPipeline();
      }
    },
    [currentPipelineId, resetPipeline],
  );

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="Saved pipelines"
      className="absolute top-full right-0 mt-1 w-72 max-h-80 overflow-y-auto rounded-lg border border-[#383430]
                 bg-[#232120] shadow-xl shadow-black/40 z-50 animate-fade-in"
    >
      {isLoading ? (
        <div className="p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" className="h-12 w-full" />
          ))}
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <div className="text-center py-8 px-4">
          <FileText className="w-8 h-8 text-[#A09D95]/40 mx-auto mb-2" />
          <p className="text-xs text-[#A09D95]">No saved pipelines</p>
          <p className="text-[10px] text-[#A09D95]/60 mt-1">
            Build a pipeline and save it to see it here
          </p>
        </div>
      ) : (
        <div className="p-1.5 space-y-0.5">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              role="option"
              aria-selected={pipeline.id === currentPipelineId}
              className={`group flex items-center gap-2 rounded-md px-2.5 py-2 cursor-pointer transition-colors
                ${
                  pipeline.id === currentPipelineId
                    ? 'bg-[#C9A96215] border border-[#C9A96230]'
                    : 'hover:bg-[#C9A96210] border border-transparent'
                }`}
              onClick={() => handleLoad(pipeline.id, pipeline.name)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLoad(pipeline.id, pipeline.name);
                }
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {pipeline.name}
                </p>
                <p className="text-[10px] text-[#A09D95]">
                  {formatRelativeTime(pipeline.updatedAt)}
                </p>
              </div>

              {/* Delete button */}
              {deleteConfirmId === pipeline.id ? (
                <div
                  className="flex gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDelete(pipeline.id)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#D46B6B]/20 text-[#D46B6B]
                               hover:bg-[#D46B6B]/30 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#A09D95]
                               hover:bg-[#C9A96210] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(pipeline.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#A09D95]
                             hover:text-[#D46B6B] hover:bg-[#D46B6B]/10 transition-all"
                  aria-label={`Delete ${pipeline.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineToolbar
// ---------------------------------------------------------------------------

export function PipelineToolbar() {
  const {
    currentPipelineId,
    currentPipelineName,
    isDirty,
    resetPipeline,
  } = usePipelineStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  // -- Actions ---------------------------------------------------------------

  const handleNew = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }
    resetPipeline();
  }, [isDirty, resetPipeline]);

  const handleSave = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('pipeline:save', { detail: { id: currentPipelineId } }),
    );
  }, [currentPipelineId]);

  const handleSaveAs = useCallback(() => {
    if (!saveAsName.trim()) return;
    window.dispatchEvent(
      new CustomEvent('pipeline:save-as', {
        detail: { name: saveAsName.trim() },
      }),
    );
    setSaveAsOpen(false);
    setSaveAsName('');
  }, [saveAsName]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      usePipelineStore
        .getState()
        .setCurrentPipeline(currentPipelineId, e.target.value);
      usePipelineStore.getState().markDirty();
    },
    [currentPipelineId],
  );

  // -- Render ----------------------------------------------------------------

  return (
    <div className="flex items-center gap-3 h-11 px-4 border-b border-[#383430] bg-[#232120] flex-shrink-0">
      {/* Left: Pipeline name + dirty indicator */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <input
          type="text"
          value={currentPipelineName}
          onChange={handleNameChange}
          className="w-56 max-w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium
                     text-foreground hover:border-[#383430] focus:border-[#C9A962] focus:bg-[#232120]
                     focus:outline-none transition-colors truncate"
          placeholder="Untitled Pipeline"
          aria-label="Pipeline name"
        />
        {isDirty && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-[#E0A84C] flex-shrink-0 animate-pulse-status"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Saved Pipelines dropdown trigger */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="!text-xs !gap-1.5"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <FileText className="w-3.5 h-3.5" />
            Pipelines
            <ChevronDown
              className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </Button>

          {dropdownOpen && (
            <SavedPipelinesDropdown
              onClose={() => setDropdownOpen(false)}
            />
          )}
        </div>

        {/* New */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNew}
          className="!text-xs"
          aria-label="New pipeline"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New
        </Button>

        {/* Save As */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSaveAsOpen((prev) => !prev)}
            className="!text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1" />
            Save As
          </Button>

          {saveAsOpen && (
            <div className="absolute top-full right-0 mt-1 flex gap-2 rounded-lg border border-[#383430]
                            bg-[#232120] p-2 shadow-xl shadow-black/40 z-50 animate-fade-in">
              <input
                type="text"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="w-44 rounded border border-[#383430] bg-background px-2 py-1 text-xs text-foreground
                           focus:border-[#C9A962] focus:outline-none"
                placeholder="New name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAs();
                  if (e.key === 'Escape') setSaveAsOpen(false);
                }}
                autoFocus
                aria-label="Save as name"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAs}
                className="!text-xs !px-3"
              >
                OK
              </Button>
            </div>
          )}
        </div>

        {/* Save -- prominent */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!isDirty && !!currentPipelineId}
          className={`!text-xs !font-semibold ${
            isDirty
              ? 'animate-pulse-glow !bg-[#C9A962] !text-black'
              : ''
          }`}
          aria-label="Save pipeline"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
