# Don't Sign Anything Mobile

Phase 5 mobile MVP built with Expo React Native.

## Current Scope

- iOS and Android app scaffold from one React Native codebase
- Camera scan, photo selection, and document/PDF selection
- Reuses the FastAPI extraction and analysis endpoints
- Editable OCR/extracted text preview before analysis
- Mobile risk report view
- Save reports when signed in
- Open and delete saved history
- Share a plain-text report through the native share sheet
- Local email/password account flow using the existing backend

This app is still an educational document risk assistant. It is not legal advice.

## Run

Start the backend first:

```bash
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0
```

Then start the mobile app:

```bash
cd ../mobile
npm start
```

For a real phone, set the in-app Backend URL to your computer LAN address, for example:

```text
http://192.168.1.25:8000
```

For Android emulator, use:

```text
http://10.0.2.2:8000
```

For iOS simulator, `http://127.0.0.1:8000` usually works.

## Expo Preview Links

You can let testers open the mobile MVP through Expo Go instead of publishing to the app stores.

Current local preview while Expo is running:

```text
exp://192.168.1.136:8081
```

Current web preview while Expo is running:

```text
http://localhost:8081
```

Limits:

- Testers need Expo Go installed on their phone.
- The Expo development server must stay running.
- The phone and backend need to be reachable on the same network unless you use an Expo tunnel.
- This is for testing, not production distribution.

## Notes

- The App Store and Google Play links should not be added until the apps are actually published.
- Social sign-in is not implemented yet.
- OCR depends on the backend Tesseract setup from Phase 4.
