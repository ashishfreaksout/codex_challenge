# Risk Categories

The current analyzer uses explainable rule-based keyword and phrase detection. Phase 2 adds document type classification, risk confidence scores, and document-type-aware scoring. These rules are review signals only and can miss important language.

## Arbitration Clause

Potential issue: limits how disputes are handled and may waive court, jury trial, or class action rights.

Example signals: `binding arbitration`, `arbitration`, `waiver of jury trial`, `class action waiver`.

## Auto-Renewal

Potential issue: extends the agreement unless the signer cancels before a deadline.

Example signals: `automatic renewal`, `auto-renew`, `renews automatically`.

## Cancellation Restriction

Potential issue: makes it difficult to cancel or requires strict notice.

Example signals: `may not cancel`, `cancellation prohibited`, `30 days notice`.

## Early Termination Penalty

Potential issue: charges money or damages for ending the agreement early.

Example signals: `early termination fee`, `termination fee`, `liquidated damages`.

## Hidden Fees

Potential issue: permits costs beyond the headline price.

Example signals: `additional fees`, `administrative fee`, `processing fee`, `fees may apply`.

## Liability Waiver

Potential issue: reduces another party's responsibility or limits recovery.

Example signals: `waive liability`, `hold harmless`, `release from liability`, `limitation of liability`.

## Non-Compete

Potential issue: restricts future work, business activity, or employment.

Example signals: `non-compete`, `not compete`, `competitive business`.

## Non-Solicit

Potential issue: restricts contact with clients, customers, employees, or coworkers.

Example signals: `non-solicit`, `not solicit`, `solicit customers`.

## Data Sharing / Privacy Risk

Potential issue: permits broad collection, sharing, sale, tracking, or third-party use of data.

Example signals: `share personal information`, `third parties`, `sell data`, `tracking`.

## Refund Restriction

Potential issue: limits or blocks refunds.

Example signals: `no refunds`, `non-refundable`, `refunds at sole discretion`.

## One-Sided Modification Clause

Potential issue: allows one party to change terms later without meaningful consent.

Example signals: `modify terms at any time`, `change fees without notice`, `sole discretion`.

## Personal Guarantee

Potential issue: makes a person personally responsible for another party's debt or obligation.

Example signals: `personal guarantee`, `personally liable`, `guarantor`.

## Payment Acceleration / Collection Costs

Potential issue: makes amounts due all at once or adds costs after default.

Example signals: `immediately due`, `acceleration`, `collection costs`, `attorney fees`.

## Intellectual Property Ownership

Potential issue: transfers ownership of work, ideas, files, code, designs, or inventions.

Example signals: `work product`, `intellectual property`, `all right, title, and interest`, `sole property`.

## Confidentiality

Potential issue: restricts what information can be shared and for how long.

Example signals: `confidential information`, `non-disclosure`, `trade secret`, `proprietary information`.

## Governing Law / Venue

Potential issue: controls where disputes happen and which rules apply.

Example signals: `governed by the laws of`, `choice of law`, `exclusive jurisdiction`, `venue`.

## Assignment

Potential issue: allows contract rights or duties to be transferred to another party.

Example signals: `assign this agreement`, `transfer rights`, `without consent`.

## Indemnification

Potential issue: requires one party to defend or pay for claims, losses, or costs.

Example signals: `indemnify`, `indemnification`, `defend and hold harmless`.

## One-Sided Termination

Potential issue: lets one party end the agreement with little notice or reason.

Example signals: `terminate at any time`, `without cause`, `without notice`, `sole discretion`.

## Medical Care Consent

Potential issue: authorizes medical assistance or emergency treatment and may waive claims around that care.

Example signals: `medical consent`, `emergency medical`, `authorize treatment`.
