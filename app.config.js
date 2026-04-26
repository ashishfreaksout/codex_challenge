const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const sandbox3DNavigationEnabled =
  process.env.EXPO_PUBLIC_ENABLE_3D_SANDBOX_NAVIGATION === "true";

module.exports = {
  expo: {
    name: sandbox3DNavigationEnabled
      ? "Pothole 3D Sandbox"
      : "Bay Area Pothole Tracker",
    slug: "bay-area-pothole-tracker",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#0f172a"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: sandbox3DNavigationEnabled
        ? "com.example.bayareapotholes.sandbox3d"
        : "com.example.bayareapotholes",
      config: {
        googleMapsApiKey
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Bay Area Pothole Tracker uses your location to place a pothole report at your current GPS position."
      }
    },
    android: {
      package: sandbox3DNavigationEnabled
        ? "com.example.bayareapotholes.sandbox3d"
        : "com.example.bayareapotholes",
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey
        }
      }
    },
    web: {
      bundler: "metro"
    },
    plugins: [
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Bay Area Pothole Tracker uses your location to place a pothole report at your current GPS position."
        }
      ]
    ]
  }
};
