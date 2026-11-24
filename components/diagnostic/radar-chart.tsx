"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type RadarChartProps = {
  labels: string[]
  /** One 0-100 value per label. */
  values: number[]
  className?: string
}

// The chart is drawn around (0, 0). Text is large in these units so it still reads when the chart shrinks on a phone.
const CENTER = 0
const RADIUS = 178
const LABEL_RADIUS = 214
const LABEL_SIZE = 22
const LINE_HEIGHT = 25
const RINGS = [0.25, 0.5, 0.75, 1]

function clamp(value: number) {
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

function pointAt(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
    angle,
  }
}

function polygonPoints(count: number, radius: number) {
  const points: string[] = []
  for (let i = 0; i < count; i++) {
    const point = pointAt(i, count, radius)
    points.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`)
  }
  return points.join(" ")
}

function textAnchor(angle: number): "start" | "end" | "middle" {
  const x = Math.cos(angle)
  if (x > 0.3) return "start"
  if (x < -0.3) return "end"
  return "middle"
}

/** Breaks a long axis label into short lines so it fits beside the chart. */
function wrapLabel(text: string, maxChars = 14) {
  const words = text.split(" ")
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    if (!line) {
      line = word
      continue
    }
    if (`${line} ${word}`.length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = `${line} ${word}`
    }
  }

  if (line) lines.push(line)
  return lines
}

/** A plain SVG radar: one axis per label, one filled shape for the values. */
export function RadarChart({ labels, values, className }: RadarChartProps) {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDrawn(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  if (labels.length < 3) return null

  const lineColor = "#102a43"
  const labelColor = "#334e68"
  const fillColor = "hsl(var(--teal))"

  const dataPoints: { x: number; y: number }[] = []
  const labelPoints: {
    x: number
    y: number
    anchor: "start" | "end" | "middle"
    text: string
    lines: string[]
  }[] = []

  for (let i = 0; i < labels.length; i++) {
    const value = clamp(values[i] ?? 0)
    // Draw at least 8% out so zero scores still join up into a shape instead of collapsing to the centre.
    const drawValue = Math.max(value, 8)
    const dataPoint = pointAt(i, labels.length, (drawValue / 100) * RADIUS)
    const labelPoint = pointAt(i, labels.length, LABEL_RADIUS)
    dataPoints.push({ x: dataPoint.x, y: dataPoint.y })
    labelPoints.push({
      x: labelPoint.x,
      y: labelPoint.y,
      anchor: textAnchor(labelPoint.angle),
      text: labels[i],
      lines: wrapLabel(labels[i]),
    })
  }

  const dataPolygon = dataPoints
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ")

  const description = labels
    .map((label, i) => `${label}: ${Math.round(clamp(values[i] ?? 0))}%`)
    .join(", ")

  return (
    <svg
      viewBox="-370 -250 740 510"
      role="img"
      aria-label="Skill profile by chapter"
      className={cn("mx-auto block w-full max-w-[640px]", className)}
    >
      <title>Skill profile by chapter</title>
      <desc>{description}</desc>

      {RINGS.map((ring) => {
        const radius = RADIUS * ring
        const outer = ring === 1
        return (
          <polygon
            key={ring}
            points={polygonPoints(labels.length, radius)}
            fill="none"
            stroke={lineColor}
            strokeOpacity={outer ? 0.45 : 0.14}
            strokeWidth={outer ? 1.5 : 1}
            strokeLinejoin="round"
          />
        )
      })}

      {labels.map((label, i) => {
        const end = pointAt(i, labels.length, RADIUS)
        return (
          <line
            key={label}
            x1={CENTER}
            y1={CENTER}
            x2={end.x}
            y2={end.y}
            stroke={lineColor}
            strokeOpacity={0.14}
            strokeWidth={1}
          />
        )
      })}

      <g
        style={{
          transformBox: "view-box",
          transformOrigin: "center",
          transform: drawn ? "scale(1)" : "scale(0.001)",
          transition: "transform 800ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="motion-reduce:transition-none"
      >
        <polygon
          points={dataPolygon}
          fill={fillColor}
          fillOpacity={0.3}
          stroke={fillColor}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        {dataPoints.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r={5} fill={fillColor} />
        ))}
      </g>

      {labelPoints.map((point, i) => {
        const lineCount = point.lines.length + 1
        const firstOffset = -((lineCount - 1) * LINE_HEIGHT) / 2
        return (
          <text
            key={point.text}
            x={point.x}
            y={point.y}
            textAnchor={point.anchor}
            dominantBaseline="middle"
            fill={labelColor}
            fontSize={LABEL_SIZE}
            fontWeight={600}
          >
            {point.lines.map((line, index) => (
              <tspan key={index} x={point.x} dy={index === 0 ? firstOffset : LINE_HEIGHT}>
                {line}
              </tspan>
            ))}
            <tspan x={point.x} dy={LINE_HEIGHT} fill={lineColor} fontWeight={600}>
              {Math.round(clamp(values[i] ?? 0))}%
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
