import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, Text, View } from "react-native";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader
} from "@react-google-maps/api";
import { Minus, Plus } from "lucide-react-native";
import styled from "styled-components/native";

import ProbabilityGradientLayer, {
  GoogleProbabilityGradientLayer
} from "./ProbabilityGradientLayer.web";
import { MODERN_MAP_STYLE } from "../constants/mapStyle";
import { BAY_AREA_CENTER, BAY_AREA_LOCATIONS } from "../constants/neighborhoods";
import {
  fetchPredictiveMap,
  predictiveMapRequestOptions,
  predictionServiceUrl
} from "../services/predictiveMapApi";
import { colors } from "../theme";

const containerStyle = {
  width: "100%",
  height: "100%"
};

const TILE_SIZE = 256;
const TILE_URL_TEMPLATE = "https://a.basemaps.cartocdn.com/light_all";
const FALLBACK_INITIAL_ZOOM = 10;
const FALLBACK_MIN_ZOOM = 9;
const FALLBACK_MAX_ZOOM = 17;

export default function MapComponent({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  driverLocation,
  driverHeading,
  navigationMode,
  onMarkerPress,
  viewMode,
  predictionRefreshToken
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const predictionState = usePredictiveMap(viewMode, predictionRefreshToken);

  if (!apiKey) {
    return (
      <FallbackPreviewMap
        potholes={potholes}
        selectedPothole={selectedPothole}
        draftLocation={draftLocation}
        driverLocation={driverLocation}
        driverHeading={driverHeading}
        navigationMode={navigationMode}
        focusLocation={focusLocation}
        onMarkerPress={onMarkerPress}
        viewMode={viewMode}
        predictionState={predictionState}
      />
    );
  }

  return (
    <LoadedGoogleMap
      apiKey={apiKey}
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

    fetchPredictiveMap(predictiveMapRequestOptions())
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

function LoadedGoogleMap({
  apiKey,
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
  const mapRef = useRef(null);
  const [googleZoom, setGoogleZoom] = useState(10);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "bay-area-pothole-google-map"
  });

  const mapOptions = useMemo(
    () => ({
      styles: MODERN_MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: "greedy",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    }),
    []
  );

  useEffect(() => {
    if (!focusLocation || !mapRef.current) {
      return;
    }

    mapRef.current.panTo({
      lat: focusLocation.latitude,
      lng: focusLocation.longitude
    });

    if (focusLocation.latitudeDelta && focusLocation.latitudeDelta < 0.02) {
      mapRef.current.setZoom(15);
    } else if (focusLocation.latitudeDelta && focusLocation.latitudeDelta < 0.05) {
      mapRef.current.setZoom(13);
    } else {
      mapRef.current.setZoom(12);
    }
  }, [focusLocation]);

  if (loadError) {
    return (
      <MapFallback>
        <FallbackText>Google Maps could not be loaded.</FallbackText>
      </MapFallback>
    );
  }

  if (!isLoaded) {
    return (
      <MapFallback>
        <ActivityIndicator color={colors.accent} />
      </MapFallback>
    );
  }

  const google = window.google;

  return (
    <View style={{ flex: 1 }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={{ lat: BAY_AREA_CENTER.latitude, lng: BAY_AREA_CENTER.longitude }}
        zoom={10}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
          setGoogleZoom(map.getZoom() || 10);
        }}
        onZoomChanged={() => {
          if (mapRef.current) {
            setGoogleZoom(mapRef.current.getZoom() || 10);
          }
        }}
      >
        <GoogleProbabilityGradientLayer
          visible={viewMode === "predicted"}
          features={predictionState.features}
          zoom={googleZoom}
        />

        {potholes.map((pothole) => (
          <MarkerF
            key={pothole.id}
            position={{
              lat: pothole.coordinate.latitude,
              lng: pothole.coordinate.longitude
            }}
            icon={createTriangleIcon(google)}
            onClick={() => onMarkerPress(pothole)}
          />
        ))}

        {draftLocation ? (
          <MarkerF
            position={{ lat: draftLocation.latitude, lng: draftLocation.longitude }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: colors.accent,
              fillOpacity: 1,
              strokeColor: colors.white,
              strokeWeight: 3
            }}
          />
        ) : null}

        {driverLocation ? (
          <MarkerF
            position={{ lat: driverLocation.latitude, lng: driverLocation.longitude }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: colors.accent,
              fillOpacity: 1,
              strokeColor: colors.ink,
              strokeWeight: 3
            }}
          />
        ) : null}

        {selectedPothole ? (
          <InfoWindowF
            position={{
              lat: selectedPothole.coordinate.latitude,
              lng: selectedPothole.coordinate.longitude
            }}
            onCloseClick={() => onMarkerPress(null)}
          >
            <div style={infoWindowStyle}>
              <strong>{selectedPothole.title}</strong>
              <span style={infoWindowAddressStyle}>{selectedPothole.address}</span>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>
      {viewMode === "predicted" ? <PredictionNotice predictionState={predictionState} /> : null}
    </View>
  );
}

function createTriangleIcon(google) {
  const fill = colors.warning;
  const svg = encodeURIComponent(`
    <svg width="36" height="34" viewBox="0 0 36 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2 L34 31 H2 Z" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
      <text x="18" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">!</text>
    </svg>
  `);

  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    scaledSize: new google.maps.Size(32, 30),
    anchor: new google.maps.Point(16, 27)
  };
}

function FallbackPreviewMap({
  potholes,
  selectedPothole,
  draftLocation,
  driverLocation,
  driverHeading,
  focusLocation,
  onMarkerPress,
  viewMode,
  predictionState
}) {
  const [center, setCenter] = useState(BAY_AREA_CENTER);
  const [zoom, setZoom] = useState(FALLBACK_INITIAL_ZOOM);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const centerRef = useRef(center);
  const panStartCenterRef = useRef(center);

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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          panStartCenterRef.current = centerRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          if (!mapSize.width || !mapSize.height) {
            return;
          }

          const startPixel = latLngToPixel(panStartCenterRef.current, zoom);
          setCenter(
            pixelToLatLng(
              {
                x: startPixel.x - gestureState.dx,
                y: startPixel.y - gestureState.dy
              },
              zoom
            )
          );
        },
        onPanResponderTerminationRequest: () => true
      }),
    [mapSize.height, mapSize.width, zoom]
  );

  const increaseZoom = () => {
    setZoom((value) => clamp(value + 1, FALLBACK_MIN_ZOOM, FALLBACK_MAX_ZOOM));
  };

  const decreaseZoom = () => {
    setZoom((value) => clamp(value - 1, FALLBACK_MIN_ZOOM, FALLBACK_MAX_ZOOM));
  };

  return (
    <FallbackMap
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setMapSize((size) =>
          size.width === width && size.height === height ? size : { width, height }
        );
      }}
      {...panResponder.panHandlers}
    >
      <FallbackWorld>
        {tiles.map((tile) => (
          <MapTile
            key={tile.key}
            source={{ uri: tile.url }}
            $left={tile.left}
            $top={tile.top}
            resizeMode="cover"
          />
        ))}

        <ProbabilityGradientLayer
          visible={viewMode === "predicted"}
          features={predictionState.features}
          projectCoordinate={projectCoordinate}
          zoom={zoom}
        />

        {BAY_AREA_LOCATIONS.slice(0, 12).map((location) => {
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

        {driverLocation ? (
          <DriverMarker
            $top={projectCoordinate(driverLocation).top}
            $left={projectCoordinate(driverLocation).left}
            style={{ transform: [{ rotate: `${driverHeading || 0}deg` }] }}
          >
            <DriverMarkerCenter />
          </DriverMarker>
        ) : null}

        {viewMode === "reported" ? potholes.map((pothole) => {
          const position = projectCoordinate(pothole.coordinate);
          const selected = selectedPothole?.id === pothole.id;

          return (
            <FallbackMarker
              key={pothole.id}
              $top={position.top}
              $left={position.left}
              $selected={selected}
              onPress={() => onMarkerPress(pothole)}
              accessibilityRole="button"
              accessibilityLabel={pothole.title}
            >
              <FallbackTriangle />
              <FallbackMarkerText>!</FallbackMarkerText>
            </FallbackMarker>
          );
        }) : null}

        {draftLocation ? (
          <DraftMarker
            $top={projectCoordinate(draftLocation).top}
            $left={projectCoordinate(draftLocation).left}
          >
            <DraftMarkerCenter />
          </DraftMarker>
        ) : null}
      </FallbackWorld>

      <ZoomControl>
        <ZoomButton
          onPress={increaseZoom}
          disabled={zoom >= FALLBACK_MAX_ZOOM}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          title="Zoom in"
        >
          <Plus size={19} color={zoom >= FALLBACK_MAX_ZOOM ? colors.textMuted : colors.textStrong} />
        </ZoomButton>
        <ZoomDivider />
        <ZoomButton
          onPress={decreaseZoom}
          disabled={zoom <= FALLBACK_MIN_ZOOM}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          title="Zoom out"
        >
          <Minus size={19} color={zoom <= FALLBACK_MIN_ZOOM ? colors.textMuted : colors.textStrong} />
        </ZoomButton>
        <ZoomLevel>z{zoom}</ZoomLevel>
      </ZoomControl>

      {viewMode === "predicted" ? (
        <PredictionNotice predictionState={predictionState} />
      ) : (
        <FallbackNotice>
          <FallbackNoticeTitle>OpenStreetMap preview</FallbackNoticeTitle>
          <FallbackNoticeText>Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to switch to Google Maps.</FallbackNoticeText>
        </FallbackNotice>
      )}
    </FallbackMap>
  );
}

function PredictionNotice({ predictionState }) {
  const modelLabel = predictionState.metadata?.model_version || "model pending";
  const sourceCount = predictionState.metadata?.data_sources?.length || 0;
  const isPostgisRoadRisk = modelLabel.includes("postgis-road-risk");
  const title = isPostgisRoadRisk ? "PostGIS road-risk segments" : "AI probability hotspots";
  const loadedText = isPostgisRoadRisk
    ? `${predictionState.features.length} road-risk features loaded from PostGIS.`
    : `${predictionState.features.length} weighted risk cells loaded from the prediction service.`;
  const sourceText = isPostgisRoadRisk
    ? `${modelLabel} using ${sourceCount} data source groups: 311 reports, OpenStreetMap roads, and PostGIS transformations.`
    : `${modelLabel} using ${sourceCount} data source groups: rainfall, drainage, pavement, traffic, and 311 history.`;

  return (
    <FallbackNotice>
      <FallbackNoticeTitle>{title}</FallbackNoticeTitle>
      <FallbackNoticeText>
        {predictionState.loading
          ? `Loading from ${predictionServiceUrl()}...`
          : predictionState.error
            ? `Start the prediction service at ${predictionServiceUrl()} to load hotspots.`
            : loadedText}
      </FallbackNoticeText>
      {!predictionState.loading && !predictionState.error ? (
        <FallbackNoticeText>{sourceText}</FallbackNoticeText>
      ) : null}
      <LegendRow>
        <LegendSwatch $color="#22c55e" />
        <LegendLabel>Low</LegendLabel>
        <LegendSwatch $color="#eab308" />
        <LegendLabel>Medium</LegendLabel>
        <LegendSwatch $color="#ef4444" />
        <LegendLabel>High</LegendLabel>
      </LegendRow>
    </FallbackNotice>
  );
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

const MapFallback = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background-color: ${colors.ink};
`;

const FallbackText = styled(Text)`
  color: ${colors.white};
  font-size: 15px;
  font-weight: 700;
  text-align: center;
`;

const FallbackMap = styled.View`
  flex: 1;
  overflow: hidden;
  background-color: #e5edf4;
`;

const FallbackWorld = styled.View`
  position: absolute;
  inset: 0;
`;

const MapTile = styled.Image`
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

const FallbackMarker = styled(Pressable)`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $selected }) => ($selected ? 38 : 32)}px;
  height: ${({ $selected }) => ($selected ? 36 : 30)}px;
  margin-left: ${({ $selected }) => ($selected ? -19 : -16)}px;
  margin-top: ${({ $selected }) => ($selected ? -31 : -26)}px;
  align-items: center;
  justify-content: flex-start;
  z-index: ${({ $selected }) => ($selected ? 5 : 3)};
`;

const FallbackTriangle = styled.View`
  width: 0;
  height: 0;
  border-left-width: 15px;
  border-right-width: 15px;
  border-bottom-width: 27px;
  border-left-color: transparent;
  border-right-color: transparent;
  border-bottom-color: ${colors.warning};
`;

const FallbackMarkerText = styled.Text`
  position: absolute;
  top: 7px;
  color: ${colors.white};
  font-size: 15px;
  font-weight: 900;
`;

const DraftMarker = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -14px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  background-color: rgba(37, 99, 235, 0.2);
  border-width: 1px;
  border-color: rgba(37, 99, 235, 0.45);
  z-index: 4;
`;

const DraftMarkerCenter = styled.View`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  background-color: ${colors.accent};
  border-width: 2px;
  border-color: ${colors.white};
`;

const DriverMarker = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: 34px;
  height: 34px;
  margin-left: -17px;
  margin-top: -17px;
  border-radius: 17px;
  align-items: center;
  justify-content: center;
  background-color: rgba(37, 99, 235, 0.24);
  border-width: 2px;
  border-color: rgba(15, 23, 42, 0.78);
  z-index: 7;
`;

const DriverMarkerCenter = styled.View`
  width: 14px;
  height: 14px;
  border-radius: 7px;
  background-color: ${colors.accent};
  border-width: 2px;
  border-color: ${colors.white};
`;

const ZoomControl = styled.View`
  position: absolute;
  right: 18px;
  top: 48%;
  width: 46px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.94);
  border-width: 1px;
  border-color: ${colors.border};
  overflow: hidden;
  z-index: 8;
`;

const ZoomButton = styled(Pressable)`
  width: 44px;
  height: 42px;
  align-items: center;
  justify-content: center;
`;

const ZoomDivider = styled.View`
  height: 1px;
  background-color: ${colors.border};
`;

const ZoomLevel = styled.Text`
  padding: 5px 0 6px;
  color: ${colors.textMuted};
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  border-top-width: 1px;
  border-top-color: ${colors.border};
`;

const FallbackNotice = styled.View`
  position: absolute;
  left: 14px;
  bottom: 82px;
  max-width: 340px;
  padding: 10px 12px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.9);
  border-width: 1px;
  border-color: ${colors.border};
`;

const FallbackNoticeTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 13px;
  font-weight: 900;
`;

const FallbackNoticeText = styled.Text`
  color: ${colors.textMuted};
  font-size: 12px;
  margin-top: 2px;
`;

const LegendRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
`;

const LegendSwatch = styled.View`
  width: 22px;
  height: 8px;
  border-radius: 4px;
  background-color: ${({ $color }) => $color};
  opacity: 0.7;
`;

const LegendLabel = styled.Text`
  color: ${colors.textMuted};
  font-size: 11px;
  font-weight: 800;
`;

const infoWindowStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: 220,
  color: colors.textStrong
};

const infoWindowAddressStyle = {
  color: colors.textMuted,
  fontSize: 12
};
