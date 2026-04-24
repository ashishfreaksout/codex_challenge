const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    name: "San Jose Pothole Tracker",
    slug: "san-jose-pothole-tracker",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      backgroundColor: "#0f172a"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.example.sanjosepotholes",
      config: {
        googleMapsApiKey
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "San Jose Pothole Tracker uses your location to place a pothole report at your current GPS position."
      }
    },
    android: {
      package: "com.example.sanjosepotholes",
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
            "San Jose Pothole Tracker uses your location to place a pothole report at your current GPS position."
        }
      ]
    ]
  }
};
