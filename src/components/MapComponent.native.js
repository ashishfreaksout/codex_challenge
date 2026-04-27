import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Svg, { Circle as SvgCircle, Polygon as SvgPolygon } from "react-native-svg";
import styled from "styled-components/native";

import { MODERN_MAP_STYLE } from "../constants/mapStyle";
import { BAY_AREA_LOCATIONS, SAN_JOSE_INITIAL_REGION } from "../constants/neighborhoods";
import { fetchPredictiveMap } from "../services/predictiveMapApi";
import { colors } from "../theme";

const TILE_SIZE = 256;
const TILE_URL_TEMPLATE = "https://a.basemaps.cartocdn.com/light_all";
const FALLBACK_INITIAL_ZOOM = 10;
const FALLBACK_MIN_ZOOM = 9;
const FALLBACK_MAX_ZOOM = 17;
const NATIVE_PREDICTION_LIMIT = 900;
const NATIVE_VISIBLE_PREDICTION_LIMIT = 360;
const NATIVE_PREDICTION_MIN_SCORE = 0.5;

export default function MapComponent({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  driverLocation,
  driverHeading = 0,
  navigationMode = false,
  onMarkerPress,
  viewMode,
  predictionRefreshToken
}) {
  const nativeTileProvider = process.env.EXPO_PUBLIC_NATIVE_TILE_PROVIDER || "osm";
  const useOpenStreetMapTiles = nativeTileProvider !== "google";
  const predictionState = usePredictiveMap(viewMode, predictionRefreshToken);

  if (useOpenStreetMapTiles) {
    return (
      <NativeTileMap
        potholes={potholes}
        selectedPothole={selectedPothole}
        focusLocation={focusLocation}
        draftLocation={draftLocation}
        driverLocation={driverLocation}
        driverHeading={driverHeading}
        onMarkerPress={onMarkerPress}
        viewMode={viewMode}
        predictionState={predictionState}
      />
    );
  }

  return (
    <GoogleNativeMap
      potholes={potholes}
      selectedPothole={selectedPothole}
      focusLocation={focusLocation}
      draftLocation={draftLocation}
      driverLocation={driverLocation}
      driverHeading={driverHeading}
      navigationMode={navigationMode}
      onMarkerPress={onMarkerPress}
      viewMode={viewMode}
      predictionState={predictionState}
    />
  );
}

function GoogleNativeMap({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  driverLocation,
  driverHeading,
  navigationMode,
  onMarkerPress,
  viewMode,
  predictionState
}) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (navigationMode && driverLocation) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude
          },
          heading: driverHeading,
          pitch: 64,
          zoom: 18
        },
        { duration: 420 }
      );
      return;
    }

    if (!focusLocation) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude: focusLocation.latitude,
        longitude: focusLocation.longitude,
        latitudeDelta: focusLocation.latitudeDelta ?? 0.04,
        longitudeDelta: focusLocation.longitudeDelta ?? 0.04
      },
      650
    );
  }, [driverHeading, driverLocation, focusLocation, navigationMode]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      initialRegion={SAN_JOSE_INITIAL_REGION}
      customMapStyle={MODERN_MAP_STYLE}
      showsUserLocation
      showsMyLocationButton={false}
      showsBuildings={false}
      showsIndoors={false}
      showsPointsOfInterest={false}
      showsTraffic={false}
      pitchEnabled
      rotateEnabled
      scrollEnabled={!navigationMode}
      zoomEnabled={!navigationMode}
      toolbarEnabled={false}
      mapPadding={{ top: navigationMode ? 92 : 158, right: 16, bottom: 152, left: 16 }}
    >
      <NativeProbabilityLayer
        visible={viewMode === "predicted"}
        features={predictionState.features}
        projectCoordinate={(coordinate) => coordinate}
        googleMapMode
      />

      {potholes.map((pothole) => (
        <Marker
          key={pothole.id}
          coordinate={pothole.coordinate}
          anchor={{ x: 0.5, y: 0.82 }}
          onPress={() => onMarkerPress(pothole)}
        >
          <WarningTriangle selected={selectedPothole?.id === pothole.id} />
          <Callout tooltip>
            <CalloutCard>
              <CalloutTitle>{pothole.title}</CalloutTitle>
              <CalloutText>{pothole.address}</CalloutText>
            </CalloutCard>
          </Callout>
        </Marker>
      ))}

      {draftLocation ? (
        <Marker coordinate={draftLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <DraftPulse>
            <DraftCenter />
          </DraftPulse>
        </Marker>
      ) : null}

      {driverLocation ? (
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <DriverMarker heading={driverHeading} navigationMode={navigationMode} />
        </Marker>
      ) : null}
    </MapView>
  );
}

function NativeTileMap({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  driverLocation,
  driverHeading,
  onMarkerPress,
  viewMode,
  predictionState
}) {
  const [center, setCenter] = useState({
    latitude: SAN_JOSE_INITIAL_REGION.latitude,
    longitude: SAN_JOSE_INITIAL_REGION.longitude
  });
  const [zoom, setZoom] = useState(FALLBACK_INITIAL_ZOOM);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const centerRef = useRef(center);
  const panStartCenterRef = useRef(center);
  const zoomRef = useRef(zoom);
  const pinchStartDistanceRef = useRef(null);
  const pinchStartZoomRef = useRef(zoom);
  const isPanningRef = useRef(false);
  const panEndTimerRef = useRef(null);

  useEffect(() => {
    if (focusLocation) {
      setCenter({
        latitude: focusLocation.latitude,
        longitude: focusLocation.longitude
      });
      setZoom(zoomForRegion(focusLocation));
    }
  }, [focusLocation]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(
    () => () => {
      if (panEndTimerRef.current) {
        clearTimeout(panEndTimerRef.current);
      }
    },
    []
  );

  const centerPixel = useMemo(() => latLngToPixel(center, zoom), [center, zoom]);

  const tiles = useMemo(() => {
    if (!mapSize.width || !mapSize.height) {
      return [];
    }

    const tileCount = 2 ** zoom;
    const startX = Math.floor((centerPixel.x - mapSize.width / 2) / TILE_SIZE) - 1;
    const endX = Math.floor((centerPixel.x + mapSize.width / 2) / TILE_SIZE) + 1;
    const startY = Math.floor((centerPixel.y - mapSize.height / 2) / TILE_SIZE) - 1;
    const endY = Math.floor((centerPixel.y + mapSize.height / 2) / TILE_SIZE) + 1;
    const visibleTiles = [];

    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= tileCount) {
        continue;
      }

      for (let x = startX; x <= endX; x += 1) {
        const normalizedX = ((x % tileCount) + tileCount) % tileCount;
        visibleTiles.push({
          key: `${zoom}-${x}-${y}`,
          url: `${TILE_URL_TEMPLATE}/${zoom}/${normalizedX}/${y}.png`,
          left: x * TILE_SIZE - centerPixel.x + mapSize.width / 2,
          top: y * TILE_SIZE - centerPixel.y + mapSize.height / 2
        });
      }
    }

    return visibleTiles;
  }, [centerPixel, mapSize.height, mapSize.width, zoom]);

  const projectCoordinate = (coordinate) => {
    if (!mapSize.width || !mapSize.height) {
      return { left: -100, top: -100 };
    }

    const point = latLngToPixel(coordinate, zoom);
    return {
      left: point.x - centerPixel.x + mapSize.width / 2,
      top: point.y - centerPixel.y + mapSize.height / 2
    };
  };

  const visiblePredictionFeatures = useMemo(() => {
    if (viewMode !== "predicted" || !mapSize.width || !mapSize.height) {
      return [];
    }

    const buffer = 120;
    const visibleFeatures = [];

    for (const feature of predictionState.features) {
      const centerCoordinate = featureCenter(feature);
      if (!centerCoordinate) {
        continue;
      }

      const point = latLngToPixel(centerCoordinate, zoom);
      const left = point.x - centerPixel.x + mapSize.width / 2;
      const top = point.y - centerPixel.y + mapSize.height / 2;

      if (
        left >= -buffer &&
        left <= mapSize.width + buffer &&
        top >= -buffer &&
        top <= mapSize.height + buffer
      ) {
        visibleFeatures.push(feature);
      }

      if (visibleFeatures.length >= NATIVE_VISIBLE_PREDICTION_LIMIT) {
        break;
      }
    }

    return visibleFeatures;
  }, [
    centerPixel.x,
    centerPixel.y,
    mapSize.height,
    mapSize.width,
    predictionState.features,
    viewMode,
    zoom
  ]);

  const beginPan = () => {
    if (panEndTimerRef.current) {
      clearTimeout(panEndTimerRef.current);
    }

    if (!isPanningRef.current) {
      isPanningRef.current = true;
      setIsPanning(true);
    }
  };

  const finishPan = () => {
    if (panEndTimerRef.current) {
      clearTimeout(panEndTimerRef.current);
    }

    panEndTimerRef.current = setTimeout(() => {
      isPanningRef.current = false;
      setIsPanning(false);
    }, 120);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
        onMoveShouldSetPanResponder: (event, gestureState) =>
          event.nativeEvent.touches.length > 1 ||
          Math.abs(gestureState.dx) > 4 ||
          Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: (event) => {
          beginPan();
          panStartCenterRef.current = centerRef.current;
          const distance = touchDistance(event.nativeEvent.touches);
          pinchStartDistanceRef.current = distance;
          pinchStartZoomRef.current = zoomRef.current;
        },
        onPanResponderMove: (event, gestureState) => {
          if (!mapSize.width || !mapSize.height) {
            return;
          }

          const distance = touchDistance(event.nativeEvent.touches);
          if (distance) {
            if (!pinchStartDistanceRef.current) {
              pinchStartDistanceRef.current = distance;
              pinchStartZoomRef.current = zoomRef.current;
            }

            const scale = distance / pinchStartDistanceRef.current;
            const nextZoom = clamp(
              Math.round(pinchStartZoomRef.current + Math.log2(scale)),
              FALLBACK_MIN_ZOOM,
              FALLBACK_MAX_ZOOM
            );

            if (nextZoom !== zoomRef.current) {
              zoomRef.current = nextZoom;
              setZoom(nextZoom);
            }
            return;
          }

          const currentZoom = zoomRef.current;
          const startPixel = latLngToPixel(panStartCenterRef.current, currentZoom);
          setCenter(
            pixelToLatLng(
              {
                x: startPixel.x - gestureState.dx,
                y: startPixel.y - gestureState.dy
              },
              currentZoom
            )
          );
        },
        onPanResponderRelease: () => {
          pinchStartDistanceRef.current = null;
          finishPan();
        },
        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = null;
          finishPan();
        },
        onPanResponderTerminationRequest: () => true
      }),
    [mapSize.height, mapSize.width]
  );

  const increaseZoom = () => {
    setZoom((value) => {
      const nextZoom = clamp(value + 1, FALLBACK_MIN_ZOOM, FALLBACK_MAX_ZOOM);
      zoomRef.current = nextZoom;
      return nextZoom;
    });
  };

  const decreaseZoom = () => {
    setZoom((value) => {
      const nextZoom = clamp(value - 1, FALLBACK_MIN_ZOOM, FALLBACK_MAX_ZOOM);
      zoomRef.current = nextZoom;
      return nextZoom;
    });
  };

  return (
    <FallbackTileMap
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setMapSize((size) =>
          size.width === width && size.height === height ? size : { width, height }
        );
      }}
      {...panResponder.panHandlers}
    >
      <FallbackTileWorld>
        {tiles.map((tile) => (
          <FallbackMapTile
            key={tile.key}
            source={{ uri: tile.url }}
            $left={tile.left}
            $top={tile.top}
            resizeMode="cover"
          />
        ))}

        <NativeProbabilityLayer
          visible={viewMode === "predicted" && !isPanning}
          features={visiblePredictionFeatures}
          projectCoordinate={projectCoordinate}
          zoom={zoom}
        />

        {BAY_AREA_LOCATIONS.slice(0, 14).map((location) => {
          const position = projectCoordinate(location.coordinate);
          return (
            <NeighborhoodLabel
              key={location.id}
              $top={position.top}
              $left={position.left}
            >
              {location.name}
            </NeighborhoodLabel>
          );
        })}

        {focusLocation ? (
          <FocusRing
            $top={projectCoordinate(focusLocation).top}
            $left={projectCoordinate(focusLocation).left}
          />
        ) : null}

        {potholes.map((pothole) => {
          const position = projectCoordinate(pothole.coordinate);
          return (
            <FallbackMarkerButton
              key={pothole.id}
              $top={position.top}
              $left={position.left}
              onPress={() => onMarkerPress?.(pothole)}
            >
              <WarningTriangle selected={selectedPothole?.id === pothole.id} />
            </FallbackMarkerButton>
          );
        })}

        {draftLocation ? (
          <FallbackPin
            $top={projectCoordinate(draftLocation).top}
            $left={projectCoordinate(draftLocation).left}
          >
            <DraftPulse>
              <DraftCenter />
            </DraftPulse>
          </FallbackPin>
        ) : null}

        {driverLocation ? (
          <FallbackPin
            $top={projectCoordinate(driverLocation).top}
            $left={projectCoordinate(driverLocation).left}
          >
            <DriverMarker heading={driverHeading} navigationMode={false} />
          </FallbackPin>
        ) : null}
      </FallbackTileWorld>

      <FallbackZoomControl>
        <FallbackZoomButton onPress={increaseZoom}>
          <Plus size={24} color={colors.ink} strokeWidth={2.8} />
        </FallbackZoomButton>
        <FallbackZoomDivider />
        <FallbackZoomButton onPress={decreaseZoom}>
          <Minus size={24} color={colors.ink} strokeWidth={2.8} />
        </FallbackZoomButton>
        <FallbackZoomText>z{zoom}</FallbackZoomText>
      </FallbackZoomControl>

      {viewMode === "predicted" ? (
        <PredictionNotice>
          {predictionState.loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : null}
          <PredictionNoticeTitle>
            {predictionState.error ? "Prediction unavailable" : "AI probability hotspots"}
          </PredictionNoticeTitle>
          <PredictionNoticeText>
            {predictionState.error
              ? "Could not load the prediction service."
              : isPanning
                ? "Hotspots pause while moving the map."
                : `${visiblePredictionFeatures.length} visible risk cells from ${predictionState.features.length} loaded`}
          </PredictionNoticeText>
        </PredictionNotice>
      ) : null}

      <FallbackAttribution>© OpenStreetMap © CARTO</FallbackAttribution>
    </FallbackTileMap>
  );
}

function usePredictiveMap(viewMode, predictionRefreshToken) {
  const [state, setState] = useState({
    features: [],
    metadata: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (viewMode !== "predicted") {
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));

    fetchPredictiveMap({ minScore: NATIVE_PREDICTION_MIN_SCORE, limit: NATIVE_PREDICTION_LIMIT })
      .then((geojson) => {
        if (!cancelled) {
          setState({
            features: geojson.features || [],
            metadata: geojson.properties || null,
            loading: false,
            error: null
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            features: [],
            metadata: null,
            loading: false,
            error
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [predictionRefreshToken, viewMode]);

  return state;
}

function NativeProbabilityLayer({ features, projectCoordinate, visible, zoom = 10, googleMapMode = false }) {
  if (!visible || !features?.length || googleMapMode) {
    return null;
  }

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
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

function probabilityScore(feature) {
  return Number(feature.properties?.probability_score || 0);
}

function probabilityColor(score) {
  const clamped = Math.max(0, Math.min(Number(score) || 0, 1));
  const start = clamped < 0.5 ? [34, 197, 94] : [234, 179, 8];
  const end = clamped < 0.5 ? [234, 179, 8] : [239, 68, 68];
  const ratio = clamped < 0.5 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const [red, green, blue] = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * ratio)
  );

  return `rgb(${red}, ${green}, ${blue})`;
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

function latLngToPixel(coordinate, zoom) {
  const latitude = clamp(coordinate.latitude, -85.05112878, 85.05112878);
  const mapSize = TILE_SIZE * 2 ** zoom;
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((coordinate.longitude + 180) / 360) * mapSize,
    y:
      (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      mapSize
  };
}

function pixelToLatLng(point, zoom) {
  const mapSize = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / mapSize) * 360 - 180;
  const mercatorY = Math.PI - (2 * Math.PI * point.y) / mapSize;
  const latitude =
    (180 / Math.PI) * Math.atan((Math.exp(mercatorY) - Math.exp(-mercatorY)) / 2);

  return { latitude, longitude };
}

function zoomForRegion(region) {
  if (region.latitudeDelta && region.latitudeDelta < 0.02) {
    return 15;
  }

  if (region.latitudeDelta && region.latitudeDelta < 0.05) {
    return 14;
  }

  return FALLBACK_INITIAL_ZOOM;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function touchDistance(touches) {
  if (!touches || touches.length < 2) {
    return null;
  }

  const [first, second] = touches;
  const deltaX = first.pageX - second.pageX;
  const deltaY = first.pageY - second.pageY;
  return Math.hypot(deltaX, deltaY);
}

function DriverMarker({ heading, navigationMode }) {
  if (!navigationMode) {
    return (
      <DriverPulse>
        <DriverCenter />
      </DriverPulse>
    );
  }

  return (
    <DriverArrowShell style={{ transform: [{ rotate: `${heading}deg` }] }}>
      <DriverArrowTip />
      <DriverArrowTail />
    </DriverArrowShell>
  );
}

function WarningTriangle({ selected }) {
  const scale = selected ? 1.18 : 1;

  return (
    <TriangleBox style={{ transform: [{ scale }] }}>
      <TriangleShape />
      <TriangleMark>!</TriangleMark>
    </TriangleBox>
  );
}

const FallbackTileMap = styled.View`
  flex: 1;
  overflow: hidden;
  background-color: #e5edf4;
`;

const FallbackTileWorld = styled.View`
  position: absolute;
  inset: 0;
`;

const FallbackMapTile = styled.Image`
  position: absolute;
  left: ${({ $left }) => $left}px;
  top: ${({ $top }) => $top}px;
  width: ${TILE_SIZE}px;
  height: ${TILE_SIZE}px;
`;

const NeighborhoodLabel = styled.Text`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  margin-left: 8px;
  color: rgba(15, 23, 42, 0.58);
  font-size: 12px;
  font-weight: 800;
  text-shadow-color: rgba(255, 255, 255, 0.9);
  text-shadow-offset: 0px 1px;
  text-shadow-radius: 2px;
`;

const FocusRing = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 70px;
  height: 70px;
  margin-left: -35px;
  margin-top: -35px;
  border-radius: 35px;
  border-width: 2px;
  border-color: rgba(37, 99, 235, 0.55);
  background-color: rgba(37, 99, 235, 0.1);
`;

const FallbackMarkerButton = styled(Pressable)`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 46px;
  height: 44px;
  margin-left: -23px;
  margin-top: -36px;
  align-items: center;
  justify-content: center;
  z-index: 6;
`;

const FallbackPin = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  margin-left: -17px;
  margin-top: -17px;
  z-index: 7;
`;

const FallbackZoomControl = styled.View`
  position: absolute;
  right: 18px;
  top: 430px;
  width: 54px;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.94);
  border-width: 1px;
  border-color: rgba(15, 23, 42, 0.12);
  elevation: 3;
`;

const FallbackZoomButton = styled(Pressable)`
  height: 48px;
  align-items: center;
  justify-content: center;
`;

const FallbackZoomDivider = styled.View`
  height: 1px;
  background-color: rgba(15, 23, 42, 0.12);
`;

const FallbackZoomText = styled.Text`
  padding: 7px 0;
  color: ${colors.textMuted};
  font-size: 11px;
  font-weight: 900;
  text-align: center;
`;

const PredictionNotice = styled.View`
  position: absolute;
  left: 14px;
  bottom: 98px;
  max-width: 310px;
  padding: 10px 12px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.9);
  border-width: 1px;
  border-color: rgba(15, 23, 42, 0.1);
  gap: 3px;
  z-index: 9;
`;

const PredictionNoticeTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 13px;
  font-weight: 900;
`;

const PredictionNoticeText = styled.Text`
  color: ${colors.textMuted};
  font-size: 11px;
  font-weight: 700;
`;

const FallbackAttribution = styled.Text`
  position: absolute;
  left: 14px;
  bottom: 98px;
  padding: 4px 6px;
  border-radius: 4px;
  overflow: hidden;
  color: ${colors.textMuted};
  font-size: 10px;
  font-weight: 700;
  background-color: rgba(255, 255, 255, 0.82);
`;

const TriangleBox = styled(View)`
  width: 34px;
  height: 32px;
  align-items: center;
  justify-content: flex-start;
`;

const TriangleShape = styled(View)`
  width: 0;
  height: 0;
  border-left-width: 15px;
  border-right-width: 15px;
  border-bottom-width: 27px;
  border-left-color: transparent;
  border-right-color: transparent;
  border-bottom-color: ${colors.warning};
`;

const TriangleMark = styled(Text)`
  position: absolute;
  top: 8px;
  color: ${colors.white};
  font-size: 15px;
  font-weight: 900;
`;

const CalloutCard = styled.View`
  width: 220px;
  padding: 10px;
  border-radius: 8px;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
`;

const CalloutTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 14px;
  font-weight: 800;
`;

const CalloutText = styled.Text`
  color: ${colors.textMuted};
  font-size: 12px;
  margin-top: 4px;
`;

const DraftPulse = styled.View`
  width: 28px;
  height: 28px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: rgba(37, 99, 235, 0.2);
  border-width: 1px;
  border-color: rgba(37, 99, 235, 0.45);
`;

const DraftCenter = styled.View`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  background-color: ${colors.accent};
  border-width: 2px;
  border-color: ${colors.white};
`;

const DriverPulse = styled.View`
  width: 34px;
  height: 34px;
  border-radius: 17px;
  align-items: center;
  justify-content: center;
  background-color: rgba(37, 99, 235, 0.24);
  border-width: 2px;
  border-color: rgba(15, 23, 42, 0.78);
`;

const DriverCenter = styled.View`
  width: 14px;
  height: 14px;
  border-radius: 7px;
  background-color: ${colors.accent};
  border-width: 2px;
  border-color: ${colors.white};
`;

const DriverArrowShell = styled.View`
  width: 40px;
  height: 48px;
  align-items: center;
  justify-content: center;
`;

const DriverArrowTip = styled.View`
  width: 0;
  height: 0;
  border-left-width: 13px;
  border-right-width: 13px;
  border-bottom-width: 30px;
  border-left-color: transparent;
  border-right-color: transparent;
  border-bottom-color: ${colors.accent};
`;

const DriverArrowTail = styled.View`
  width: 13px;
  height: 16px;
  margin-top: -3px;
  border-radius: 5px;
  background-color: ${colors.accent};
  border-width: 2px;
  border-color: ${colors.white};
`;
