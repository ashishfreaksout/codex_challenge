import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StatusBar as RNStatusBar
} from "react-native";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  MapPin,
  Navigation,
  Play,
  Plus,
  Square,
  X
} from "lucide-react-native";
import styled from "styled-components/native";

import MapComponent from "./src/components/MapComponent";
import ReportPotholeModal from "./src/components/ReportPotholeModal";
import SandboxNavigationScene from "./src/components/SandboxNavigationScene";
import SearchBar from "./src/components/SearchBar";
import StatusFilter from "./src/components/StatusFilter";
import ViewModeSwitch from "./src/components/ViewModeSwitch";
import { BAY_AREA_CENTER } from "./src/constants/neighborhoods";
import {
  SANDBOX_3D_NAVIGATION_HEADING,
  SANDBOX_3D_NAVIGATION_MOVE_METERS,
  SANDBOX_3D_NAVIGATION_START,
  SANDBOX_3D_NAVIGATION_TURN_DEGREES,
  SANDBOX_DRIVER_ROUTE,
  SANDBOX_DRIVER_STEP_MS
} from "./src/constants/sandboxDriverRoute";
import {
  createPotholeReport,
  subscribeToPotholes
} from "./src/services/potholeRepository";
import {
  fetchHighRiskPredictionNearLocation,
  notifyPredictionService
} from "./src/services/predictiveMapApi";
import { colors, radii, shadows } from "./src/theme";

const statusBarOffset = Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0;
const RISK_ALERT_DURATION_MS = 7500;
const RISK_ALERT_COOLDOWN_MS = 65000;
const isDevelopmentRuntime = typeof __DEV__ !== "undefined" && __DEV__;
const sandbox3DNavigationEnabled =
  process.env.EXPO_PUBLIC_ENABLE_3D_SANDBOX_NAVIGATION === "true";
const sandboxDriverEnabled =
  sandbox3DNavigationEnabled ||
  isDevelopmentRuntime ||
  process.env.EXPO_PUBLIC_ENABLE_SANDBOX_DRIVER === "true";

export default function App() {
  const [potholes, setPotholes] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [draftLocation, setDraftLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [viewMode, setViewMode] = useState("reported");
  const [predictionRefreshToken, setPredictionRefreshToken] = useState(0);
  const [driverRiskAlert, setDriverRiskAlert] = useState(null);
  const [sandboxDriverActive, setSandboxDriverActive] = useState(false);
  const [sandboxDriverLocation, setSandboxDriverLocation] = useState(null);
  const [sandboxNavigationActive, setSandboxNavigationActive] = useState(sandbox3DNavigationEnabled);
  const [sandboxNavigationLocation, setSandboxNavigationLocation] = useState(null);
  const [sandboxNavigationHeading, setSandboxNavigationHeading] = useState(
    SANDBOX_3D_NAVIGATION_HEADING
  );
  const driverAlertTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const sandboxNavigationLocationRef = useRef(null);
  const sandboxNavigationHeadingRef = useRef(SANDBOX_3D_NAVIGATION_HEADING);
  const lastRiskAlertAtRef = useRef(0);
  const lastRiskCellRef = useRef(null);
  const riskCheckInFlightRef = useRef(false);

  const scheduleDriverAlertDismiss = useCallback(() => {
    if (driverAlertTimerRef.current) {
      clearTimeout(driverAlertTimerRef.current);
    }

    driverAlertTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setDriverRiskAlert(null);
      }
    }, RISK_ALERT_DURATION_MS);
  }, []);

  const runDriverRiskCheck = useCallback(
    async (
      coordinate,
      { force = false, source = "live", latitudeDelta = 0.012, longitudeDelta = 0.012 } = {}
    ) => {
      if (riskCheckInFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (!force && now - lastRiskAlertAtRef.current < RISK_ALERT_COOLDOWN_MS) {
        return;
      }

      riskCheckInFlightRef.current = true;
      try {
        const highRiskFeature = await fetchHighRiskPredictionNearLocation(coordinate, {
          latitudeDelta,
          longitudeDelta
        });
        const cellId = highRiskFeature?.properties?.cell_id;
        if (!mountedRef.current || !highRiskFeature || (!force && cellId === lastRiskCellRef.current)) {
          return;
        }

        lastRiskAlertAtRef.current = now;
        lastRiskCellRef.current = cellId;
        setDriverRiskAlert({
          id: cellId,
          score: Number(highRiskFeature.properties?.probability_score || 0),
          region: highRiskFeature.properties?.environment_source_region || coordinate.label || "this area",
          source
        });
        scheduleDriverAlertDismiss();
      } catch (error) {
        console.warn("Driver pothole risk check skipped:", error.message);
      } finally {
        riskCheckInFlightRef.current = false;
      }
    },
    [scheduleDriverAlertDismiss]
  );

  const updateSandboxNavigation = useCallback(
    (coordinate, heading, { checkRisk = true } = {}) => {
      const nextLocation = {
        ...coordinate,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
        label: coordinate.label || "Downtown San Jose"
      };
      const normalizedHeading = normalizeHeading(heading);

      sandboxNavigationLocationRef.current = nextLocation;
      sandboxNavigationHeadingRef.current = normalizedHeading;
      setSandboxNavigationLocation(nextLocation);
      setSandboxNavigationHeading(normalizedHeading);
      setSandboxDriverLocation(null);
      setMapFocus({
        ...nextLocation,
        heading: normalizedHeading,
        pitch: 64,
        navigationMode: true
      });
      setViewMode("predicted");
      setSelectedPothole(null);

      if (checkRisk) {
        runDriverRiskCheck(nextLocation, {
          force: true,
          source: "sandbox3d",
          latitudeDelta: 0.0022,
          longitudeDelta: 0.0022
        });
      }
    },
    [runDriverRiskCheck]
  );

  const startSandboxNavigation = useCallback(() => {
    setSandboxDriverActive(false);
    setSandboxNavigationActive(true);
    updateSandboxNavigation(
      {
        ...SANDBOX_3D_NAVIGATION_START,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003
      },
      SANDBOX_3D_NAVIGATION_HEADING
    );
  }, [updateSandboxNavigation]);

  const stopSandboxNavigation = useCallback(() => {
    setSandboxNavigationActive(false);
    setSandboxNavigationLocation(null);
    sandboxNavigationLocationRef.current = null;
  }, []);

  const handleSandboxNavigationControl = useCallback(
    (action) => {
      const currentLocation =
        sandboxNavigationLocationRef.current || {
          ...SANDBOX_3D_NAVIGATION_START,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003
        };
      const currentHeading = sandboxNavigationHeadingRef.current;

      if (action === "left" || action === "right") {
        const turn =
          action === "left"
            ? -SANDBOX_3D_NAVIGATION_TURN_DEGREES
            : SANDBOX_3D_NAVIGATION_TURN_DEGREES;
        updateSandboxNavigation(currentLocation, currentHeading + turn, { checkRisk: false });
        return;
      }

      const distance =
        action === "reverse"
          ? -SANDBOX_3D_NAVIGATION_MOVE_METERS
          : SANDBOX_3D_NAVIGATION_MOVE_METERS;
      const nextLocation = moveCoordinate(currentLocation, currentHeading, distance);
      updateSandboxNavigation(nextLocation, currentHeading);
    },
    [updateSandboxNavigation]
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (driverAlertTimerRef.current) {
        clearTimeout(driverAlertTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPotholes(setPotholes);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (sandbox3DNavigationEnabled) {
      startSandboxNavigation();
    }
  }, [startSandboxNavigation]);

  useEffect(() => {
    let locationSubscription = null;
    let mounted = true;

    async function startDriverRiskAlerts() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted || status !== "granted") {
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 120,
            timeInterval: 15000
          },
          ({ coords }) => {
            runDriverRiskCheck({
              latitude: coords.latitude,
              longitude: coords.longitude
            });
          }
        );
      } catch (error) {
        console.warn("Driver location alerts unavailable:", error.message);
      }
    }

    startDriverRiskAlerts();

    return () => {
      mounted = false;
      locationSubscription?.remove();
    };
  }, [runDriverRiskCheck]);

  useEffect(() => {
    if (!sandboxDriverActive || sandboxNavigationActive) {
      setSandboxDriverLocation(null);
      return undefined;
    }

    let routeIndex = 0;

    const moveToNextSandboxPoint = () => {
      const point = SANDBOX_DRIVER_ROUTE[routeIndex % SANDBOX_DRIVER_ROUTE.length];
      routeIndex += 1;

      const coordinate = {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
        label: point.label
      };

      setSandboxDriverLocation(coordinate);
      setMapFocus(coordinate);
      setViewMode("predicted");
      setSelectedPothole(null);
      runDriverRiskCheck(coordinate, { force: true, source: "sandbox" });
    };

    moveToNextSandboxPoint();
    const interval = setInterval(moveToNextSandboxPoint, SANDBOX_DRIVER_STEP_MS);

    return () => {
      clearInterval(interval);
    };
  }, [runDriverRiskCheck, sandboxDriverActive, sandboxNavigationActive]);

  const filteredPotholes = useMemo(() => {
    if (statusFilter === "all") {
      return potholes;
    }

    return potholes.filter((pothole) => pothole.status === statusFilter);
  }, [potholes, statusFilter]);

  const counts = useMemo(
    () => ({
      all: potholes.length,
      reported: potholes.filter((pothole) => pothole.status === "reported").length,
      fixed: potholes.filter((pothole) => pothole.status === "fixed").length
    }),
    [potholes]
  );

  const handleNeighborhoodSelect = (neighborhood) => {
    Keyboard.dismiss();
    setMapFocus({
      ...neighborhood.coordinate,
      latitudeDelta: 0.035,
      longitudeDelta: 0.035,
      label: neighborhood.name
    });
  };

  const handleReportPress = async () => {
    setIsCapturingLocation(true);
    setLocationMessage("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        const fallback = {
          ...BAY_AREA_CENTER,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        };
        setDraftLocation(fallback);
        setMapFocus(fallback);
        setLocationMessage(
          "Location permission was not granted, so the draft report is pinned to the Bay Area map center."
        );
        setReportVisible(true);
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const coordinate = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      };

      setDraftLocation(coordinate);
      setMapFocus(coordinate);
      setReportVisible(true);
    } catch (error) {
      Alert.alert(
        "Location unavailable",
        "Your GPS location could not be captured. A draft report will be placed at the Bay Area map center."
      );
      const fallback = {
        ...BAY_AREA_CENTER,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02
      };
      setDraftLocation(fallback);
      setMapFocus(fallback);
      setLocationMessage("GPS was unavailable, so the draft report is pinned to the Bay Area map center.");
      setReportVisible(true);
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const handleSubmitReport = ({ severity, notes }) => {
    const report = createPotholeReport({
      coordinate: draftLocation || BAY_AREA_CENTER,
      severity,
      notes
    });

    setSelectedPothole(report);
    setMapFocus({
      ...report.coordinate,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015
    });
    setReportVisible(false);
    setDraftLocation(null);
    setLocationMessage("");

    notifyPredictionService(report)
      .then(() => {
        setPredictionRefreshToken(Date.now());
      })
      .catch((error) => {
        console.warn("Prediction service update skipped:", error.message);
      });
  };

  const handleCloseReport = () => {
    setReportVisible(false);
    setDraftLocation(null);
    setLocationMessage("");
  };

  const activeDriverLocation = sandboxNavigationActive
    ? sandboxNavigationLocation
    : sandboxDriverLocation;
  const useSandboxNavigationScene =
    sandboxNavigationActive && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <Screen>
      <StatusBar style="light" translucent />
      {useSandboxNavigationScene ? (
        <SandboxNavigationScene
          driverLocation={activeDriverLocation}
          driverHeading={sandboxNavigationHeading}
        />
      ) : (
        <MapComponent
          potholes={viewMode === "reported" ? filteredPotholes : []}
          selectedPothole={selectedPothole}
          focusLocation={mapFocus}
          draftLocation={reportVisible ? draftLocation : null}
          driverLocation={activeDriverLocation}
          driverHeading={sandboxNavigationHeading}
          navigationMode={sandboxNavigationActive}
          onMarkerPress={setSelectedPothole}
          viewMode={viewMode}
          predictionRefreshToken={predictionRefreshToken}
        />
      )}

      {sandboxNavigationActive ? (
        <NavigationHud $top={statusBarOffset + 12}>
          <NavigationHudIcon>
            <Navigation size={18} color={colors.white} />
          </NavigationHudIcon>
          <NavigationHudCopy>
            <NavigationHudTitle>3D sandbox navigation</NavigationHudTitle>
            <NavigationHudText>
              Heading {Math.round(sandboxNavigationHeading)} deg near Downtown San Jose
            </NavigationHudText>
          </NavigationHudCopy>
        </NavigationHud>
      ) : (
        <TopOverlay $top={statusBarOffset + 12}>
          <SearchBar onSelectNeighborhood={handleNeighborhoodSelect} />
          <ViewModeSwitch
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              setSelectedPothole(null);
            }}
          />
          {viewMode === "reported" ? (
            <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={counts} />
          ) : null}
        </TopOverlay>
      )}

      {selectedPothole && viewMode === "reported" ? (
        <DetailsPanel>
          <DetailsHeader>
            <StatusPill $status={selectedPothole.status}>
              <StatusDot $status={selectedPothole.status} />
              <StatusPillText>{selectedPothole.status}</StatusPillText>
            </StatusPill>
            <IconButton onPress={() => setSelectedPothole(null)} accessibilityLabel="Close details">
              <X size={18} color={colors.textStrong} />
            </IconButton>
          </DetailsHeader>
          <DetailsTitle>{selectedPothole.title}</DetailsTitle>
          <DetailsMeta>
            <MapPin size={15} color={colors.textMuted} />
            <DetailsMetaText>{selectedPothole.address}</DetailsMetaText>
          </DetailsMeta>
          <DetailsRow>
            <DetailsLabel>Severity</DetailsLabel>
            <DetailsValue>{selectedPothole.severity}</DetailsValue>
          </DetailsRow>
          <DetailsRow>
            <DetailsLabel>Source</DetailsLabel>
            <DetailsValue>{selectedPothole.source}</DetailsValue>
          </DetailsRow>
          {selectedPothole.notes ? <DetailsNotes>{selectedPothole.notes}</DetailsNotes> : null}
        </DetailsPanel>
      ) : null}

      {driverRiskAlert ? (
        <DriverAlertPanel
          $bottom={
            sandboxNavigationActive
              ? 210
              : viewMode === "predicted"
                ? 210
                : selectedPothole && viewMode === "reported"
                  ? 260
                  : 98
          }
        >
          <DriverAlertIcon>
            <AlertTriangle size={20} color={colors.white} />
          </DriverAlertIcon>
          <DriverAlertCopy>
            <DriverAlertTitle>
              {driverRiskAlert.source === "sandbox3d"
                ? "Caution: high pothole probability"
                : driverRiskAlert.source === "sandbox"
                ? "Sandbox high-risk road area"
                : "High pothole probability nearby"}
            </DriverAlertTitle>
            <DriverAlertText>
              AI model flagged {driverRiskAlert.region} at {Math.round(driverRiskAlert.score * 100)}%
              probability; drive carefully through this road area.
            </DriverAlertText>
          </DriverAlertCopy>
          <IconButton onPress={() => setDriverRiskAlert(null)} accessibilityLabel="Dismiss risk alert">
            <X size={16} color={colors.textStrong} />
          </IconButton>
        </DriverAlertPanel>
      ) : null}

      {!sandboxNavigationActive ? (
        <Fab
          onPress={handleReportPress}
          disabled={isCapturingLocation}
          accessibilityRole="button"
          accessibilityLabel="Report pothole"
        >
          {isCapturingLocation ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Plus size={22} color={colors.white} />
              <FabText>Report</FabText>
            </>
          )}
        </Fab>
      ) : null}

      {!sandboxNavigationActive ? (
        <LocateButton
          onPress={() =>
            setMapFocus({
              ...BAY_AREA_CENTER,
              latitudeDelta: 0.78,
              longitudeDelta: 0.9
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Center on Bay Area"
        >
          <Crosshair size={20} color={colors.textStrong} />
        </LocateButton>
      ) : null}

      {sandboxNavigationActive ? (
        <NavigationExitButton
          onPress={stopSandboxNavigation}
          accessibilityRole="button"
          accessibilityLabel="Exit 3D navigation sandbox"
        >
          <X size={16} color={colors.white} />
          <NavigationExitText>Exit 3D</NavigationExitText>
        </NavigationExitButton>
      ) : null}

      {sandboxNavigationActive ? (
        <JoystickPanel>
          <JoystickGrid>
            <JoystickSpacer />
            <JoystickButton
              onPress={() => handleSandboxNavigationControl("forward")}
              accessibilityRole="button"
              accessibilityLabel="Move forward"
            >
              <ChevronUp size={25} color={colors.white} />
            </JoystickButton>
            <JoystickSpacer />
            <JoystickButton
              onPress={() => handleSandboxNavigationControl("left")}
              accessibilityRole="button"
              accessibilityLabel="Turn left"
            >
              <ChevronLeft size={25} color={colors.white} />
            </JoystickButton>
            <JoystickCenter>
              <Navigation size={20} color={colors.white} />
            </JoystickCenter>
            <JoystickButton
              onPress={() => handleSandboxNavigationControl("right")}
              accessibilityRole="button"
              accessibilityLabel="Turn right"
            >
              <ChevronRight size={25} color={colors.white} />
            </JoystickButton>
            <JoystickSpacer />
            <JoystickButton
              onPress={() => handleSandboxNavigationControl("reverse")}
              accessibilityRole="button"
              accessibilityLabel="Reverse"
            >
              <ChevronDown size={25} color={colors.white} />
            </JoystickButton>
            <JoystickSpacer />
          </JoystickGrid>
        </JoystickPanel>
      ) : null}

      {sandboxDriverEnabled && !sandboxNavigationActive ? (
        <SandboxButton
          onPress={() => setSandboxDriverActive((active) => !active)}
          accessibilityRole="button"
          accessibilityLabel={sandboxDriverActive ? "Stop sandbox drive" : "Start sandbox drive"}
          $active={sandboxDriverActive}
        >
          {sandboxDriverActive ? (
            <Square size={16} color={colors.white} fill={colors.white} />
          ) : (
            <Play size={17} color={colors.white} fill={colors.white} />
          )}
          <SandboxButtonText>{sandboxDriverActive ? "Stop test" : "Test drive"}</SandboxButtonText>
        </SandboxButton>
      ) : null}

      {sandboxDriverEnabled && !sandboxNavigationActive ? (
        <Sandbox3DButton
          onPress={startSandboxNavigation}
          accessibilityRole="button"
          accessibilityLabel="Start 3D navigation sandbox"
        >
          <Navigation size={16} color={colors.white} />
          <SandboxButtonText>3D nav</SandboxButtonText>
        </Sandbox3DButton>
      ) : null}

      <ReportPotholeModal
        visible={reportVisible}
        coordinate={draftLocation}
        locationMessage={locationMessage}
        onCancel={handleCloseReport}
        onSubmit={handleSubmitReport}
      />
    </Screen>
  );
}

function normalizeHeading(value) {
  return ((value % 360) + 360) % 360;
}

function moveCoordinate(coordinate, headingDegrees, distanceMeters) {
  const earthRadiusMeters = 6371000;
  const bearing = (headingDegrees * Math.PI) / 180;
  const latitude = (coordinate.latitude * Math.PI) / 180;
  const longitude = (coordinate.longitude * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadiusMeters;

  const nextLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const nextLongitude =
    longitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(nextLatitude)
    );

  return {
    ...coordinate,
    latitude: (nextLatitude * 180) / Math.PI,
    longitude: (nextLongitude * 180) / Math.PI
  };
}

const Screen = styled.View`
  flex: 1;
  background-color: ${colors.ink};
`;

const TopOverlay = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: 14px;
  right: 14px;
  z-index: 10;
  gap: 10px;
`;

const NavigationHud = styled.View`
  position: absolute;
  top: ${({ $top }) => $top}px;
  left: 14px;
  right: 14px;
  min-height: 62px;
  padding: 11px 12px;
  border-radius: ${radii.panel}px;
  background-color: rgba(15, 23, 42, 0.9);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.16);
  flex-direction: row;
  align-items: center;
  gap: 10px;
  z-index: 10;
  ${shadows.panel}
`;

const NavigationHudIcon = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.accent};
`;

const NavigationHudCopy = styled.View`
  flex: 1;
`;

const NavigationHudTitle = styled.Text`
  color: ${colors.white};
  font-size: 15px;
  font-weight: 900;
`;

const NavigationHudText = styled.Text`
  color: rgba(255, 255, 255, 0.76);
  font-size: 12px;
  margin-top: 2px;
`;

const DetailsPanel = styled.View`
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 96px;
  padding: 14px;
  border-radius: ${radii.panel}px;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  ${shadows.panel}
`;

const DriverAlertPanel = styled.View`
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: ${({ $bottom }) => $bottom}px;
  padding: 12px;
  border-radius: ${radii.panel}px;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: rgba(248, 113, 113, 0.45);
  flex-direction: row;
  align-items: center;
  gap: 10px;
  z-index: 9;
  ${shadows.panel}
`;

const DriverAlertIcon = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.warning};
`;

const DriverAlertCopy = styled.View`
  flex: 1;
`;

const DriverAlertTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 14px;
  font-weight: 900;
`;

const DriverAlertText = styled.Text`
  color: ${colors.textMuted};
  font-size: 12px;
  margin-top: 2px;
`;

const DetailsHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const StatusPill = styled.View`
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background-color: ${({ $status }) =>
    $status === "fixed" ? colors.fixedSurface : colors.reportedSurface};
`;

const StatusDot = styled.View`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background-color: ${({ $status }) => ($status === "fixed" ? colors.fixed : colors.warning)};
`;

const StatusPillText = styled.Text`
  color: ${colors.textStrong};
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
`;

const IconButton = styled(Pressable)`
  width: 34px;
  height: 34px;
  border-radius: 17px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.control};
`;

const DetailsTitle = styled.Text`
  color: ${colors.textStrong};
  font-size: 18px;
  font-weight: 800;
`;

const DetailsMeta = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
`;

const DetailsMetaText = styled.Text`
  color: ${colors.textMuted};
  font-size: 13px;
  flex: 1;
`;

const DetailsRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-top: 10px;
`;

const DetailsLabel = styled.Text`
  color: ${colors.textMuted};
  font-size: 13px;
`;

const DetailsValue = styled.Text`
  color: ${colors.textStrong};
  font-size: 13px;
  font-weight: 700;
  text-transform: capitalize;
`;

const DetailsNotes = styled.Text`
  color: ${colors.text};
  font-size: 14px;
  line-height: 20px;
  margin-top: 10px;
`;

const Fab = styled(Pressable)`
  position: absolute;
  right: 18px;
  bottom: 30px;
  min-width: 124px;
  height: 56px;
  border-radius: 28px;
  background-color: ${colors.accent};
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  ${shadows.fab}
`;

const FabText = styled.Text`
  color: ${colors.white};
  font-size: 16px;
  font-weight: 800;
`;

const LocateButton = styled(Pressable)`
  position: absolute;
  left: 18px;
  bottom: 34px;
  width: 48px;
  height: 48px;
  border-radius: 24px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.surface};
  border-width: 1px;
  border-color: ${colors.border};
  ${shadows.panel}
`;

const SandboxButton = styled(Pressable)`
  position: absolute;
  left: 78px;
  bottom: 34px;
  min-width: 126px;
  height: 48px;
  border-radius: 24px;
  padding: 0 14px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: ${({ $active }) => ($active ? colors.warningDark : colors.ink)};
  ${shadows.panel}
`;

const Sandbox3DButton = styled(Pressable)`
  position: absolute;
  left: 214px;
  bottom: 34px;
  min-width: 104px;
  height: 48px;
  border-radius: 24px;
  padding: 0 14px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: ${colors.accent};
  ${shadows.panel}
`;

const SandboxButtonText = styled.Text`
  color: ${colors.white};
  font-size: 13px;
  font-weight: 900;
`;

const NavigationExitButton = styled(Pressable)`
  position: absolute;
  left: 18px;
  bottom: 34px;
  height: 48px;
  min-width: 104px;
  padding: 0 14px;
  border-radius: 24px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: rgba(15, 23, 42, 0.92);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.16);
  ${shadows.panel}
`;

const NavigationExitText = styled.Text`
  color: ${colors.white};
  font-size: 13px;
  font-weight: 900;
`;

const JoystickPanel = styled.View`
  position: absolute;
  right: 18px;
  bottom: 26px;
  width: 154px;
  height: 154px;
  border-radius: 77px;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.72);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.18);
  ${shadows.fab}
`;

const JoystickGrid = styled.View`
  width: 126px;
  height: 126px;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
`;

const JoystickButton = styled(Pressable)`
  width: 42px;
  height: 42px;
  border-radius: 21px;
  align-items: center;
  justify-content: center;
  background-color: rgba(37, 99, 235, 0.96);
`;

const JoystickCenter = styled.View`
  width: 42px;
  height: 42px;
  border-radius: 21px;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.16);
`;

const JoystickSpacer = styled.View`
  width: 42px;
  height: 42px;
`;
