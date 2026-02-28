'use client';

import {
  useCallback,
  useRef,
  useMemo,
  useEffect,
  DragEvent,
} from 'react';
import { useAccount } from 'wagmi';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  BackgroundVariant,
  ConnectionMode,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { TreasurySourceNode } from './nodes/TreasurySourceNode';
import { DepartmentNode } from './nodes/DepartmentNode';
import { EmployeeNode } from './nodes/EmployeeNode';
import { ContractorNode } from './nodes/ContractorNode';
import { FXConversionNode } from './nodes/FXConversionNode';
import { ApprovalNode } from './nodes/ApprovalNode';
import { ConditionNode } from './nodes/ConditionNode';
import { DelayNode } from './nodes/DelayNode';
import { ExecutionAnimation } from './ExecutionAnimation';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { useSavePipeline } from '@/hooks/useSavePipeline';
import { ElectricEdge } from './edges/ElectricEdge';

// ---------------------------------------------------------------------------
// Node type registration
// ---------------------------------------------------------------------------

const nodeTypes = {
  treasurySource: TreasurySourceNode,
  department: DepartmentNode,
  employee: EmployeeNode,
  contractor: ContractorNode,
  fxConversion: FXConversionNode,
  approval: ApprovalNode,
  condition: ConditionNode,
  delay: DelayNode,
};

const edgeTypes = {
  electric: ElectricEdge,
};

// ---------------------------------------------------------------------------
// Default node data factories
// ---------------------------------------------------------------------------

function getDefaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'department':
      return { name: 'New Department', budgetCap: 0, totalCost: 0, expanded: false };
    case 'employee':
      return {
        name: '',
        walletAddress: '',
        amount: 0,
        currency: 'USDC',
        schedule: 'monthly',
        giftEnabled: false,
        giftAmount: 0,
        giftNote: '',
        expanded: false,
      };
    case 'contractor':
      return {
        name: '',
        walletAddress: '',
        amount: 0,
        currency: 'USDC',
        paymentType: 'recurring',
        milestoneDescription: '',
        giftEnabled: false,
        giftAmount: 0,
        giftNote: '',
        expanded: false,
      };
    case 'approval':
      return {
        approvers: [''],
        threshold: 1,
        expanded: false,
      };
    case 'condition':
      return {
        field: 'amount',
        operator: '>',
        value: '5000',
        expanded: false,
      };
    case 'delay':
      return {
        delayType: 'duration',
        durationMinutes: 30,
        durationHours: 0,
        untilDate: '',
        expanded: false,
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Initial canvas state -- always starts with the Treasury node
// ---------------------------------------------------------------------------

const TREASURY_NODE_ID = 'treasury-source';

const initialNodes: Node[] = [
  {
    id: TREASURY_NODE_ID,
    type: 'treasurySource',
    position: { x: 100, y: 300 },
    data: {},
    deletable: false,
  },
];

// ---------------------------------------------------------------------------
// Edge style helpers driven by execution progress
// ---------------------------------------------------------------------------

function getEdgeStyle(
  sourceStatus: NodeStatus | undefined,
  targetStatus: NodeStatus | undefined,
): Partial<Edge> {
  // If the target has completed, the edge is complete
  if (targetStatus === 'completed') {
    return {
      style: { stroke: '#7EC97A', strokeWidth: 2 },
      animated: false,
    };
  }
  // If the target has failed, the edge is failed
  if (targetStatus === 'failed') {
    return {
      style: { stroke: '#D46B6B', strokeWidth: 2 },
      animated: false,
    };
  }
  // If the target is awaiting approval, purple animated
  if (targetStatus === 'awaiting_approval') {
    return {
      style: { stroke: '#A78BFA', strokeWidth: 2 },
      animated: true,
    };
  }
  // If the target is paused (delay), blue dashed
  if (targetStatus === 'paused') {
    return {
      style: { stroke: '#60A5FA', strokeWidth: 2, strokeDasharray: '6 3' },
      animated: false,
    };
  }
  // If source is processing/completed and target is processing, the edge is actively flowing
  if (
    (sourceStatus === 'processing' || sourceStatus === 'completed') &&
    targetStatus === 'processing'
  ) {
    return {
      style: { stroke: '#D4A853', strokeWidth: 2 },
      animated: true,
    };
  }
  // Default: gold electric
  return {
    style: {
      stroke: '#C9A962',
      strokeWidth: 1.5,
    },
    animated: false,
  };
}

// ---------------------------------------------------------------------------
// Connection validation
// ---------------------------------------------------------------------------

const LEAF_TYPES = new Set(['employee', 'contractor', 'fxConversion']);
const FLOW_CONTROL_TYPES = new Set(['approval', 'condition', 'delay']);

function isConnectionValid(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceType = sourceNode.type;
  const targetType = targetNode.type;

  // Leaf nodes cannot be a source
  if (sourceType && LEAF_TYPES.has(sourceType)) return false;

  // Nothing can connect TO treasury
  if (targetType === 'treasurySource') return false;

  // Treasury -> Department only
  if (sourceType === 'treasurySource' && targetType !== 'department') return false;

  // Department -> Department | Employee | Contractor | flow-control nodes
  if (sourceType === 'department') {
    if (
      !['department', 'employee', 'contractor'].includes(targetType ?? '') &&
      !FLOW_CONTROL_TYPES.has(targetType ?? '')
    ) return false;
  }

  // Flow-control nodes can connect to departments, employees, contractors, and each other
  if (sourceType && FLOW_CONTROL_TYPES.has(sourceType)) {
    if (targetType === 'treasurySource') return false;
  }

  // Condition node: true and false handles cannot both connect to the same target
  if (sourceType === 'condition') {
    const existingEdgeToSameTarget = edges.find(
      (e) =>
        e.source === connection.source &&
        e.target === connection.target &&
        e.sourceHandle !== connection.sourceHandle,
    );
    if (existingEdgeToSameTarget) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Inner canvas component (must be inside ReactFlowProvider)
// ---------------------------------------------------------------------------

function PipelineCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const markDirty = usePipelineStore((s) => s.markDirty);
  const currentPipelineId = usePipelineStore((s) => s.currentPipelineId);

  const { address } = useAccount();
  const savePipeline = useSavePipeline();

  // Ref to skip the load effect after a save (save already has correct canvas data)
  const skipNextLoad = useRef(false);

  // -- Save / Save-As / Delete event listeners --------------------------------
  // PipelineToolbar dispatches CustomEvents; we listen here where nodes/edges
  // are available.

  useEffect(() => {
    const handleSave = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | undefined;
      const store = usePipelineStore.getState();
      const id = detail?.id ?? store.currentPipelineId ?? undefined;
      const name = store.currentPipelineName || 'Untitled Pipeline';

      // Skip the load effect that triggers when currentPipelineId changes after save
      skipNextLoad.current = true;
      savePipeline.mutate({
        id,
        name,
        nodes,
        edges,
        metadata: {},
        ownerWallet: address ?? '0x0000000000000000000000000000000000000000',
      });
    };

    const handleSaveAs = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: string } | undefined;
      const name = detail?.name || 'Untitled Pipeline';

      // Skip the load effect that triggers when currentPipelineId changes after save
      skipNextLoad.current = true;
      // Save-as always creates a new pipeline (no id)
      savePipeline.mutate({
        name,
        nodes,
        edges,
        metadata: {},
        ownerWallet: address ?? '0x0000000000000000000000000000000000000000',
      });
    };

    const handleDelete = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | undefined;
      if (!detail?.id) return;
      try {
        const res = await fetch(`/api/pipelines/${detail.id}`, { method: 'DELETE' });
        if (!res.ok) console.error('Failed to delete pipeline');
      } catch (err) {
        console.error('Delete pipeline error:', err);
      }
    };

    window.addEventListener('pipeline:save', handleSave);
    window.addEventListener('pipeline:save-as', handleSaveAs);
    window.addEventListener('pipeline:delete', handleDelete);
    return () => {
      window.removeEventListener('pipeline:save', handleSave);
      window.removeEventListener('pipeline:save-as', handleSaveAs);
      window.removeEventListener('pipeline:delete', handleDelete);
    };
  }, [nodes, edges, address, savePipeline]);

  // -- Load saved pipeline onto canvas when currentPipelineId changes ----------

  useEffect(() => {
    if (!currentPipelineId) {
      // Reset to blank canvas (e.g. "New" was pressed)
      setNodes(initialNodes);
      setEdges([]);
      return;
    }

    // After a save, currentPipelineId changes but the canvas already has correct data
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pipelines/${currentPipelineId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const pipeline = data.pipeline;
        if (!pipeline || cancelled) return;

        if (Array.isArray(pipeline.nodes) && pipeline.nodes.length > 0) {
          setNodes(pipeline.nodes);
        }
        setEdges(Array.isArray(pipeline.edges) ? pipeline.edges : []);
      } catch (err) {
        console.error('Failed to load pipeline:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [currentPipelineId, setNodes, setEdges]);

  // Prevent deleting the treasury node
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const filtered = changes.filter((change) => {
        if (change.type === 'remove' && change.id === TREASURY_NODE_ID) return false;
        return true;
      });
      if (filtered.length > 0) {
        onNodesChange(filtered);
        markDirty();
      }
    },
    [onNodesChange, markDirty],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      markDirty();
    },
    [onEdgesChange, markDirty],
  );

  // Connection handler with validation + auto FX node insertion
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isConnectionValid(connection, nodes, edges)) return;

      const targetNode = nodes.find((n) => n.id === connection.target);
      const targetCurrency = (targetNode?.data?.currency as string) || 'USDC';

      // Auto-insert FX node if target uses non-USDC currency
      if (
        targetCurrency !== 'USDC' &&
        (targetNode?.type === 'employee' || targetNode?.type === 'contractor')
      ) {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        if (!sourceNode || !targetNode) return;

        // Position FX node midway between source and target
        const fxId = `fx-${Date.now()}`;
        const fxPosition = {
          x: (sourceNode.position.x + targetNode.position.x) / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2,
        };

        const fxNode: Node = {
          id: fxId,
          type: 'fxConversion',
          position: fxPosition,
          data: {
            fromCurrency: 'USDC',
            toCurrency: targetCurrency,
            rate: null,
          },
          deletable: false,
        };

        setNodes((nds) => [...nds, fxNode]);

        // Create two edges: source -> FX, FX -> target
        const edgeToFX: Edge = {
          id: `edge-${connection.source}-${fxId}`,
          source: connection.source!,
          target: fxId,
          sourceHandle: connection.sourceHandle ?? undefined,
          type: 'electric',
        };
        const edgeFromFX: Edge = {
          id: `edge-${fxId}-${connection.target}`,
          source: fxId,
          target: connection.target!,
          targetHandle: connection.targetHandle ?? undefined,
          type: 'electric',
        };

        setEdges((eds) => [...eds, edgeToFX, edgeFromFX]);
      } else {
        // Direct connection
        setEdges((eds) => addEdge(connection, eds));
      }

      markDirty();
    },
    [nodes, edges, setNodes, setEdges, markDirty],
  );

  // Drop handler for palette items
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: getDefaultNodeData(type),
      };

      setNodes((nds) => [...nds, newNode]);
      markDirty();
    },
    [setNodes, markDirty],
  );

  // Node click handler -- toggle expansion for editable nodes
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (isExecuting) return;
      const expandableTypes = ['department', 'employee', 'contractor', 'approval', 'condition', 'delay'];
      if (!expandableTypes.includes(node.type ?? '')) return;

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: { ...n.data, expanded: !n.data.expanded },
            };
          }
          // Collapse other nodes
          if (expandableTypes.includes(n.type ?? '') && n.data.expanded) {
            return { ...n, data: { ...n.data, expanded: false } };
          }
          return n;
        }),
      );
    },
    [setNodes, isExecuting],
  );

  // Apply execution-based edge styles
  const styledEdges = useMemo(() => {
    if (!isExecuting) return edges;
    return edges.map((edge) => {
      const sourceStatus = executionProgress.get(edge.source);
      const targetStatus = executionProgress.get(edge.target);
      const overrides = getEdgeStyle(sourceStatus, targetStatus);
      return { ...edge, ...overrides };
    });
  }, [edges, executionProgress, isExecuting]);

  // Real-time connection validation -- highlights valid/invalid targets while dragging
  const isValidConnection = useCallback(
    (connection: Connection) => isConnectionValid(connection, nodes, edges),
    [nodes, edges],
  );

  // Pane click collapses expanded nodes
  const onPaneClick = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.data.expanded ? { ...n, data: { ...n.data, expanded: false } } : n,
      ),
    );
  }, [setNodes]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        defaultEdgeOptions={{
          type: 'electric',
          style: { stroke: '#C9A962', strokeWidth: 1.5 },
        }}
        connectionLineStyle={{ stroke: '#C9A962', strokeWidth: 2.5 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={isExecuting ? null : ['Backspace', 'Delete']}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls className="!bg-[#232120] !border-[#383430] !shadow-lg [&_button]:!bg-[#232120] [&_button]:!border-[#383430] [&_button]:!text-[#A09D95] [&_button:hover]:!bg-[#C9A96215]" />
        <MiniMap
          nodeStrokeColor="#A09D95"
          nodeColor={(node) => {
            switch (node.type) {
              case 'treasurySource': return '#C9A962';
              case 'department': return '#C9A962';
              case 'employee': return '#7EC97A';
              case 'contractor': return '#D4A853';
              case 'approval': return '#A78BFA';
              case 'condition': return '#22D3EE';
              case 'delay': return '#60A5FA';
              case 'fxConversion': return '#D4A853';
              default: return '#2D2B28';
            }
          }}
          nodeBorderRadius={8}
          className="!bg-[#232120] !border-[#383430]"
        />
      </ReactFlow>
      <ExecutionAnimation />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

/**
 * Pipeline Builder canvas.
 *
 * Requires a ReactFlowProvider ancestor (provided by the Pipeline page).
 * This allows sibling components like PipelineSummary to also access
 * the React Flow instance via useReactFlow().
 */
export function PipelineCanvas() {
  return <PipelineCanvasInner />;
}
