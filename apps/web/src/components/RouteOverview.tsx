import type { CSSProperties } from "react";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";

import type { QuoteInput, RouteSystem, SolarSystem } from "../types";

type RouteOverviewProps = {
  activeColor: string;
  destinationColor: string;
  input: QuoteInput;
  routeSystems: RouteSystem[];
};

const starField = [
  [18, 96, 0.7], [47, 308, 1.1], [73, 58, 0.6], [96, 246, 0.8], [128, 151, 0.5],
  [152, 338, 0.7], [181, 84, 1.2], [213, 276, 0.5], [235, 37, 0.6], [267, 176, 0.8],
  [294, 354, 0.6], [322, 102, 1.0], [348, 254, 0.5], [371, 64, 0.7], [397, 316, 0.9],
  [421, 142, 0.5], [446, 228, 1.3], [475, 42, 0.6], [506, 292, 0.7], [531, 88, 0.5],
  [566, 372, 1.1], [589, 196, 0.6], [613, 121, 0.8], [642, 334, 0.5], [671, 52, 0.9],
  [704, 242, 0.6], [729, 392, 0.7], [758, 137, 1.0], [786, 286, 0.5], [815, 78, 0.8],
  [846, 366, 0.6], [874, 208, 1.2], [33, 372, 0.5], [112, 18, 0.7], [203, 408, 0.8],
  [287, 215, 0.6], [438, 386, 0.5], [493, 164, 0.7], [548, 28, 0.8], [697, 314, 0.5],
  [832, 32, 0.7], [858, 122, 0.5], [66, 188, 0.6], [169, 238, 0.5], [257, 123, 0.9],
  [333, 389, 0.5], [386, 181, 0.6], [462, 333, 0.7], [619, 266, 0.5], [738, 49, 0.6],
  [812, 251, 0.8], [884, 404, 0.5], [24, 24, 1.0], [142, 401, 0.6], [226, 311, 0.7],
  [319, 18, 0.5], [512, 414, 0.8], [575, 231, 0.5], [654, 174, 0.7], [766, 407, 0.6],
  [92, 498, 0.5], [185, 448, 0.7], [276, 531, 0.6], [371, 472, 0.5], [427, 518, 0.9],
  [538, 456, 0.6], [631, 526, 0.5], [703, 474, 0.7], [823, 521, 0.6], [872, 462, 0.5],
] as const;

export function RouteOverview({
  activeColor,
  destinationColor,
  input,
  routeSystems,
}: RouteOverviewProps) {
  const endpointsLocked = Boolean(input.pickup && input.destination);
  const routeNodes = useMemo(() => buildRouteNodes(routeSystems, input), [input, routeSystems]);
  const routePathPoints = useMemo(
    () => layoutRoutePoints(Math.max(routeNodes.length, 6), endpointsLocked),
    [endpointsLocked, routeNodes.length],
  );
  const routeNodePoints = useMemo(
    () => sampleRoutePoints(routePathPoints, routeNodes.length),
    [routePathPoints, routeNodes.length],
  );
  const pathSplitIndex = Math.max(0, Math.floor((routePathPoints.length - 1) / 2));
  const nodeSplitIndex = Math.max(0, Math.floor((routeNodes.length - 1) / 2));
  const routeServices = routeServiceLabels(input.pickup, input.destination);

  return (
    <section className="route-panel route-map-panel" id="route" aria-labelledby="route-overview-title">
      <div className="route-map-header">
        <h2 id="route-overview-title">Route Overview</h2>
      </div>
      <div className="route-visual">
        <div className="route-service-chip" aria-label="Active pickup service">
          {routeServices.map((service) => (
            <span key={service.label}>
              <i style={{ background: service.color }} />
              {service.label}
            </span>
          ))}
        </div>
        <svg
          aria-label="Route overview map"
          className="route-map"
          role="img"
          viewBox="0 0 900 560"
        >
          <defs>
            <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="map-stars">
            {starField.map(([x, y, r], index) => (
              <circle cx={x} cy={y} key={index} r={r} />
            ))}
          </g>

          <path className="route-arc route-arc-shadow" d={pointsToCurve(routePathPoints.slice(0, pathSplitIndex + 1))} />
          <path className="route-arc route-arc-shadow destination-segment" d={pointsToCurve(routePathPoints.slice(pathSplitIndex))} />
          <path className="route-arc pickup-segment" d={pointsToCurve(routePathPoints.slice(0, pathSplitIndex + 1))} />
          <path className="route-arc destination-segment" d={pointsToCurve(routePathPoints.slice(pathSplitIndex))} />

          {routeNodes.map((node, index) => {
            const point = routeNodePoints[index];

            return (
              <RouteNode
                color={index <= nodeSplitIndex ? activeColor : destinationColor}
                destination={index === routeNodes.length - 1}
                index={index}
                key={`${node.id}-${index}`}
                label={node.name}
                major={index === 0 || index === routeNodes.length - 1}
                security={node.securityDisplay ?? undefined}
                total={routeNodes.length}
                x={point.x}
                y={point.y}
              />
            );
          })}
        </svg>
        <button className="view-map-button" type="button">
          View on Map
          <ExternalLink size={17} />
        </button>
      </div>
    </section>
  );
}

function RouteNode({
  color,
  destination = false,
  index,
  label,
  major = false,
  security,
  total,
  x,
  y,
}: {
  color: string;
  destination?: boolean;
  index: number;
  label: string;
  major?: boolean;
  security?: string;
  total: number;
  x: number;
  y: number;
}) {
  const isRightLabel = major ? !destination : index % 2 === 0;
  const labelX = major ? (destination ? -98 : 24) : (isRightLabel ? 18 : -66);
  const labelY = major ? (destination ? 28 : -26) : -14;
  const secX = major ? (destination ? 20 : 24) : labelX;
  const secY = major ? (destination ? 28 : -8) : 2;
  const lastNodeOffset = index === total - 1 ? -4 : 0;

  return (
    <g
      className={`route-node ${major ? "route-node-major" : ""} ${destination ? "destination" : ""}`}
      style={{ "--node-accent": color } as CSSProperties}
      transform={`translate(${x} ${y})`}
    >
      <circle r={major ? 12 : 8} />
      <circle r={major ? 5.5 : 3.5} />
      <text className={`route-label ${major ? "route-label-major" : ""}`} x={labelX} y={labelY + lastNodeOffset}>
        {label}
      </text>
      {security ? (
        <text className="route-sec" x={secX} y={secY + lastNodeOffset}>
          {security}
        </text>
      ) : null}
    </g>
  );
}

function buildRouteNodes(routeSystems: RouteSystem[], input: QuoteInput) {
  const endpoints = [input.pickup, input.destination].filter((system): system is SolarSystem => Boolean(system));
  const source = routeSystems.length >= 2 ? routeSystems : endpoints;
  if (source.length === 0) {
    return [
      { id: 0, name: "Pick Up", securityDisplay: null },
      { id: 1, name: "Destination", securityDisplay: null },
    ];
  }

  const targetCount = Math.min(10, Math.max(2, source.length));
  const selected: RouteSystem[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.round((index * (source.length - 1)) / (targetCount - 1));
    selected.push(source[sourceIndex]);
  }

  return selected.filter((system, index, systems) => index === 0 || system.id !== systems[index - 1].id);
}

function layoutRoutePoints(count: number, arced: boolean) {
  const total = Math.max(2, count);

  return Array.from({ length: total }, (_, index) => {
    const progress = index / (total - 1);
    const x = 90 + progress * 720;
    const baseY = arced ? 335 : 280;
    const y = baseY - (arced ? Math.sin(progress * Math.PI) * 185 : 0);

    return { x, y };
  });
}

function sampleRoutePoints(points: { x: number; y: number }[], count: number) {
  if (count <= 1) {
    return points.slice(0, 1);
  }

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (count - 1));
    return points[sourceIndex];
  });
}

function pointsToCurve(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    const previous = points[index - 2] ?? points[index - 1];
    const current = points[index - 1];
    const next = point;
    const nextNext = points[index + 1] ?? next;
    const controlOne = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const controlTwo = {
      x: next.x - (nextNext.x - current.x) / 6,
      y: next.y - (nextNext.y - current.y) / 6,
    };

    return `${path} C ${controlOne.x.toFixed(1)} ${controlOne.y.toFixed(1)}, ${controlTwo.x.toFixed(1)} ${controlTwo.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }, "");
}

function routeServiceLabels(pickup: SolarSystem | null, destination: SolarSystem | null) {
  const pickupService = pickup?.serviceType ?? "No Pick Up";
  const destinationService = destination?.serviceType ?? pickupService;
  const pickupColor = pickup?.color ?? "#19a8ff";
  const destinationColor = destination?.color ?? pickupColor;

  if (pickupService === destinationService) {
    return [{ label: pickupService, color: pickupColor }];
  }

  return [
    { label: pickupService, color: pickupColor },
    { label: destinationService, color: destinationColor },
  ];
}
