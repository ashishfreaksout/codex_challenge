import React from "react";
import { CircleF, PolygonF } from "@react-google-maps/api";
import Svg, { Circle as SvgCircle, Polygon as SvgPolygon } from "react-native-svg";

const overlayStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 2
};

export default function ProbabilityGradientLayer({ features, projectCoordinate, visible, zoom = 10 }) {
  if (!visible || !features?.length) {
    return null;
  }

  return (
    <Svg width="100%" height="100%" style={overlayStyle} pointerEvents="none">
      {features.map((feature) => {
        const center = projectedFeatureCenter(feature, projectCoordinate);
        if (!center) {
          return null;
        }

        const score = probabilityScore(feature);
        const color = probabilityColor(score);
        const radius = haloRadiusPixels(score, zoom);

        if (radius <= 0) {
          return null;
        }

        return (
          <SvgCircle
            key={`${feature.id || feature.properties?.cell_id}-halo`}
            cx={center.left}
            cy={center.top}
            r={radius}
            fill={color}
            fillOpacity={0.16}
            stroke={color}
            strokeOpacity={0.24}
            strokeWidth={2}
          />
        );
      })}

      {features.map((feature) => {
        const points = polygonPoints(feature, projectCoordinate);
        if (!points) {
          return null;
        }

        const score = probabilityScore(feature);
        const color = probabilityColor(score);
        return (
          <SvgPolygon
            key={feature.id || feature.properties?.cell_id}
            points={points}
            fill={color}
            fillOpacity={0.38}
            stroke={color}
            strokeOpacity={0.58}
            strokeWidth={1}
          />
        );
      })}
    </Svg>
  );
}

export function GoogleProbabilityGradientLayer({ features, visible, zoom = 10 }) {
  if (!visible || !features?.length) {
    return null;
  }

  return features.flatMap((feature) => {
    const paths = googlePolygonPaths(feature);
    const center = featureCenter(feature);
    if (!paths || !center) {
      return [];
    }

    const score = probabilityScore(feature);
    const color = probabilityColor(score);
    const key = feature.id || feature.properties?.cell_id;
    const haloRadius = haloRadiusMeters(score, zoom);

    return [
      haloRadius > 0 ? <CircleF
        key={`${key}-halo`}
        center={{ lat: center.latitude, lng: center.longitude }}
        radius={haloRadius}
        options={{
          fillColor: color,
          fillOpacity: 0.16,
          strokeColor: color,
          strokeOpacity: 0.24,
          strokeWeight: 2,
          clickable: false,
          zIndex: 1
        }}
      /> : null,
      <PolygonF
        key={key}
          paths={paths}
          options={{
            fillColor: color,
          fillOpacity: 0.38,
            strokeColor: color,
          strokeOpacity: 0.58,
            strokeWeight: 1,
            clickable: false,
            zIndex: 2
        }}
      />
    ];
  }).filter(Boolean);
}

export function probabilityColor(score) {
  const clamped = Math.max(0, Math.min(Number(score) || 0, 1));
  const start = clamped < 0.5 ? [34, 197, 94] : [234, 179, 8];
  const end = clamped < 0.5 ? [234, 179, 8] : [239, 68, 68];
  const ratio = clamped < 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const [red, green, blue] = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * ratio)
  );

  return `rgb(${red}, ${green}, ${blue})`;
}

function polygonPoints(feature, projectCoordinate) {
  const ring = feature.geometry?.coordinates?.[0];

  if (!Array.isArray(ring) || !ring.length) {
    return null;
  }

  return ring
    .map(([longitude, latitude]) => {
      const point = projectCoordinate({ latitude, longitude });
      return `${point.left},${point.top}`;
    })
    .join(" ");
}

function googlePolygonPaths(feature) {
  const ring = feature.geometry?.coordinates?.[0];

  if (!Array.isArray(ring) || !ring.length) {
    return null;
  }

  return ring.map(([lng, lat]) => ({ lat, lng }));
}

function probabilityScore(feature) {
  return Number(feature.properties?.probability_score || 0);
}

function haloRadiusPixels(score, zoom) {
  if (zoom >= 13) {
    return 0;
  }

  if (zoom >= 12) {
    return 6 + score * 8;
  }

  if (zoom >= 10) {
    return 10 + score * 12;
  }

  return 14 + score * 16;
}

function haloRadiusMeters(score, zoom) {
  if (zoom >= 13) {
    return 0;
  }

  if (zoom >= 12) {
    return 80 + score * 100;
  }

  return 120 + score * 160;
}

function projectedFeatureCenter(feature, projectCoordinate) {
  const center = featureCenter(feature);
  return center ? projectCoordinate(center) : null;
}

function featureCenter(feature) {
  const center = feature.properties?.center;
  if (center?.latitude && center?.longitude) {
    return center;
  }

  const ring = feature.geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || !ring.length) {
    return null;
  }

  const uniquePoints = ring.slice(0, -1);
  const totals = uniquePoints.reduce(
    (accumulator, [longitude, latitude]) => ({
      latitude: accumulator.latitude + latitude,
      longitude: accumulator.longitude + longitude
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: totals.latitude / uniquePoints.length,
    longitude: totals.longitude / uniquePoints.length
  };
}
