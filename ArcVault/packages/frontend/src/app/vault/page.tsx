'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign,
  Users,
  Building2,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { usePipelines } from '@/hooks/usePipelines';
import { usePipeline } from '@/hooks/usePipeline';
import { usePipelineHistory } from '@/hooks/usePipelineHistory';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/shared/Card';
import { Select } from '@/components/shared/Select';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/format';

// ---------------------------------------------------------------------------
// Pipeline analysis types (derived from React Flow node data)
// ---------------------------------------------------------------------------

interface RawNode {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

interface DepartmentAnalysis {
  name: string;
  budgetCap: number;
  totalCost: number;
  employeeCount: number;
  contractorCount: number;
  employees: WorkerEntry[];
  contractors: ContractorEntry[];
}

interface WorkerEntry {
  name: string;
  amount: number;
  currency: string;
  schedule: string;
  walletAddress: string;
}

interface ContractorEntry {
  name: string;
  amount: number;
  currency: string;
  paymentType: string;
  walletAddress: string;
}

interface PipelineAnalysis {
  totalCost: number;
  recipientCount: number;
  departmentCount: number;
  fxConversionCount: number;
  approvalCount: number;
  departments: DepartmentAnalysis[];
  allEmployees: WorkerEntry[];
  allContractors: ContractorEntry[];
}

// ---------------------------------------------------------------------------
// Analysis logic (mirrors PipelineSummary's useMemo)
// ---------------------------------------------------------------------------

function analyzePipeline(nodes: RawNode[], edges: RawEdge[]): PipelineAnalysis {
  const employeeNodes = nodes.filter((n) => n.type === 'employee');
  const contractorNodes = nodes.filter((n) => n.type === 'contractor');
  const departmentNodes = nodes.filter((n) => n.type === 'department');
  const recipientNodes = [...employeeNodes, ...contractorNodes];

  const totalCost = recipientNodes.reduce((sum, n) => {
    const base = Number(n.data.amount) || 0;
    const gift = n.data.giftEnabled ? (Number(n.data.giftAmount) || 0) : 0;
    return sum + base + gift;
  }, 0);

  const fxConversionCount = nodes.filter((n) => n.type === 'fxConversion').length;
  const approvalCount = nodes.filter((n) => n.type === 'approval').length;

  // Build department breakdown using edge traversal
  const departments: DepartmentAnalysis[] = departmentNodes.map((dept) => {
    const childEdges = edges.filter((e) => e.source === dept.id);
    const childNodeIds = new Set<string>();

    childEdges.forEach((edge) => {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode?.type === 'fxConversion') {
        edges
          .filter((e) => e.source === targetNode.id)
          .forEach((fxEdge) => childNodeIds.add(fxEdge.target));
      } else if (
        targetNode?.type === 'employee' ||
        targetNode?.type === 'contractor'
      ) {
        childNodeIds.add(edge.target);
      }
    });

    const childNodes = nodes.filter((n) => childNodeIds.has(n.id));
    const deptEmployees = childNodes.filter((n) => n.type === 'employee');
    const deptContractors = childNodes.filter((n) => n.type === 'contractor');

    const deptCost = childNodes.reduce((sum, n) => {
      const base = Number(n.data.amount) || 0;
      const gift = n.data.giftEnabled ? (Number(n.data.giftAmount) || 0) : 0;
      return sum + base + gift;
    }, 0);

    return {
      name: (dept.data.name as string) || 'Unnamed Department',
      budgetCap: Number(dept.data.budgetCap) || 0,
      totalCost: deptCost,
      employeeCount: deptEmployees.length,
      contractorCount: deptContractors.length,
      employees: deptEmployees.map((n) => ({
        name: (n.data.name as string) || 'Unnamed',
        amount: Number(n.data.amount) || 0,
        currency: (n.data.currency as string) || 'USDC',
        schedule: (n.data.schedule as string) || 'monthly',
        walletAddress: (n.data.walletAddress as string) || '',
      })),
      contractors: deptContractors.map((n) => ({
        name: (n.data.name as string) || 'Unnamed',
        amount: Number(n.data.amount) || 0,
        currency: (n.data.currency as string) || 'USDC',
        paymentType: (n.data.paymentType as string) || 'one-time',
        walletAddress: (n.data.walletAddress as string) || '',
      })),
    };
  });

  const allEmployees: WorkerEntry[] = employeeNodes.map((n) => ({
    name: (n.data.name as string) || 'Unnamed',
    amount: Number(n.data.amount) || 0,
    currency: (n.data.currency as string) || 'USDC',
    schedule: (n.data.schedule as string) || 'monthly',
    walletAddress: (n.data.walletAddress as string) || '',
  }));

  const allContractors: ContractorEntry[] = contractorNodes.map((n) => ({
    name: (n.data.name as string) || 'Unnamed',
    amount: Number(n.data.amount) || 0,
    currency: (n.data.currency as string) || 'USDC',
    paymentType: (n.data.paymentType as string) || 'one-time',
    walletAddress: (n.data.walletAddress as string) || '',
  }));

  return {
    totalCost,
    recipientCount: recipientNodes.length,
    departmentCount: departmentNodes.length,
    fxConversionCount,
    approvalCount,
    departments,
    allEmployees,
    allContractors,
  };
}

// ---------------------------------------------------------------------------
// Pie chart colors
// ---------------------------------------------------------------------------

const DEPT_COLORS = ['#D4A853', '#B08D3E', '#8B6F2F', '#C9A962', '#E0C078', '#A08040'];

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#232120] border border-[#383430] shadow-lg rounded-lg p-3 text-sm">
      <p className="font-medium text-foreground">{payload[0]?.name}</p>
      <p className="text-muted">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Execution status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Completed
      </span>
    );
  }
  if (normalized === 'FAILED' || normalized === 'PARTIAL_FAILURE') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-error">
        <XCircle className="w-3.5 h-3.5" />
        {normalized === 'PARTIAL_FAILURE' ? 'Partial Failure' : 'Failed'}
      </span>
    );
  }
  if (normalized === 'RUNNING' || normalized === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C9A962]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {normalized === 'RUNNING' ? 'Running' : 'Pending'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PipelineAnalysisPage() {
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: pipeline, isLoading: pipelineLoading } = usePipeline(selectedId);
  const { data: history, isLoading: historyLoading } = usePipelineHistory(selectedId, {
    page: 1,
    limit: 10,
  });

  // The API stores nodes/edges in React Flow format on the pipeline object
  const rawPipeline = pipeline as unknown as
    | { nodes?: RawNode[]; edges?: RawEdge[]; name?: string }
    | undefined;

  const analysis = useMemo<PipelineAnalysis | null>(() => {
    const nodes = rawPipeline?.nodes;
    const edges = rawPipeline?.edges;
    if (!nodes || !edges) return null;
    return analyzePipeline(nodes, edges);
  }, [rawPipeline]);

  const pipelineOptions = (pipelines ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const pieData = (analysis?.departments ?? []).map((d) => ({
    name: d.name,
    value: d.totalCost,
  }));

  // Auto-select first pipeline when list loads
  if (!selectedId && pipelineOptions.length > 0) {
    setSelectedId(pipelineOptions[0].value);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pipeline Selector */}
      <div className="max-w-sm">
        <Select
          label="Select Pipeline"
          options={pipelineOptions}
          value={selectedId ?? ''}
          onChange={(val) => setSelectedId(val)}
          placeholder={pipelinesLoading ? 'Loading pipelines...' : 'Choose a pipeline'}
        />
      </div>

      {/* No pipeline selected / loading */}
      {!selectedId && !pipelinesLoading && pipelineOptions.length === 0 && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <BarChart3 className="w-12 h-12 mb-4 opacity-40" />
            <p className="text-lg font-medium text-foreground mb-1">No pipelines found</p>
            <p className="text-sm">Create a pipeline in the Pipeline Builder to see analytics here.</p>
          </div>
        </Card>
      )}

      {pipelineLoading && selectedId && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><Skeleton variant="text" className="h-6 w-24 mb-2" /><Skeleton variant="text" className="h-10 w-32" /></Card>
            ))}
          </div>
        </div>
      )}

      {/* Analysis content */}
      {analysis && (
        <>
          {/* Row 1 -- General Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Cost"
              value={formatCurrency(analysis.totalCost)}
              iconBadge={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              label="Recipients"
              value={String(analysis.recipientCount)}
              iconBadge={<Users className="h-5 w-5" />}
              subtitle={`${analysis.allEmployees.length} employees, ${analysis.allContractors.length} contractors`}
            />
            <StatCard
              label="Departments"
              value={String(analysis.departmentCount)}
              iconBadge={<Building2 className="h-5 w-5" />}
            />
            <StatCard
              label="FX Conversions"
              value={String(analysis.fxConversionCount)}
              iconBadge={<ArrowLeftRight className="h-5 w-5" />}
            />
          </div>

          {/* Row 2 -- Department Breakdown */}
          {analysis.departments.length > 0 && (
            <Card>
              <h3 className="font-display text-2xl font-medium text-foreground mb-4">
                Department Breakdown
              </h3>
              <div className="space-y-3">
                {analysis.departments.map((dept) => {
                  const utilization = dept.budgetCap > 0
                    ? Math.min((dept.totalCost / dept.budgetCap) * 100, 100)
                    : 0;
                  const utilizationColor =
                    utilization >= 90 ? 'bg-error' : utilization >= 70 ? 'bg-warning' : 'bg-success';

                  return (
                    <div
                      key={dept.name}
                      className="p-4 rounded-lg bg-[#1A1918] border border-[#2A2825]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground">{dept.name}</h4>
                        <span className="text-sm font-medium text-[#C9A962]">
                          {formatCurrency(dept.totalCost)}
                        </span>
                      </div>

                      {/* Utilization bar */}
                      {dept.budgetCap > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-muted mb-1">
                            <span>Budget utilization</span>
                            <span>{utilization.toFixed(0)}% of {formatCurrency(dept.budgetCap)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#2A2825] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${utilizationColor}`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4 text-xs text-muted">
                        <span>{dept.employeeCount} employee{dept.employeeCount !== 1 ? 's' : ''}</span>
                        <span>{dept.contractorCount} contractor{dept.contractorCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Row 3 -- Workers & Contractors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Employees */}
            <Card>
              <h3 className="font-display text-2xl font-medium text-foreground mb-4">
                Employees ({analysis.allEmployees.length})
              </h3>
              {analysis.allEmployees.length === 0 ? (
                <p className="text-sm text-muted py-4">No employees in this pipeline</p>
              ) : (
                <div className="space-y-2">
                  {analysis.allEmployees.map((emp, i) => (
                    <div
                      key={`${emp.walletAddress}-${i}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#1A1918] border border-[#2A2825]"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{emp.name}</p>
                        <p className="text-xs text-muted capitalize">{emp.schedule}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(emp.amount, emp.currency)}
                        </p>
                        <p className="text-xs text-muted">{emp.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Contractors */}
            <Card>
              <h3 className="font-display text-2xl font-medium text-foreground mb-4">
                Contractors ({analysis.allContractors.length})
              </h3>
              {analysis.allContractors.length === 0 ? (
                <p className="text-sm text-muted py-4">No contractors in this pipeline</p>
              ) : (
                <div className="space-y-2">
                  {analysis.allContractors.map((c, i) => (
                    <div
                      key={`${c.walletAddress}-${i}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#1A1918] border border-[#2A2825]"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted capitalize">{c.paymentType}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(c.amount, c.currency)}
                        </p>
                        <p className="text-xs text-muted">{c.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Row 4 -- Cost Distribution Pie */}
          {pieData.length > 0 && (
            <Card>
              <h3 className="font-display text-2xl font-medium text-foreground mb-4">
                Cost Distribution
              </h3>
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={500}
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={DEPT_COLORS[idx % DEPT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[200px]">
                  {pieData.map((entry, idx) => (
                    <div key={entry.name} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: DEPT_COLORS[idx % DEPT_COLORS.length] }}
                      />
                      <span className="text-sm text-muted flex-1">{entry.name}</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Row 5 -- Execution History */}
      {selectedId && (
        <Card>
          <h3 className="font-display text-2xl font-medium text-foreground mb-4">
            Execution History
          </h3>

          {historyLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!historyLoading && (!history?.executions || history.executions.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Clock className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No executions yet</p>
            </div>
          )}

          {!historyLoading && history?.executions && history.executions.length > 0 && (
            <div className="space-y-2">
              {history.executions.map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-[#1A1918] border border-[#2A2825]"
                >
                  <div className="flex items-center gap-4">
                    <StatusBadge status={exec.status} />
                    <div>
                      {exec.totalCost != null && (
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(exec.totalCost)}
                        </p>
                      )}
                      {exec.triggeredBy && (
                        <p className="text-xs text-muted">by {exec.triggeredBy}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground">{formatDateTime(exec.startedAt)}</p>
                    <p className="text-xs text-muted">{formatRelativeTime(exec.startedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
