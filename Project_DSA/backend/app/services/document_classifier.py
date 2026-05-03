from dataclasses import dataclass
import re

from app.models.schemas import DocumentClassification
from app.utils.text import normalize_spacing


@dataclass(frozen=True)
class ClassificationProfile:
    document_type: str
    description: str
    signals: tuple[tuple[str, int], ...]


CLASSIFICATION_PROFILES: tuple[ClassificationProfile, ...] = (
    ClassificationProfile(
        document_type="Lease agreement",
        description="This looks like a rental or property-use agreement.",
        signals=(
            (r"\blandlord\b", 8),
            (r"\btenant\b", 8),
            (r"\blease\b", 7),
            (r"\brent\b", 6),
            (r"\bpremises\b", 5),
            (r"\bsecurity deposit\b", 8),
            (r"\bresidential\b", 3),
        ),
    ),
    ClassificationProfile(
        document_type="Employment agreement",
        description="This looks like an agreement about a job or employment relationship.",
        signals=(
            (r"\bemployer\b", 8),
            (r"\bemployee\b", 8),
            (r"\bemployment\b", 7),
            (r"\bsalary\b", 5),
            (r"\bbenefits\b", 4),
            (r"\bat[- ]will\b", 8),
            (r"\bposition\b", 3),
            (r"\bprobationary period\b", 5),
        ),
    ),
    ClassificationProfile(
        document_type="Contractor/freelance agreement",
        description="This looks like a services agreement for an independent contractor or freelancer.",
        signals=(
            (r"\bindependent contractor\b", 10),
            (r"\bcontractor\b", 7),
            (r"\bclient\b", 6),
            (r"\bservices\b", 4),
            (r"\binvoice\b", 5),
            (r"\bwork product\b", 6),
            (r"\bsubcontract\b", 5),
            (r"\bstatement of work\b", 5),
        ),
    ),
    ClassificationProfile(
        document_type="Terms of service",
        description="This looks like online service, account, platform, or website terms.",
        signals=(
            (r"\bterms of service\b", 10),
            (r"\bterms and conditions\b", 8),
            (r"\buser\b", 4),
            (r"\baccount\b", 5),
            (r"\bwebsite\b", 4),
            (r"\bplatform\b", 4),
            (r"\bcontinued use\b", 7),
            (r"\bacceptable use\b", 5),
        ),
    ),
    ClassificationProfile(
        document_type="Privacy policy",
        description="This looks like a document about collecting, using, or sharing personal information.",
        signals=(
            (r"\bprivacy policy\b", 10),
            (r"\bpersonal information\b", 8),
            (r"\bpersonal data\b", 8),
            (r"\bcookies\b", 6),
            (r"\btracking\b", 5),
            (r"\bthird parties\b", 5),
            (r"\bopt out\b", 5),
            (r"\bdata retention\b", 5),
        ),
    ),
    ClassificationProfile(
        document_type="Waiver/release form",
        description="This looks like a waiver or release where someone gives up claims or accepts risk.",
        signals=(
            (r"\bwaiver\b", 9),
            (r"\brelease of (?:claims|liability)\b", 9),
            (r"\bassumption of risk\b", 8),
            (r"\binjury\b", 4),
            (r"\bnegligence\b", 7),
            (r"\bhold harmless\b", 7),
            (r"\bnot to sue\b", 7),
        ),
    ),
    ClassificationProfile(
        document_type="Non-disclosure agreement",
        description="This looks like an NDA or confidentiality agreement.",
        signals=(
            (r"\bnon[- ]disclosure\b", 10),
            (r"\bnondisclosure\b", 10),
            (r"\bconfidential information\b", 8),
            (r"\bdisclosing party\b", 8),
            (r"\breceiving party\b", 8),
            (r"\btrade secrets?\b", 6),
            (r"\bproprietary information\b", 6),
        ),
    ),
)


def classify_document(text: str) -> DocumentClassification:
    normalized_text = normalize_spacing(text)
    scored_profiles = []

    for profile in CLASSIFICATION_PROFILES:
        score = 0
        matched_signals: list[str] = []

        for pattern, weight in profile.signals:
            matches = list(re.finditer(pattern, normalized_text, flags=re.IGNORECASE))
            if not matches:
                continue

            score += min(weight * len(matches), weight * 3)
            signal = _signal_label(matches[0].group(0))
            if signal.lower() not in {item.lower() for item in matched_signals}:
                matched_signals.append(signal)

        scored_profiles.append((score, profile, matched_signals))

    scored_profiles.sort(key=lambda item: item[0], reverse=True)
    top_score, top_profile, top_signals = scored_profiles[0]
    second_score = scored_profiles[1][0] if len(scored_profiles) > 1 else 0

    if top_score <= 0:
        return DocumentClassification(
            document_type="Unknown document",
            confidence=15,
            matched_signals=[],
            explanation="The rule-based classifier did not find enough type-specific signals.",
        )

    confidence = _confidence_from_scores(top_score, second_score)
    return DocumentClassification(
        document_type=top_profile.document_type,
        confidence=confidence,
        matched_signals=top_signals[:8],
        explanation=top_profile.description,
    )


def _confidence_from_scores(top_score: int, second_score: int) -> int:
    base = min(82, 38 + top_score)
    margin = top_score - second_score
    margin_bonus = min(16, max(0, margin * 2))
    return max(25, min(98, base + margin_bonus))


def _signal_label(signal: str) -> str:
    return normalize_spacing(signal).lower()
