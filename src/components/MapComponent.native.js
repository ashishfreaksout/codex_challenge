import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import styled from "styled-components/native";

import { MODERN_MAP_STYLE } from "../constants/mapStyle";
import { SAN_JOSE_INITIAL_REGION } from "../constants/neighborhoods";
import { colors } from "../theme";

export default function MapComponent({
  potholes,
  selectedPothole,
  focusLocation,
  draftLocation,
  onMarkerPress
}) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!focusLocation || !mapRef.current) {
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
  }, [focusLocation]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFillObject}
      initialRegion={SAN_JOSE_INITIAL_REGION}
      customMapStyle={MODERN_MAP_STYLE}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
      mapPadding={{ top: 158, right: 16, bottom: 152, left: 16 }}
    >
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
    </MapView>
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
