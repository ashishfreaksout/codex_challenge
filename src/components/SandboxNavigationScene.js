import React from "react";
import { View } from "react-native";
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

  return (
    <Scene>
      <SkyBand />
      <Horizon>
        <HorizonTitle>{title}</HorizonTitle>
      </Horizon>
      <RoadPlane style={{ transform: [{ perspective: 820 }, { rotateX: "62deg" }] }}>
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
      <DriverCompass>
        <DriverArrow style={{ transform: [{ rotate: `${driverHeading || 0}deg` }] }}>
          <Navigation size={34} color={colors.white} fill={colors.accent} />
        </DriverArrow>
      </DriverCompass>
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
  top: 18%;
  height: 120px;
  align-items: center;
  justify-content: flex-start;
  background-color: rgba(148, 163, 184, 0.22);
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
  left: -18%;
  right: -18%;
  bottom: -18%;
  height: 76%;
  background-color: #334155;
  border-top-left-radius: 70px;
  border-top-right-radius: 70px;
  overflow: hidden;
`;

const RoadShoulder = styled.View`
  position: absolute;
  inset: 0;
  border-left-width: 44px;
  border-right-width: 44px;
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

const DriverCompass = styled.View`
  position: absolute;
  left: 50%;
  bottom: 28%;
  width: 70px;
  height: 70px;
  margin-left: -35px;
  border-radius: 35px;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.36);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.28);
`;

const DriverArrow = styled(View)`
  width: 46px;
  height: 46px;
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
