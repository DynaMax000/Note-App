import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { GraphData } from "../types";

interface GraphProps {
  data: GraphData;
  onNodeClick: (noteId: string) => void;
  theme: "light" | "dark";
  activeNoteId?: string;
}

export const Graph: React.FC<GraphProps> = ({
  data,
  onNodeClick,
  theme,
  activeNoteId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);

  // Recalculate node degrees for sizing
  const nodeDegrees = useMemo(() => {
    const degrees = new Map<string, number>();
    data.nodes.forEach((n) => degrees.set(n.id, 0));
    data.links.forEach((l) => {
      const s = typeof l.source === "object" ? (l.source as any).id : l.source;
      const t = typeof l.target === "object" ? (l.target as any).id : l.target;
      degrees.set(s, (degrees.get(s) || 0) + 1);
      degrees.set(t, (degrees.get(t) || 0) + 1);
    });
    return degrees;
  }, [data]);

  // Resize Observer to get accurate dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Separate effect for activeNoteId changes specifically to avoid full re-render
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Helper for Hover Highlight (Standard implementation)
    // Defined inside effect to share scope or we need to redefine?
    // Actually, we should define helpers outside effects or rely on d3 selection.

    // Logic for Active Note Prop Change:
    // - Remove previous active glows
    // - Apply new active glow
    // - DO NOT FADE others (unless hovering, but hover logic handles that)

    if (activeNoteId) {
      // Reset glows first (but don't reset opacity to 1 if we are hovering?
      // Actually, if activeNoteId changes, usually it's a click, so hover might have ended or is effectively irrelevant until mouse moves)

      // Safe to reset glows
      svg.selectAll("circle").attr("filter", null).attr("stroke", null);

      // Apply glow to active
      svg
        .select(`#node-${activeNoteId}`)
        .select("circle")
        .transition()
        .duration(200)
        .attr("filter", "url(#glow)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);
    } else {
      // No active note, remove glows
      svg.selectAll("circle").attr("filter", null).attr("stroke", null);
    }
  }, [activeNoteId]);

  // Main Effect for Graph Creation
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0)
      return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const container = svg.append("g");

    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });
    svg.call(zoom as any);

    const nodes = data.nodes.map((d) => ({ ...d }));
    const links = data.links.map((d) => ({ ...d }));

    // Markers and filters
    svg
      .append("defs")
      .selectAll("marker")
      .data(["end"])
      .enter()
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", theme === "dark" ? "#a1a1aa" : "#71717a");

    const defs = svg.select("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "2.5")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(150),
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d: any) => 12 + Math.sqrt(nodeDegrees.get(d.id) || 0) * 4),
      );

    simulationRef.current = simulation;
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const link = container
      .append("g")
      .attr("class", "links")
      .attr("stroke", theme === "dark" ? "#3f3f46" : "#e4e4e7")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    const node = container
      .append("g")
      .attr("class", "nodes")
      .attr("stroke", theme === "dark" ? "#18181b" : "#fff")
      .attr("stroke-width", 2)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("id", (d: any) => `node-${d.id}`)
      .call(drag(simulation) as any)
      .on("click", (event, d: any) => onNodeClick(d.id))
      .on("mouseenter", (event, d: any) => {
        // HOVER: Fade others, highlight connected
        const id = d.id;
        const highlightColor = "#8b5cf6";

        svg
          .selectAll(".nodes g")
          .transition()
          .duration(200)
          .style("opacity", (n: any) => {
            const isConnected = links.some(
              (l: any) =>
                (l.source.id === id && l.target.id === n.id) ||
                (l.target.id === id && l.source.id === n.id) ||
                n.id === id,
            );
            return isConnected ? 1 : 0.1;
          });

        svg
          .selectAll(".links line")
          .transition()
          .duration(200)
          .style("stroke-opacity", (l: any) =>
            l.source.id === id || l.target.id === id ? 1 : 0.05,
          )
          .style("stroke", (l: any) =>
            l.source.id === id || l.target.id === id
              ? highlightColor
              : theme === "dark"
                ? "#3f3f46"
                : "#e4e4e7",
          );

        svg
          .select(`#node-${id}`)
          .select("circle")
          .transition()
          .duration(200)
          .attr("filter", "url(#glow)");
      })
      .on("mouseleave", () => {
        // RESET: Restore opacity 1, restore colors.
        // BUT re-apply activeNoteId glow if exists.

        svg
          .selectAll(".nodes g")
          .transition()
          .duration(200)
          .style("opacity", 1);
        svg
          .selectAll(".links line")
          .transition()
          .duration(200)
          .style("stroke-opacity", 0.6)
          .style("stroke", theme === "dark" ? "#3f3f46" : "#e4e4e7");

        // Clear all filters first
        svg
          .selectAll("circle")
          .transition()
          .duration(200)
          .attr("filter", null)
          .attr("stroke", null);

        // Re-apply Active Note Glow
        if (activeNoteId) {
          svg
            .select(`#node-${activeNoteId}`)
            .select("circle")
            .transition()
            .duration(200)
            .attr("filter", "url(#glow)")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
        }
      });

    node
      .append("circle")
      .attr("r", (d: any) => 8 + Math.sqrt(nodeDegrees.get(d.id) || 0) * 3)
      .attr("fill", (d: any) => colorScale(String(d.group)))
      .attr("cursor", "pointer");

    node
      .append("text")
      .attr("x", (d: any) => 12 + Math.sqrt(nodeDegrees.get(d.id) || 0) * 3)
      .attr("y", 4)
      .text((d: any) => d.title)
      .attr("fill", theme === "dark" ? "#e4e4e7" : "#18181b")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .style("font-family", "Inter, sans-serif")
      .style("pointer-events", "none")
      .attr("stroke", "none")
      .style(
        "text-shadow",
        theme === "dark"
          ? "0 1px 2px rgba(0,0,0,0.8)"
          : "0 1px 2px rgba(255,255,255,0.8)",
      );

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => {
          const deltaX = d.target.x - d.source.x;
          const deltaY = d.target.y - d.source.y;
          const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dist === 0) return d.target.x;
          const t = 1 - 20 / dist;
          return d.source.x + deltaX * t;
        })
        .attr("y2", (d: any) => {
          const deltaX = d.target.x - d.source.x;
          const deltaY = d.target.y - d.source.y;
          const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (dist === 0) return d.target.y;
          const t = 1 - 20 / dist;
          return d.source.y + deltaY * t;
        });
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function drag(simulation: any) {
      return d3
        .drag()
        .on("start", (event: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on("drag", (event: any) => {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on("end", (event: any) => {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        });
    }

    // Initial highlight for activeNoteId (Glow only) - Wait for render
    if (activeNoteId) {
      setTimeout(() => {
        const s = d3.select(svgRef.current);
        s.select(`#node-${activeNoteId}`)
          .select("circle")
          .attr("filter", "url(#glow)")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);
      }, 100);
    }

    return () => {
      simulation.stop();
    };
  }, [data, theme, dimensions, nodeDegrees]); // Re-run if data changes

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ minHeight: "100%" }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="block cursor-grab active:cursor-grabbing"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};
