# Pipeline Builder Page Specification -- CORE FEATURE

> **Route:** `/pipeline` (`packages/frontend/src/app/pipeline/page.tsx`)
>
> **Purpose:** Visual payment orchestration canvas powered by React Flow. CFOs drag-and-drop payment blocks to build recurring payout pipelines (departments, employees, contractors), configure amounts and currencies, then execute the entire pipeline in one action with real-time animation feedback.
>
> **Tech stack:** Next.js App Router, React, Tailwind CSS, React Flow, Zustand, TanStack Query, wagmi/viem

---

## Table of Contents

1. [Page Overview](#page-overview)
2. [Layout](#layout)
3. [Left Panel](#left-panel)
4. [Canvas — React Flow](#canvas--react-flow)
5. [Node Types](#node-types)
6. [Edge Styling](#edge-styling)
7. [Inline Node Expansion](#inline-node-expansion)
8. [Pipeline Execution Flow](#pipeline-execution-flow)
9. [Save / Load](#save--load)
10. [State Management](#state-management)
11. [Loading, Error & Edge-Case States](#loading-error--edge-case-states)
12. [Files to Create](#files-to-create)
13. [Cross-references](#cross-references)

---

## Page Overview

The Pipeline Builder is the signature feature of ArcVault. It provides a visual canvas where treasury operators can:

- Drag node blocks from a palette onto a React Flow canvas.
- Connect Treasury sources to Department nodes, and Departments to Employee/Contractor nodes.
- Configure per-recipient amounts, currencies, and payment schedules inline.
- Save and load named pipeline configurations.
- Execute the entire pipeline with a single click, watching animated payment flows cascade through the graph.

---

## Layout

```
+----------+--------------------------------------+
| Left     |                                      |
| Panel    |         React Flow Canvas            |
| (280px)  |                                      |
| -------- |   [Treasury] ---+--- [Engineering]   |
| Blocks   |                 |    $120K/mo        |
| [Dept]   |                 |     |              |
| [Empl]   |                 |   [Dev1] [Dev2]    |
| [Contr]  |                 |   $5K    $5K       |
|          |                 |   USDC   EURC      |
| -------- |                 |                    |
| Saved    |                 +--- [Marketing]     |
| Configs  |                      $80K/mo        |
| [Payroll]|                                      |
| [Contrs] |                                      |
|          |                                      |
| -------- |   [Contractors] ---+--- [Vendor1]   |
| Summary  |                    +--- [Vendor2]   |
| Total:$X |                                      |
| FX: $Y   |                                      |
| [Execute]|                                      |
+----------+--------------------------------------+
                                    [Execution Log]
```

**Tailwind structure (page.tsx):**

```tsx
export default function PipelinePage() {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Panel — fixed width */}
      <aside className="w-[280px] flex-shrink-0 border-r border-border bg-card overflow-y-auto flex flex-col">
        <BlockPalette />
        <SavedConfigs />
        <PipelineSummary />
      </aside>

      {/* Canvas — fills remaining space */}
      <main className="flex-1 relative">
        <PipelineCanvas />
      </main>

      {/* Execution Log — slides in from right when active */}
      <ExecutionLog />
    </div>
  );
}
```

The page occupies the full viewport height minus the top bar (64 px). The left panel is fixed at 280 px; the canvas fills the rest.

---

## Left Panel

The left panel is divided into three vertically stacked sections inside a scrollable sidebar.

### Section 1 -- Block Palette

**File:** `packages/frontend/src/components/pipeline/BlockPalette.tsx`

A list of draggable node templates. Each item is a small card that can be dragged onto the canvas.

**Blocks:**

| Block        | Icon Color     | Label        | Node Type Created |
| ------------ | -------------- | ------------ | ----------------- |
| Department   | Blue / Purple  | Department   | `department`      |
| Employee     | Green          | Employee     | `employee`        |
| Contractor   | Amber / Orange | Contractor   | `contractor`      |

**Drag implementation:**

```tsx
function onDragStart(event: DragEvent, nodeType: string) {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
}
```

Each palette item renders as:

```tsx
<div
  className="flex items-center gap-3 p-3 rounded-lg border border-border
             bg-background cursor-grab hover:bg-muted transition-colors"
  draggable
  onDragStart={(e) => onDragStart(e, 'department')}
>
  <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
    {/* icon */}
  </div>
  <span className="text-sm font-medium">Department</span>
</div>
```

On the canvas side, `onDrop` reads the data transfer, creates a new node at the drop position, and adds it to the React Flow state.

---

### Section 2 -- Saved Configurations

**File:** `packages/frontend/src/components/pipeline/SavedConfigs.tsx`

A list of previously saved pipelines with CRUD actions.

**UI elements:**

- **"New Pipeline" button** — clears canvas, resets to default (Treasury node only).
- **Pipeline list** — each item shows name + last modified timestamp. Click to load.
- **"Save" button** — saves current pipeline (PUT if existing, POST if new).
- **"Save As" button** — prompts for a new name, then POST.
- **"Delete" button** — confirmation dialog, then DELETE.

**Data source:** `usePipelines()` hook -> `GET /api/pipelines`

**Load behavior:** `usePipeline(id)` fetches the full pipeline (nodes + edges). On success, the canvas state is replaced with the loaded data.

---

### Section 3 -- Pipeline Summary

**File:** `packages/frontend/src/components/pipeline/PipelineSummary.tsx`

A live cost summary computed from the current canvas nodes.

**Displayed fields:**

| Field                    | Computation                                                  |
| ------------------------ | ------------------------------------------------------------ |
| Total cost               | Sum of all Employee + Contractor node amounts (in USDC)      |
| FX conversions needed    | Count of nodes where currency != USDC + estimated FX cost    |
| USYC redemptions needed  | `max(0, totalCost - liquidUSDC)` from `useVaultBalances()`   |

**"Execute Pipeline" button:**

- Gradient primary button, full width.
- Disabled when: no recipient nodes on canvas, wallet not connected, or already executing.
- On click: opens the **ExecutionModal** (pre-execution summary).

---

## Canvas -- React Flow

**File:** `packages/frontend/src/components/pipeline/PipelineCanvas.tsx`

The main React Flow wrapper component.

### Setup

```typescript
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

const nodeTypes = {
  treasurySource: TreasurySourceNode,
  department: DepartmentNode,
  employee: EmployeeNode,
  contractor: ContractorNode,
  fxConversion: FXConversionNode,
};
```

### Canvas configuration

```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onDrop={onDrop}
  onDragOver={onDragOver}
  nodeTypes={nodeTypes}
  fitView
  snapToGrid
  snapGrid={[16, 16]}
>
  <Background variant="dots" gap={16} size={1} />
  <Controls />
  <MiniMap
    nodeStrokeColor="#333"
    nodeColor="#1a1a2e"
    nodeBorderRadius={8}
  />
</ReactFlow>
```

### Drop handler

```typescript
function onDrop(event: DragEvent) {
  event.preventDefault();
  const type = event.dataTransfer.getData('application/reactflow');
  if (!type) return;

  const position = reactFlowInstance.screenToFlowPosition({
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
}
```

### Initial state

The canvas always starts with a single **TreasurySourceNode** positioned at `{ x: 100, y: 300 }`. This node cannot be deleted.

### Connection rules

- **Treasury -> Department:** Allowed.
- **Department -> Employee:** Allowed.
- **Department -> Contractor:** Allowed.
- **Department -> Department:** Allowed (sub-departments).
- **Employee/Contractor -> anything:** Not allowed (leaf nodes).
- Validate on `onConnect` callback; reject invalid connections.

### Auto-inserted FX nodes

When an edge is created between a Department node and an Employee/Contractor node whose currency differs from USDC, an `FXConversionNode` is automatically inserted on that edge:

1. Remove the direct edge.
2. Create an FXConversionNode positioned midway between source and target.
3. Create two edges: source -> FX node, FX node -> target.
4. FX node data auto-populates with the conversion rate from the cached quote.

---

## Node Types

### 1. TreasurySourceNode

**File:** `packages/frontend/src/components/pipeline/nodes/TreasurySourceNode.tsx`

| Property        | Value                                      |
| --------------- | ------------------------------------------ |
| Appearance      | Large card, blue gradient border           |
| Title           | "Treasury"                                 |
| Data displayed  | Liquid USDC, USYC balance, total available |
| Editable        | No (read-only)                             |
| Deletable       | No                                         |
| Handles         | 1 source handle (right side)               |

Data refreshes from `useVaultBalances()` on every poll cycle (10 seconds).

```tsx
function TreasurySourceNode({ data }: NodeProps) {
  const { liquidUSDC, usycBalance, totalValue } = useVaultBalances();

  return (
    <div className="rounded-xl border-2 border-blue-500 bg-card p-4 min-w-[200px] shadow-lg">
      <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
        Treasury
      </div>
      <div className="mt-2 text-lg font-bold">{formatCurrency(totalValue)}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Liquid: {formatCurrency(liquidUSDC)} | USYC: {formatCurrency(usycBalance)}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

---

### 2. DepartmentNode

**File:** `packages/frontend/src/components/pipeline/nodes/DepartmentNode.tsx`

| Property        | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Appearance      | Medium card, primary blue border                          |
| Title           | Department name (editable)                                |
| Data displayed  | Name, budget cap, total cost (sum of children), utilization bar |
| Editable        | Name, budget cap (on click/expand)                        |
| Deletable       | Yes                                                       |
| Handles         | 1 target (left), 1 source (right)                         |

**Utilization bar:** A horizontal progress bar showing `totalChildCost / budgetCap`. Color changes:
- < 80%: green
- 80-100%: amber
- > 100%: red (over budget warning)

**Default data:**

```typescript
{
  name: 'New Department',
  budgetCap: 0,
  totalCost: 0, // computed from children
}
```

---

### 3. EmployeeNode

**File:** `packages/frontend/src/components/pipeline/nodes/EmployeeNode.tsx`

| Property        | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Appearance      | Small card, green accent left border                    |
| Title           | Employee name (or "New Employee")                       |
| Data displayed  | Name, amount, currency badge                            |
| Editable        | Name, wallet address, monthly amount, currency, schedule|
| Deletable       | Yes                                                     |
| Handles         | 1 target (left), no source                              |

**Currency badge:** Small pill showing currency code (e.g., `EURC`). When currency is not USDC, an FX indicator icon appears.

**Editable fields (expanded view):**

| Field            | Type                       | Validation              |
| ---------------- | -------------------------- | ----------------------- |
| Name             | Text input                 | Required                |
| Wallet address   | Text input                 | Valid Ethereum address  |
| Monthly amount   | Number input               | > 0                     |
| Currency         | Select (USDC/EURC/GBPC/JPYC/CADC) | Required         |
| Payment schedule | Select (Monthly/Biweekly/Weekly)   | Required         |

**Default data:**

```typescript
{
  name: '',
  walletAddress: '',
  amount: 0,
  currency: 'USDC',
  schedule: 'monthly',
}
```

---

### 4. ContractorNode

**File:** `packages/frontend/src/components/pipeline/nodes/ContractorNode.tsx`

| Property        | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Appearance      | Small card, amber/orange accent left border               |
| Title           | Contractor name (or "New Contractor")                     |
| Data displayed  | Name, amount, currency badge, payment type badge          |
| Editable        | Name, wallet, amount, currency, payment type, milestone   |
| Deletable       | Yes                                                       |
| Handles         | 1 target (left), no source                                |

**Payment type badge:** "Recurring" or "Milestone" pill.

**Additional editable field vs. Employee:**

| Field                 | Type          | Notes                          |
| --------------------- | ------------- | ------------------------------ |
| Payment type          | Select        | "recurring" or "milestone"     |
| Milestone description | Text input    | Only visible if type=milestone |

**Default data:**

```typescript
{
  name: '',
  walletAddress: '',
  amount: 0,
  currency: 'USDC',
  paymentType: 'recurring',
  milestoneDescription: '',
}
```

---

### 5. FXConversionNode

**File:** `packages/frontend/src/components/pipeline/nodes/FXConversionNode.tsx`

| Property        | Value                                           |
| --------------- | ----------------------------------------------- |
| Appearance      | Small rounded pill, orange background            |
| Title           | "FX"                                             |
| Data displayed  | Conversion rate, estimated output amount         |
| Editable        | No (auto-calculated)                             |
| Deletable       | No (removed when parent edge is removed)         |
| Handles         | 1 target (left), 1 source (right)                |

This node is automatically inserted when a connection is made between a source (Department) and a target (Employee/Contractor) that has a non-USDC currency. It is non-interactive.

```tsx
function FXConversionNode({ data }: NodeProps) {
  return (
    <div className="rounded-full bg-orange-500/20 border border-orange-500 px-4 py-2 text-xs">
      <div className="font-semibold text-orange-400">FX</div>
      <div>{data.rate ? `1 USDC = ${data.rate} ${data.toCurrency}` : '...'}</div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

---

## Edge Styling

Edges represent payment flows between nodes.

| State      | Style                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Default    | Gray, dashed stroke (`strokeDasharray: '8 4'`), no animation          |
| Processing | Yellow, animated flowing dots (`stroke-dashoffset` CSS animation)     |
| Completed  | Green, solid stroke                                                    |
| Failed     | Red, solid stroke                                                      |

**CSS animation for processing edges:**

```css
@keyframes flowDash {
  to {
    stroke-dashoffset: -20;
  }
}

.edge-processing {
  stroke: #eab308;
  stroke-dasharray: 8 4;
  animation: flowDash 0.6s linear infinite;
}
```

Edge state is driven by the `executionProgress` map in the Pipeline Zustand store.

---

## Inline Node Expansion

Clicking any editable node (Department, Employee, Contractor) expands it in-place to show a form.

**Behavior:**

1. On node click, the node's `data.expanded` flag is set to `true`.
2. The node component conditionally renders either the compact view or the expanded form view.
3. Other nodes reflow around the expanded node (React Flow handles this if node dimensions change).
4. Clicking outside the expanded node or pressing `Escape` collapses it (`data.expanded = false`).

**Expanded form includes:**

- All editable fields for that node type (see per-node specs above).
- If historical data is available: "Last payment: [date]" and "Total paid: $X" labels.
- A small "Done" or checkmark button to close the expansion.

---

## Pipeline Execution Flow

### Step 1 -- Click "Execute Pipeline"

The PipelineSummary's "Execute Pipeline" button opens the **ExecutionModal**.

### Step 2 -- Pre-execution Summary Modal

**File:** `packages/frontend/src/components/pipeline/ExecutionModal.tsx`

A modal (design-system `Modal` component) showing:

```
+------------------------------------------+
|  Execute Pipeline: "Monthly Payroll"      |
+------------------------------------------+
|  Total cost: $200,000                     |
|                                           |
|  Department Breakdown:                    |
|  - Engineering: $120,000                  |
|  - Marketing: $80,000                     |
|                                           |
|  FX Conversions:                          |
|  - $5,000 USDC -> EURC (Dev2)            |
|  - $10,000 USDC -> GBPC (Vendor1)        |
|                                           |
|  USYC Redemptions:                        |
|  - Need to redeem $50,000 from USYC      |
|                                           |
|  Recipients:                              |
|  | Name   | Amount | Currency | Wallet   ||
|  | Dev1   | $5,000 | USDC     | 0xAB..  ||
|  | Dev2   | $5,000 | EURC     | 0xCD..  ||
|  | ...    | ...    | ...      | ...     ||
|                                           |
|  [Cancel]         [Confirm & Execute]     |
+------------------------------------------+
```

**"Confirm & Execute"** triggers the execution sequence.

### Step 3 -- Execution Animation

**File:** `packages/frontend/src/components/pipeline/ExecutionAnimation.tsx`

This module orchestrates the visual execution on the canvas.

**Animation sequence:**

1. All nodes start in **gray** (pending) state.
2. The TreasurySourceNode transitions to **yellow pulse** (processing).
3. After a brief delay (~1s), edges from Treasury to Departments animate (flowing dots).
4. Department nodes transition to **yellow pulse**.
5. Edges from Departments to recipients animate.
6. Each recipient node transitions: **yellow pulse** -> **green** (success) or **red** (failure).
7. Animation cascades from source to leaves, ~1-2 seconds per stage.

**Implementation approach:**

- The Pipeline Zustand store holds `executionProgress: Map<string, NodeStatus>`.
- The `usePipelineExecution` hook drives the state machine:
  1. POST /api/pipelines/[id]/execute
  2. Poll execution status
  3. On each status update, call `updateNodeStatus(nodeId, status)` in the store.
- Each custom node component reads its status from the store and applies the appropriate CSS classes.

**Node status CSS mapping:**

```typescript
const statusClasses = {
  pending: 'border-gray-500 opacity-60',
  processing: 'border-yellow-500 animate-pulse shadow-yellow-500/20 shadow-lg',
  completed: 'border-green-500 shadow-green-500/20 shadow-lg',
  failed: 'border-red-500 shadow-red-500/20 shadow-lg',
};
```

### Step 4 -- Execution Log Panel

**File:** `packages/frontend/src/components/pipeline/ExecutionLog.tsx`

A side panel (320 px wide) that slides in from the right during execution.

**UI:**

```
+------------------------------------+
|  Execution Log               [X]  |
+------------------------------------+
|  [spinner] Checking vault balance  |
|  [check]   Balance verified        |
|  [spinner] Redeeming $50K USYC    |
|  [check]   USYC redeemed          |
|  [spinner] Processing Engineering  |
|  [check]     Dev1: $5K USDC sent  |
|  [spinner]   Dev2: FX USDC->EURC  |
|  [check]     Dev2: EUR4,617 sent  |
|  [spinner] Processing Marketing   |
|  ...                               |
+------------------------------------+
```

**Behavior:**

- Each log entry appears progressively as the execution proceeds.
- Status icons: spinner (in progress), checkmark (success), X (failed).
- Entries are stored in `pipelineStore.executionLog[]`.
- The panel auto-scrolls to the bottom as new entries appear.
- Collapsible: click X or a toggle to hide.

### Step 5 -- Final Summary

After execution completes, a summary replaces (or appends to) the log:

```
Pipeline Executed Successfully!

- 8 payments completed, 0 failed
- Total cost: $200,000
- FX fees: $48.50
- USYC redeemed: $50,000

[View Details]
```

"View Details" navigates to the execution history or a detail modal.

---

## Save / Load

### Save

- **Endpoint:** `POST /api/pipelines` (create) or `PUT /api/pipelines/[id]` (update).
- **Payload:**
  ```typescript
  {
    name: string;
    nodes: Node[];     // React Flow nodes with data
    edges: Edge[];     // React Flow edges
    metadata: {
      totalCost: number;
      recipientCount: number;
      lastModified: string;
    };
    ownerWallet: string;  // connected wallet address
  }
  ```
- **Hook:** `useSavePipeline()` mutation.

### Load

- **Endpoint:** `GET /api/pipelines/[id]`
- **On load:** Replace canvas `nodes` and `edges` state with the response data.
- **Hook:** `usePipeline(id)` query.

### Auto-save (Nice-to-have)

- Debounced (2 seconds) auto-save on any node or edge change.
- Only if the pipeline has been previously saved (has an ID).
- Uses the `isDirty` flag in the Pipeline Zustand store.

### Pipeline name

- Editable text field in the left panel header.
- Defaults to "Untitled Pipeline".
- Updated in the store and persisted on save.

---

## State Management

### React Flow local state

```typescript
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);
```

These are the primary source of truth for the canvas layout.

### Pipeline Zustand Store

See `docs/frontend/08-hooks-and-state.md` for the full store definition. Key fields used on this page:

| Field               | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `currentPipelineId` | ID of loaded pipeline (null if new)           |
| `currentPipelineName` | Editable name                               |
| `isDirty`           | True if unsaved changes exist                 |
| `isExecuting`       | True during pipeline execution                |
| `executionProgress` | Map of nodeId -> status for animation         |
| `executionLog`      | Array of log entries for the Execution Log    |

### Computed values (derived from nodes)

These are computed on every render from the current `nodes` array, not stored separately:

- **Total cost:** Sum of `node.data.amount` for all employee/contractor nodes.
- **FX conversion count:** Count of nodes where `node.data.currency !== 'USDC'`.
- **USYC redemption needed:** `max(0, totalCost - liquidUSDC)`.
- **Per-department cost:** Group child nodes by parent department edge and sum.

---

## Loading, Error & Edge-Case States

| Scenario                        | UI Behavior                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| Page loading                    | Skeleton left panel; empty canvas with loading spinner           |
| No saved pipelines              | "No saved pipelines" message in Saved Configs section            |
| Canvas empty (no recipients)    | Execute button disabled; hint text on canvas                     |
| Wallet not connected            | Execute button shows "Connect wallet"; block palette still usable|
| Execution in progress           | All form editing disabled; animation plays on canvas             |
| Execution partial failure       | Failed nodes turn red; log shows error; summary shows counts     |
| Save failed                     | Toast error; retry available                                     |
| Load failed                     | Toast error; canvas unchanged                                    |
| Unsaved changes + load attempt  | Confirmation dialog: "Discard unsaved changes?"                  |
| Invalid connection attempted    | Connection rejected; brief toast or shake animation              |
| Over-budget department          | Utilization bar turns red; warning icon on node                  |

---

## Files to Create

| File                                                                          | Type       | Purpose                          |
| ----------------------------------------------------------------------------- | ---------- | -------------------------------- |
| `packages/frontend/src/app/pipeline/page.tsx`                                 | Page       | Route entry point                |
| `packages/frontend/src/components/pipeline/PipelineCanvas.tsx`                | Component  | React Flow wrapper               |
| `packages/frontend/src/components/pipeline/BlockPalette.tsx`                  | Component  | Draggable block list             |
| `packages/frontend/src/components/pipeline/SavedConfigs.tsx`                  | Component  | Saved pipeline list + CRUD       |
| `packages/frontend/src/components/pipeline/PipelineSummary.tsx`               | Component  | Cost summary + execute button    |
| `packages/frontend/src/components/pipeline/nodes/TreasurySourceNode.tsx`      | Component  | Treasury source node             |
| `packages/frontend/src/components/pipeline/nodes/DepartmentNode.tsx`          | Component  | Department node                  |
| `packages/frontend/src/components/pipeline/nodes/EmployeeNode.tsx`            | Component  | Employee node                    |
| `packages/frontend/src/components/pipeline/nodes/ContractorNode.tsx`          | Component  | Contractor node                  |
| `packages/frontend/src/components/pipeline/nodes/FXConversionNode.tsx`        | Component  | Auto-inserted FX conversion node |
| `packages/frontend/src/components/pipeline/ExecutionModal.tsx`                | Component  | Pre-execution summary modal      |
| `packages/frontend/src/components/pipeline/ExecutionLog.tsx`                  | Component  | Side panel execution log         |
| `packages/frontend/src/components/pipeline/ExecutionAnimation.tsx`            | Module     | Animation orchestration logic    |

---

## Cross-references

| Document                                       | Relevance                                                      |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `docs/frontend/01-design-system.md`            | Card, Button, Modal, StatusBadge, Input, Select                |
| `docs/frontend/08-hooks-and-state.md`          | usePipelines, usePipeline, usePipelineExecution, useSavePipeline, useBatchPayout, Pipeline Zustand store |
| `docs/technical/07-api-routes.md`              | `/api/pipelines/*` endpoints                                   |
| `docs/technical/03-payout-router-contract.md`  | `batchPayout` contract function for execution                  |
| `docs/technical/02-treasury-vault-contract.md` | Vault balance reads for TreasurySourceNode                     |
