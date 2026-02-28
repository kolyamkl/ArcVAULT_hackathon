'use client';

import { memo, useId } from 'react';
import { EdgeProps, getSmoothStepPath } from 'reactflow';

/**
 * Custom edge that renders an electric-current effect:
 *
 * 1. A base path with a soft ambient glow.
 * 2. Multiple small energy particles that travel along the path at
 *    staggered speeds, creating an "electricity flowing through a wire" look.
 * 3. A pulsing glow filter so the whole edge breathes.
 */
function ElectricEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}: EdgeProps) {
  const uid = useId();
  const filterId = `electric-glow-${uid}`;
  const gradientId = `electric-grad-${uid}`;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const baseColor = (style?.stroke as string) ?? '#C9A962';
  const strokeWidth = (style?.strokeWidth as number) ?? 1.5;

  return (
    <>
      <defs>
        {/* Glow filter */}
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0
                    0.8 0.6 0 0 0
                    0 0 0.2 0 0
                    0 0 0 0.6 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Particle gradient — bright center fading out */}
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="40%" stopColor={baseColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={baseColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow layer — wider, blurred, low opacity */}
      <path
        d={edgePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={strokeWidth + 6}
        strokeOpacity={0.08}
        filter={`url(#${filterId})`}
        className="electric-edge-glow"
      />

      {/* Base wire */}
      <path
        id={`edge-path-${id}`}
        d={edgePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={strokeWidth}
        strokeOpacity={0.45}
        className="react-flow__edge-path"
        style={{
          filter: selected ? `drop-shadow(0 0 4px ${baseColor})` : undefined,
        }}
      />

      {/* Bright animated core — thinner, brighter line that pulses */}
      <path
        d={edgePath}
        fill="none"
        stroke={baseColor}
        strokeWidth={Math.max(1, strokeWidth - 0.5)}
        strokeOpacity={0.8}
        filter={`url(#${filterId})`}
        className="electric-edge-core"
      />

      {/* Energy particles flowing along the path */}
      {[0, 0.25, 0.5, 0.75].map((offset, i) => (
        <circle
          key={i}
          r={2.5 + (i % 2) * 0.5}
          fill={`url(#${gradientId})`}
          opacity={0}
        >
          <animateMotion
            dur={`${1.8 + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${offset * (1.8 + i * 0.4)}s`}
            path={edgePath}
          />
          <animate
            attributeName="opacity"
            values="0;0.9;1;0.9;0"
            dur={`${1.8 + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${offset * (1.8 + i * 0.4)}s`}
          />
          <animate
            attributeName="r"
            values={`${1.5 + (i % 2)};${3 + (i % 2)};${1.5 + (i % 2)}`}
            dur={`${1.8 + i * 0.4}s`}
            repeatCount="indefinite"
            begin={`${offset * (1.8 + i * 0.4)}s`}
          />
        </circle>
      ))}
    </>
  );
}

export const ElectricEdge = memo(ElectricEdgeComponent);
