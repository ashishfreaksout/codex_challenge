# San Jose Pothole Tracker

Expo React Native app for tracking potholes in the San Jose region with Google Maps, mock San Jose 311 data, local report state, search, and status filtering.

## Run

```bash
npm install
npm run start
```

Use `npm run web` for the browser build, or `npm run android` after creating native projects with Expo.

## Android APK

The included `eas.json` has a `preview` profile that exports an internal APK:

```bash
npx eas build -p android --profile preview
```

## Configuration

Create `.env` from `.env.example` and set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. The native app uses the same key through `app.config.js`; the web map uses it through `MapComponent.web.js`.

If `EXPO_PUBLIC_SAN_JOSE_311_ENDPOINT` is unset, the app uses the mock 311 response in `src/data/MockData.js`. When an endpoint is available, `src/services/sanJose311Api.js` normalizes its records into the same pothole shape used by the mock local repository.
