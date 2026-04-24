import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader
} from "@react-google-maps/api";
import styled from "styled-components/native";

import { MODERN_MAP_STYLE } from "../constants/mapStyle";
import { SAN_JOSE_CENTER } from "../constants/neighborhoods";
import { colors } from "../theme";

const containerStyle = {
  width: "100%",
  height: "100%"
};

export default function MapComponent({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  onMarkerPress
}) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <MapFallback>
        <FallbackText>Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to render Google Maps on web.</FallbackText>
      </MapFallback>
    );
  }

  return (
    <LoadedGoogleMap
      apiKey={apiKey}
      potholes={potholes}
      selectedPothole={selectedPothole}
      focusLocation={focusLocation}
      draftLocation={draftLocation}
      onMarkerPress={onMarkerPress}
    />
  );
}

function LoadedGoogleMap({
  apiKey,
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  onMarkerPress
}) {
  const mapRef = useRef(null);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    id: "san-jose-pothole-google-map"
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
        center={{ lat: SAN_JOSE_CENTER.latitude, lng: SAN_JOSE_CENTER.longitude }}
        zoom={12}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
        }}
      >
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
