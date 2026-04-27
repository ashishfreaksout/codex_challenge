import React, { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { Navigation } from "lucide-react-native";
import styled from "styled-components/native";

import { SANDBOX_3D_NAVIGATION_START } from "../constants/sandboxDriverRoute";
import { colors } from "../theme";

const HOTSPOTS = [
  { id: "downtown-core", latitude: 37.33375494071146, longitude: -121.8891582083744, score: 0.81 },
  { id: "san-carlos", latitude: 37.33375494071146, longitude: -121.88575744399904, score: 0.83 },
  { id: "south-second", latitude: 37.33106000718648, longitude: -121.88575744399904, score: 0.8 }
];

export default function SandboxNavigationScene({
  driverLocation,
  driverHeading,
  title = "Downtown San Jose",
  footerText = "3D navigation view"
}) {
  const origin = driverLocation || SANDBOX_3D_NAVIGATION_START;
  const hotspots = HOTSPOTS.map((hotspot) => projectHotspot(origin, hotspot));
  const [sceneZoom, setSceneZoom] = useState(1);
  const sceneZoomRef = useRef(sceneZoom);
  const pinchStartDistanceRef = useRef(null);
  const pinchStartZoomRef = useRef(sceneZoom);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
        onPanResponderGrant: (event) => {
          const distance = touchDistance(event.nativeEvent.touches);
          pinchStartDistanceRef.current = distance;
          pinchStartZoomRef.current = sceneZoomRef.current;
        },
        onPanResponderMove: (event) => {
          const distance = touchDistance(event.nativeEvent.touches);
          if (!distance) {
            return;
          }

          if (!pinchStartDistanceRef.current) {
            pinchStartDistanceRef.current = distance;
            pinchStartZoomRef.current = sceneZoomRef.current;
          }

          const nextZoom = clamp(
            pinchStartZoomRef.current * (distance / pinchStartDistanceRef.current),
            0.9,
            1.3
          );
          sceneZoomRef.current = nextZoom;
          setSceneZoom(nextZoom);
        },
        onPanResponderRelease: () => {
          pinchStartDistanceRef.current = null;
        },
        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = null;
        },
        onPanResponderTerminationRequest: () => true
      }),
    []
  );

  return (
    <Scene {...panResponder.panHandlers}>
      <SkyBand />
      <Horizon>
        <HorizonTitle>{title}</HorizonTitle>
      </Horizon>
      <RoadPlane
        style={{
          transform: [
            { perspective: 760 },
            { rotateX: "48deg" },
            { scale: sceneZoom }
          ]
        }}
      >
        <RoadShoulder />
        <LaneLine $left="36%" />
        <LaneLine $left="50%" />
        <LaneLine $left="64%" />
        {hotspots.map((hotspot) => (
          <Hotspot
            key={hotspot.id}
            style={{
              left: `${hotspot.left}%`,
              top: `${hotspot.top}%`,
              opacity: hotspot.opacity
            }}
          >
            <HotspotText>{Math.round(hotspot.score * 100)}%</HotspotText>
          </Hotspot>
        ))}
      </RoadPlane>
      <DriverDeck>
        <DriverShadow />
        <DriverArrow style={{ transform: [{ rotate: `${driverHeading || 0}deg` }] }}>
          <Navigation size={42} color={colors.white} fill={colors.accent} />
        </DriverArrow>
      </DriverDeck>
      <SceneFooter>
        <SceneFooterText>{footerText}</SceneFooterText>
      </SceneFooter>
    </Scene>
  );
}

function projectHotspot(origin, hotspot) {
  const metersPerDegreeLatitude = 111320;
  const metersPerDegreeLongitude =
    111320 * Math.cos((origin.latitude * Math.PI) / 180);
  const eastMeters = (hotspot.longitude - origin.longitude) * metersPerDegreeLongitude;
  const northMeters = (hotspot.latitude - origin.latitude) * metersPerDegreeLatitude;

  return {
    ...hotspot,
    left: clamp(50 + eastMeters / 7, 16, 84),
    top: clamp(72 - northMeters / 9, 14, 86),
    opacity: clamp(1 - Math.abs(eastMeters) / 850 - Math.max(0, -northMeters) / 500, 0.25, 0.85)
  };
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

const Scene = styled.View`
  flex: 1;
  overflow: hidden;
  background-color: #dbeafe;
`;

const SkyBand = styled.View`
  position: absolute;
  inset: 0;
  background-color: #dff3ff;
`;

const Horizon = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  top: 8%;
  height: 88px;
  align-items: center;
  justify-content: flex-start;
  background-color: rgba(148, 163, 184, 0.2);
  border-top-width: 1px;
  border-top-color: rgba(15, 23, 42, 0.1);
`;

const HorizonTitle = styled.Text`
  margin-top: 18px;
  color: rgba(15, 23, 42, 0.58);
  font-size: 18px;
  font-weight: 900;
`;

const RoadPlane = styled.View`
  position: absolute;
  left: -36%;
  right: -36%;
  bottom: -12%;
  height: 112%;
  background-color: #334155;
  border-top-left-radius: 92px;
  border-top-right-radius: 92px;
  overflow: hidden;
`;

const RoadShoulder = styled.View`
  position: absolute;
  inset: 0;
  border-left-width: 62px;
  border-right-width: 62px;
  border-left-color: rgba(241, 245, 249, 0.24);
  border-right-color: rgba(241, 245, 249, 0.24);
`;

const LaneLine = styled.View`
  position: absolute;
  left: ${({ $left }) => $left};
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: rgba(255, 255, 255, 0.52);
`;

const Hotspot = styled.View`
  position: absolute;
  width: 74px;
  height: 74px;
  margin-left: -37px;
  margin-top: -37px;
  border-radius: 37px;
  align-items: center;
  justify-content: center;
  background-color: rgba(249, 115, 22, 0.52);
  border-width: 2px;
  border-color: rgba(239, 68, 68, 0.74);
`;

const HotspotText = styled.Text`
  color: ${colors.white};
  font-size: 13px;
  font-weight: 900;
`;

const DriverDeck = styled.View`
  position: absolute;
  left: 50%;
  bottom: 34%;
  width: 84px;
  height: 84px;
  margin-left: -42px;
  align-items: center;
  justify-content: center;
`;

const DriverShadow = styled.View`
  position: absolute;
  width: 58px;
  height: 22px;
  border-radius: 29px;
  background-color: rgba(15, 23, 42, 0.24);
  bottom: 12px;
`;

const DriverArrow = styled(View)`
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
`;

const SceneFooter = styled.View`
  position: absolute;
  left: 18px;
  bottom: 96px;
  padding: 8px 10px;
  border-radius: 8px;
  background-color: rgba(15, 23, 42, 0.72);
`;

const SceneFooterText = styled.Text`
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 800;
`;
