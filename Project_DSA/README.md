# Don't Sign Anything!

Don't Sign Anything is a phased product for helping people understand potential document risks before signing agreements. The current build includes the Phase 1 web app MVP, Phase 2 analysis upgrades, Phase 3 account/history workflow, Phase 4 scanning workflow, and the first Phase 5 mobile app scaffold.

This project is an educational document risk assistant. It is not a lawyer and does not provide legal advice.

## Phase 1 Scope

- React + Vite frontend
- FastAPI backend
- Text extraction for PDF, DOCX, ODT, RTF, TXT, and Markdown files
- Pasted agreement text support
- Rule-based clause detection
- Risk score from 0 to 100
- Low, Medium, and High risk levels
- Plain-English explanations and questions before signing
- Privacy notice and no document history in the MVP

Not included in Phase 1: user accounts, saved document history, OCR for scans, mobile apps, browser extension, advanced AI chat, attorney referrals, or paid LLM dependency.

## Phase 2 Started

- Rule-based document type classification
- Classification confidence and matched type signals
- Risk confidence scores
- Document-type-aware scoring adjustments
- More clause patterns for privacy, waivers, contractor agreements, online terms, and employment restrictions
- Highlighted trigger language in the detailed findings view
- Full report generation with HTML, plain text, and print/save-PDF options
- Rule-based fallback remains the default behavior

Optional LLM summaries are still deferred until an API key and provider choice are intentionally configured.

## Phase 3 Started

- Optional local signup/login
- SQLite-backed saved analysis history
- Save the current report after analysis
- Open previous saved analyses
- Rename saved documents
- Permanently delete saved analyses
- User preferences for privacy, hidden fees, employment restrictions, and cancellation/refunds
- Preference-aware scoring adjustments

Phase 3 stores saved analysis reports in `backend/app_data/`. The original uploaded document file is not saved by this workflow.

## Phase 4 Started

- Image upload support for JPG, PNG, TIFF, BMP, and WebP scans
- Multi-file upload for multi-page scanned documents
- OCR service module designed for Tesseract
- Extracted scan text appears in the same editable text preview before analysis
- Mobile app roadmap badges are shown without fake store links

OCR requires local setup:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
brew install tesseract
```

If OCR dependencies or the Tesseract engine are missing, image uploads return a setup message instead of silently failing.

## Phase 5 Started

- Expo React Native mobile app in `mobile/`
- Camera scan, photo selection, and document picker workflow
- Reuses the backend OCR/extraction and risk analysis APIs
- Mobile report screen with risk score, summary, top risks, and questions
- Email sign-in using the existing local auth endpoints
- Save, open, delete, and share reports on mobile

Real App Store and Google Play links should be added only after the apps are published.

## Project Structure

```text
dont-sign-anything/
  frontend/
    src/
      components/
      pages/
      services/
      utils/
  backend/
    app/
      main.py
      routes/
      services/
      models/
      utils/
    requirements.txt
  mobile/
    App.js
    src/
      services/
  docs/
    roadmap.md
    risk_categories.md
    disclaimers.md
```

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend.

### Mobile

```bash
cd mobile
npm start
```

Use the in-app Backend URL field to point at your FastAPI server. A real phone needs your computer LAN IP, for example `http://192.168.1.25:8000`.

For local tester access without publishing to the app stores, keep Expo running and share the Expo Go preview link or QR code. The current local preview is `exp://192.168.1.136:8081`, and the current web preview is `http://localhost:8081`. These links are development links and can change when your network changes.

## API

- `GET /api/health`
- `POST /api/documents/extract`
- `POST /api/documents/extract-batch`
- `POST /api/documents/extract-pdf` (compatibility alias)
- `POST /api/analyze`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/preferences`
- `GET /api/history`
- `POST /api/history`
- `GET /api/history/{analysis_id}`
- `PATCH /api/history/{analysis_id}`
- `DELETE /api/history/{analysis_id}`

## Privacy Notes

Accounts are optional. Uploaded files and scan images are read in memory for extraction and are not intentionally stored by the application. If a signed-in user saves an analysis, the analysis report is stored locally in SQLite under `backend/app_data/` until the user deletes it. Users should still treat agreements as sensitive documents and avoid uploading content they do not want processed locally by this development app.

## Disclaimer

This is not legal advice. The app provides educational risk signals, plain-English explanations, and questions to ask before signing. Consult a licensed attorney for legal decisions.
