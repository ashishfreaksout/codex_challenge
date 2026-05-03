# Product Roadmap

Build Don't Sign Anything in phases. Each phase should keep the product useful while avoiding premature complexity.

## Phase 1: Web App MVP

Status: implemented in this scaffold.

- Landing page and web app workflow
- PDF upload and text extraction
- Pasted agreement text analysis
- Rule-based risk detection
- Plain-English summary
- Risk score and risk level
- Detected risk cards with explanations
- Questions to ask before signing
- Clear non-legal-advice disclaimer
- Privacy-minded MVP with no accounts or document history

## Phase 2: Better NLP and Document Classification

Status: implemented for the current MVP.

Implemented in the first Phase 2 pass:

- Classify document type, such as lease, employment agreement, contractor/freelance agreement, terms of service, privacy policy, waiver/release form, or non-disclosure agreement
- Show classification confidence and matched type signals
- Tune scoring by document type
- Add risk confidence scores
- Add more clause patterns
- Highlight exact source snippets and trigger terms in the UI
- Improve summary wording with document type context
- Generate downloadable full reports as HTML or plain text, with a print/save-PDF option
- Keep rule-based fallback

Still planned:

- More document-type-specific rule tuning
- Broader confidence calibration with real document samples
- Optional LLM summary when an API key is available

## Phase 3: User Accounts and Document History

Status: implemented for the current local MVP.

Implemented in the first Phase 3 pass:

- Optional local login and signup
- SQLite-backed saved analysis history
- Save prior analyses
- Open saved analyses
- Rename saved documents
- Permanent delete controls
- User risk preferences for privacy, hidden fees, employment restrictions, and cancellation/refunds
- Personalized risk weighting based on those preferences

Still planned:

- Stronger production auth/session management
- Better saved-history dashboard filters and search
- User-facing storage/export/delete privacy settings
- Migration path to PostgreSQL or Supabase

## Phase 4: Physical Document Scanning / Mobile-Ready Workflow

Status: started.

Implemented in the first Phase 4 pass:

- Image upload support
- OCR service path for scanned documents using Tesseract
- Multi-page image support through multiple uploaded image files
- Extracted text preview before analysis using the existing editable agreement text area
- API design ready for mobile clients with `/api/documents/extract-batch`
- Mobile app promotional area with coming-later status instead of fake store links

Still planned:

- Install and verify Tesseract in the local/dev environment
- Crop, rotate, and clean image before OCR where practical
- Camera-first scan capture in the future mobile apps
- Better image quality checks before OCR

## Phase 5: Mobile Apps

Status: started.

Implemented in the first Phase 5 pass:

- Android and iOS app using React Native or Flutter
- Camera scanning workflow
- Reuse backend analysis API
- Mobile risk dashboard
- Save and delete analyses after account support exists
- Share or export report
- Expo React Native scaffold under `mobile/`
- In-app backend URL configuration for simulator or real phone testing
- Expo Go developer preview links on the website for local testing without app store publishing

Still planned:

- Native polish for App Store / Google Play release
- Push through EAS build profiles
- Real app icons and store screenshots
- App Store and Google Play privacy forms
- Add real App Store and Google Play links to the website after apps are published

## Phase 6: Browser Extension

- Chrome extension first
- Later Firefox and Edge support
- Analyze visible agreement text only after user action
- Send selected page text to backend
- Popup with risk score, top risks, summary, and full report link
- Avoid collecting unnecessary browsing data

## Phase 7: Advanced Features

- Compare contract versions
- Ask questions about a document
- Export PDF report
- Attorney review referral workflow
- Clause library
- Risk benchmarks by document type
- Multilingual support
- Team workspace mode
