import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { serializeDecimals } from "@/lib/validations/api";

// GET /api/dashboard — aggregated dashboard statistics
export async function GET() {
  try {
    // Run all queries in parallel
    const [
      latestSnapshot,
      pendingPayoutsAgg,
      recentTransactions,
      budgetAgg,
    ] = await Promise.all([
      // Latest vault snapshot for treasury stats
      prisma.vaultSnapshot.findFirst({
        orderBy: { timestamp: "desc" },
      }),

      // Pending payouts aggregate: count and sum
      prisma.payout.aggregate({
        where: { status: "PENDING" },
        _count: true,
        _sum: { amount: true },
      }),

      // Most recent 10 transactions
      prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Budget aggregate stats
      prisma.budget.aggregate({
        where: { active: true },
        _sum: {
          totalAllocation: true,
          spent: true,
        },
      }),
    ]);

    const totalTreasuryValue = latestSnapshot
      ? Number(latestSnapshot.totalValue)
      : 0;
    const liquidUSDC = latestSnapshot
      ? Number(latestSnapshot.liquidUSDC)
      : 0;
    const usycBalance = latestSnapshot
      ? Number(latestSnapshot.usycBalance)
      : 0;
    const currentAPY = latestSnapshot ? Number(latestSnapshot.apy) : 0;
    const yieldAccrued30d = latestSnapshot
      ? Number(latestSnapshot.yieldAccrued)
      : 0;

    const pendingPayouts = pendingPayoutsAgg._count ?? 0;
    const pendingPayoutsValue = pendingPayoutsAgg._sum.amount
      ? Number(pendingPayoutsAgg._sum.amount)
      : 0;

    const totalBudgetAllocated = budgetAgg._sum.totalAllocation
      ? Number(budgetAgg._sum.totalAllocation)
      : 0;
    const totalBudgetSpent = budgetAgg._sum.spent
      ? Number(budgetAgg._sum.spent)
      : 0;

    return NextResponse.json({
      totalTreasuryValue,
      liquidUSDC,
      usycBalance,
      currentAPY,
      yieldAccrued30d,
      pendingPayouts,
      pendingPayoutsValue,
      totalBudgetAllocated,
      totalBudgetSpent,
      recentTransactions: recentTransactions.map(serializeDecimals),
    });
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
