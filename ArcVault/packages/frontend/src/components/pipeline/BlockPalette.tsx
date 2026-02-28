'use client';

import { DragEvent } from 'react';
import { Building2, User, Briefcase, ShieldCheck, GitBranch, Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Block definitions
// ---------------------------------------------------------------------------

interface PaletteBlock {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  group: 'recipients' | 'flow';
}

const BLOCKS: PaletteBlock[] = [
  {
    type: 'department',
    label: 'Department',
    icon: <Building2 className="w-5 h-5" />,
    color: '#C9A962',
    borderColor: 'border-[#C9A962]/40',
    group: 'recipients',
  },
  {
    type: 'employee',
    label: 'Employee',
    icon: <User className="w-5 h-5" />,
    color: '#7EC97A',
    borderColor: 'border-[#7EC97A]/40',
    group: 'recipients',
  },
  {
    type: 'contractor',
    label: 'Contractor',
    icon: <Briefcase className="w-5 h-5" />,
    color: '#D4A853',
    borderColor: 'border-[#D4A853]/40',
    group: 'recipients',
  },
  {
    type: 'approval',
    label: 'Approval',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: '#A78BFA',
    borderColor: 'border-[#A78BFA]/40',
    group: 'flow',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: <GitBranch className="w-5 h-5" />,
    color: '#22D3EE',
    borderColor: 'border-[#22D3EE]/40',
    group: 'flow',
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: <Clock className="w-5 h-5" />,
    color: '#60A5FA',
    borderColor: 'border-[#60A5FA]/40',
    group: 'flow',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Block palette in the left panel of the Pipeline Builder.
 *
 * Renders draggable cards for each node type. Users drag these onto the
 * canvas to create new nodes. Drag data is set via the dataTransfer API
 * with the `application/reactflow` MIME type.
 */
export function BlockPalette() {
  function onDragStart(event: DragEvent<HTMLDivElement>, nodeType: string) {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }

  const recipientBlocks = BLOCKS.filter((b) => b.group === 'recipients');
  const flowBlocks = BLOCKS.filter((b) => b.group === 'flow');

  return (
    <div className="p-3">
      {/* Recipients group */}
      <h3 className="text-[10px] font-display font-semibold text-[#A09D95] uppercase tracking-wider mb-2">
        Recipients
      </h3>
      <div className="flex flex-col gap-2 mb-4">
        {recipientBlocks.map((block) => (
          <div
            key={block.type}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border ${block.borderColor}
                       bg-[#232120] cursor-grab hover:brightness-125
                       transition-all active:cursor-grabbing`}
            draggable
            onDragStart={(e) => onDragStart(e, block.type)}
            role="button"
            aria-label={`Drag ${block.label} block`}
          >
            <span style={{ color: block.color }}>{block.icon}</span>
            <span className="text-sm font-medium text-foreground">{block.label}</span>
          </div>
        ))}
      </div>

      {/* Flow Control group */}
      <h3 className="text-[10px] font-display font-semibold text-[#A09D95] uppercase tracking-wider mb-2">
        Flow Control
      </h3>
      <div className="flex flex-col gap-2">
        {flowBlocks.map((block) => (
          <div
            key={block.type}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg border ${block.borderColor}
                       bg-[#232120] cursor-grab hover:brightness-125
                       transition-all active:cursor-grabbing`}
            draggable
            onDragStart={(e) => onDragStart(e, block.type)}
            role="button"
            aria-label={`Drag ${block.label} block`}
          >
            <span style={{ color: block.color }}>{block.icon}</span>
            <span className="text-sm font-medium text-foreground">{block.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
