import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { executePipeline } from "@/lib/pipeline-engine";

/**
 * GET /api/cron/process-delays
 *
 * Vercel Cron handler — runs every minute.
 * Finds DelaySchedule rows whose resumeAt has passed and resumes their executions.
 */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (standard pattern)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueDelays = await prisma.delaySchedule.findMany({
    where: {
      status: "WAITING",
      resumeAt: { lte: new Date() },
    },
  });

  if (dueDelays.length === 0) {
    return NextResponse.json({ ok: true, resumed: 0 });
  }

  const results = await Promise.allSettled(
    dueDelays.map(async (delay) => {
      // Mark the delay as resumed
      await prisma.delaySchedule.update({
        where: { id: delay.id },
        data: { status: "RESUMED" },
      });

      // Load the execution
      const execution = await prisma.pipelineExecution.findUnique({
        where: { id: delay.executionId },
        include: { pipeline: true },
      });

      if (!execution || execution.status !== "PAUSED") return;

      // Mark the paused step as completed in results
      const results = (execution.results as Record<string, unknown>) || {};
      const steps = (results.steps as Array<{ nodeId: string; status: string }>) || [];
      const step = steps.find((s) => s.nodeId === delay.nodeId);
      if (step) {
        step.status = "completed";
      }

      // Persist updated results and set status to RUNNING
      await prisma.pipelineExecution.update({
        where: { id: delay.executionId },
        data: {
          status: "RUNNING",
          results: { ...results, steps } as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });

      // Re-execute pipeline from where it left off
      await executePipeline(
        execution.pipeline,
        delay.executionId,
        execution.triggeredBy,
      );
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason));
    console.error("[cron/process-delays] Failures:", errors);
  }

  return NextResponse.json({ ok: true, resumed: succeeded, failed });
}
