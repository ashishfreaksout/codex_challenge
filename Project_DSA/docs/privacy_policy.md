# Privacy Policy

Last updated: May 3, 2026

Don't Sign Anything is an educational document risk assistant. It helps users understand possible issues in agreements before signing. It is not a law firm and does not provide legal advice.

## What You Upload

Documents, scans, PDFs, and pasted text may contain sensitive personal, financial, employment, or business information. Only upload documents you are comfortable processing in this application.

## Local MVP Data Handling

In the current MVP:

- Uploaded files are processed for text extraction and analysis.
- The original uploaded document file is not intentionally stored.
- Pasted or extracted text is sent to the local FastAPI backend for analysis.
- If you create an account and save a report, the analysis report is stored in local SQLite under `backend/app_data/`.
- Saved reports remain stored until you delete them.

## Accounts

Accounts are optional. Email/password sign-in is available for local testing. Passwords are salted and hashed. Social sign-in buttons are not connected to OAuth providers yet.

## Mobile Preview

The mobile app preview runs through Expo during development. When using a phone, the app connects to the backend URL configured inside the app. The backend must be reachable from the device.

## Third-Party Services

The current local MVP does not intentionally send document content to paid AI providers or cloud OCR services. Future versions may add optional integrations, but they should be clearly disclosed before use.

## Deleting Data

Signed-in users can delete saved analysis reports from their history. Deleting a saved report removes that saved analysis from the local database.

## Legal Decisions

This tool provides educational risk signals and plain-English explanations. Consult a licensed attorney for legal decisions.
