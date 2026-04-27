# Web Deployment

The public web app is designed to run as a static Expo web export on GitHub Pages.

## Public URL

After the GitHub Pages workflow finishes, the web app should be available at:

```text
https://ashishfreaksout.github.io/codex_challenge/
```

If the link returns 404, wait for the `Deploy Web App` GitHub Actions workflow to finish, then check the repository Pages settings and make sure the Pages source is set to **GitHub Actions**.

## How Deployment Works

The workflow in `.github/workflows/deploy-web.yml` runs on every push to `main`.

It performs these steps:

1. Installs Node dependencies with `npm ci`.
2. Exports the Expo web app into `dist`.
3. Rewrites Expo's root-relative asset paths so they work under the GitHub Pages project path.
4. Adds `.nojekyll` so GitHub Pages serves the `_expo` directory correctly.
5. Uploads `dist` as a Pages artifact.
6. Deploys the artifact to GitHub Pages.

## Map Provider

The hosted web build intentionally uses the OpenStreetMap/CARTO fallback by default. This avoids publishing a Google Maps browser key in a public static build.

To use Google Maps on the hosted web app later:

1. Create a Google Maps JavaScript API key.
2. Restrict it to the GitHub Pages domain.
3. Add it as a GitHub Actions repository secret.
4. Update `.github/workflows/deploy-web.yml` to read that secret as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Prediction API

The web app points to:

```text
https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space
```

This API is used by the `AI Predicted Hotspots` view. If the Hugging Face Space is on a free tier, it may sleep when idle. The first request can take longer while the Space wakes up.

## Local Test Before Deployment

Run:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_PREDICTION_SERVICE_URL=https://ashishfreaksout-bay-area-pothole-prediction-api.hf.space npm run export:web:pages
```

Then serve the output:

```bash
npx serve dist
```

Open the local URL printed by `serve` and confirm:

- The map tiles render.
- Live pothole markers render.
- The `AI Predicted Hotspots` tab fetches the prediction layer.
- The app works without a local `.env` file.
