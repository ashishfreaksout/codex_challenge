from typing import Optional

from app.models.schemas import RiskItem, UserPreferences

SEVERITY_POINTS = {
    "Low": 8,
    "Medium": 14,
    "High": 22,
}

DOCUMENT_TYPE_RISK_ADJUSTMENTS = {
    "Lease agreement": {
        "auto_renewal": 5,
        "cancellation_restriction": 5,
        "hidden_fees": 4,
        "liability_waiver": 4,
        "early_termination_penalty": 4,
    },
    "Employment agreement": {
        "non_compete": 8,
        "non_solicit": 5,
        "confidentiality": 3,
        "intellectual_property": 4,
        "unilateral_termination": 3,
    },
    "Contractor/freelance agreement": {
        "intellectual_property": 8,
        "confidentiality": 4,
        "payment_acceleration": 5,
        "assignment": 3,
        "indemnification": 5,
    },
    "Terms of service": {
        "arbitration": 5,
        "one_sided_modification": 8,
        "data_sharing_privacy": 6,
        "auto_renewal": 5,
        "refund_restriction": 4,
    },
    "Privacy policy": {
        "data_sharing_privacy": 10,
        "one_sided_modification": 4,
        "governing_law_venue": 2,
    },
    "Waiver/release form": {
        "liability_waiver": 10,
        "indemnification": 6,
        "medical_consent": 4,
        "arbitration": 3,
    },
    "Non-disclosure agreement": {
        "confidentiality": 8,
        "intellectual_property": 4,
        "governing_law_venue": 3,
    },
}

PREFERENCE_RISK_ADJUSTMENTS = {
    "privacy": {
        "data_sharing_privacy": 10,
        "confidentiality": 4,
        "one_sided_modification": 3,
    },
    "hidden_fees": {
        "hidden_fees": 10,
        "payment_acceleration": 7,
        "refund_restriction": 4,
        "early_termination_penalty": 4,
    },
    "employment_restrictions": {
        "non_compete": 10,
        "non_solicit": 7,
        "confidentiality": 4,
        "intellectual_property": 5,
        "unilateral_termination": 4,
    },
    "cancellation_refunds": {
        "cancellation_restriction": 9,
        "refund_restriction": 9,
        "auto_renewal": 6,
        "early_termination_penalty": 5,
    },
}


def calculate_risk_score(
    risks: list[RiskItem],
    document_type: str = "Unknown document",
    preferences: Optional[UserPreferences] = None,
) -> int:
    if not risks:
        return 8

    score = 0
    type_adjustments = DOCUMENT_TYPE_RISK_ADJUSTMENTS.get(document_type, {})
    preference_adjustments = _combined_preference_adjustments(preferences)

    for risk in risks:
        confidence_bonus = 4 if risk.confidence >= 85 else 2 if risk.confidence >= 70 else 0
        score += (
            SEVERITY_POINTS.get(risk.severity, 10)
            + type_adjustments.get(risk.id, 0)
            + preference_adjustments.get(risk.id, 0)
            + confidence_bonus
        )

    breadth_penalty = max(0, len(risks) - 3) * 3
    high_risk_penalty = sum(3 for risk in risks if risk.severity == "High")

    return min(100, score + breadth_penalty + high_risk_penalty)


def build_scoring_notes(
    risks: list[RiskItem],
    document_type: str,
    preferences: Optional[UserPreferences] = None,
) -> list[str]:
    notes = [
        "Severity sets the base score for each detected review item.",
        "Higher-confidence matches add a small score increase.",
    ]

    type_adjustments = DOCUMENT_TYPE_RISK_ADJUSTMENTS.get(document_type, {})
    adjusted_risks = [
        risk.title
        for risk in risks
        if type_adjustments.get(risk.id, 0) > 0
    ]

    if adjusted_risks:
        notes.append(
            f"Because this looks like {_type_phrase(document_type)}, these findings received extra weight: "
            + ", ".join(adjusted_risks[:4])
            + "."
        )
    else:
        notes.append("No document-type-specific score boosts were applied.")

    preference_adjustments = _combined_preference_adjustments(preferences)
    preference_risks = [
        risk.title
        for risk in risks
        if preference_adjustments.get(risk.id, 0) > 0
    ]
    if preference_risks:
        notes.append(
            "Your saved preferences increased weight for: "
            + ", ".join(preference_risks[:4])
            + "."
        )

    return notes


def _type_phrase(document_type: str) -> str:
    article = "an" if document_type[:1].lower() in {"a", "e", "i", "o", "u"} else "a"
    if document_type == "Unknown document":
        return "an unknown document"
    return f"{article} {document_type.lower()}"


def _combined_preference_adjustments(preferences: Optional[UserPreferences]) -> dict[str, int]:
    if preferences is None:
        return {}

    combined: dict[str, int] = {}
    for preference_name, adjustments in PREFERENCE_RISK_ADJUSTMENTS.items():
        if not getattr(preferences, preference_name, False):
            continue

        for risk_id, boost in adjustments.items():
            combined[risk_id] = combined.get(risk_id, 0) + boost

    return combined


def get_risk_level(score: int) -> str:
    if score >= 70:
        return "High"
    if score >= 35:
        return "Medium"
    return "Low"
