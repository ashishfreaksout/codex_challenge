import re

from app.models.schemas import PartyInfo, RiskItem
from app.utils.text import clip_sentence, normalize_spacing, split_sentences

ROLE_DESCRIPTIONS = {
    "client": "Likely receives services or deliverables and may owe payment or approvals.",
    "customer": "Likely receives goods or services and may owe payment or account duties.",
    "owner": "Likely owns the project, property, or contract rights being governed.",
    "contractor": "Likely performs work or services under the agreement.",
    "consultant": "Likely provides professional advice or services under the agreement.",
    "vendor": "Likely provides goods, services, or software to another party.",
    "supplier": "Likely provides goods or materials under the agreement.",
    "service provider": "Likely provides services and may have performance or privacy duties.",
    "company": "Likely the business entity offering services, employment, or contract terms.",
    "employer": "Likely controls employment terms, compensation, or workplace obligations.",
    "employee": "Likely performs work and may have confidentiality, conduct, or restriction duties.",
    "landlord": "Likely provides or controls use of leased property.",
    "tenant": "Likely rents or uses property and may owe rent, maintenance, or notice duties.",
    "buyer": "Likely purchases goods, services, property, or rights.",
    "seller": "Likely transfers goods, services, property, or rights.",
    "lender": "Likely provides credit or financing under repayment terms.",
    "borrower": "Likely receives credit and must repay under the agreement.",
    "licensor": "Likely owns rights and grants permission to use them.",
    "licensee": "Likely receives permission to use rights under limits.",
    "disclosing party": "Likely shares confidential information that must be protected.",
    "receiving party": "Likely receives confidential information and must protect it.",
    "guarantor": "Likely promises to cover another party's debt or obligation.",
}

QUOTE_PATTERN = "[\"'\\u2018\\u2019\\u201c\\u201d]"

PARTY_ROLE_PATTERN = re.compile(
    r"(?P<name>[A-Z][A-Za-z0-9&.,'/ -]{2,120}?)"
    r"\s*(?:,?\s*(?:a|an)\s+[A-Za-z ,-]{2,80})?"
    r"\s*[\(\[]\s*"
    + QUOTE_PATTERN
    + r"(?P<role>[A-Za-z][A-Za-z /-]{1,42})"
    + QUOTE_PATTERN
    + r"\s*[\)\]]",
)

ROLE_MEANS_PATTERN = re.compile(
    QUOTE_PATTERN
    + r"(?P<role>[A-Za-z][A-Za-z /-]{1,42})"
    + QUOTE_PATTERN
    + r"\s+means\s+"
    r"(?P<name>[A-Z][A-Za-z0-9&.,'/ -]{2,120}?)(?=\.|;|\n|$)",
    flags=re.IGNORECASE,
)


def build_summary(text: str, risks: list[RiskItem], document_type: str = "Unknown document") -> str:
    sentences = split_sentences(text)
    opening = " ".join(clip_sentence(sentence, 220) for sentence in sentences[:2])
    type_intro = f"This looks like {_type_phrase(document_type)}."

    if not opening:
        opening = "The document contains agreement text that should be reviewed before signing."

    if risks:
        top_risks = ", ".join(risk.title.lower() for risk in risks[:3])
        item_label = "item" if len(risks) == 1 else "items"
        return (
            f"{type_intro} {opening} The review found "
            f"{len(risks)} {item_label} to look at more carefully, including {top_risks}."
        )

    return (
        f"{type_intro} {opening} The review did not find "
        "the main risk words it knows about, but that does not mean the agreement is risk-free."
    )


def extract_obligations(text: str, limit: int = 6) -> list[str]:
    obligation_pattern = re.compile(
        r"\b(shall|must|required to|agree to|responsible for|pay|provide|notify|maintain|comply)\b",
        flags=re.IGNORECASE,
    )
    return _matching_sentences(text, obligation_pattern, limit=limit)


def extract_deadlines(text: str, limit: int = 5) -> list[str]:
    deadline_pattern = re.compile(
        r"(\bwithin\b|\bbefore\b|\bafter\b|\bdeadline\b|\bnotice\b|\bexpires?\b|"
        r"\b\d{1,3}\s+(?:day|days|month|months|year|years)\b|"
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b)",
        flags=re.IGNORECASE,
    )
    return _matching_sentences(text, deadline_pattern, limit=limit)


def build_questions_to_ask(risks: list[RiskItem], limit: int = 8) -> list[str]:
    questions: list[str] = []
    for risk in risks:
        for question in risk.questions:
            if question not in questions:
                questions.append(question)
            if len(questions) >= limit:
                return questions

    if not questions:
        return [
            "What do I have to do after I sign?",
            "What would it cost if I cancel or stop early?",
            "What rights am I giving up?",
            "Can the other side change the deal later?",
        ]

    return questions


def build_next_steps(risks: list[RiskItem]) -> list[str]:
    if risks:
        return [
            "Read each flagged clause in the original document before signing.",
            "Ask the other party to explain unclear fees, deadlines, and restrictions in writing.",
            "Consult a licensed attorney for legal decisions or high-stakes agreements.",
        ]

    return [
        "Review the full agreement manually before signing.",
        "Confirm fees, deadlines, cancellation rules, and data practices in writing.",
        "Consult a licensed attorney if the agreement is important or unclear.",
    ]


def extract_parties(text: str, limit: int = 6) -> list[PartyInfo]:
    search_text = text[:5000]
    parties: list[PartyInfo] = []
    seen: set[tuple[str, str]] = set()

    for pattern in (PARTY_ROLE_PATTERN, ROLE_MEANS_PATTERN):
        for match in pattern.finditer(search_text):
            name = _clean_party_name(match.group("name"))
            role = _clean_party_role(match.group("role"))
            if not name or not role or _looks_like_false_party(name, role):
                continue

            key = (name.lower(), role.lower())
            if key in seen:
                continue

            seen.add(key)
            parties.append(
                PartyInfo(
                    name=name,
                    role=role,
                    description=_describe_party_role(role),
                    source_text=clip_sentence(match.group(0), 180),
                )
            )

            if len(parties) >= limit:
                return parties

    return parties


def _matching_sentences(text: str, pattern: re.Pattern[str], limit: int) -> list[str]:
    matches: list[str] = []
    for sentence in split_sentences(text):
        if pattern.search(sentence):
            normalized_sentence = normalize_spacing(sentence)
            if normalized_sentence not in matches:
                matches.append(normalized_sentence)
            if len(matches) >= limit:
                break
    return matches


def _clean_party_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name).strip(" ,.;:-")
    cleaned = re.sub(
        r"^(?:between|and|by|"
        r"this\s+(?:agreement|contract)\s+(?:is\s+)?(?:made|entered\s+into)\s+(?:by|between))\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\b(effective as of|dated as of).*$", "", cleaned, flags=re.IGNORECASE).strip(" ,.;:-")
    return cleaned


def _clean_party_role(role: str) -> str:
    cleaned = re.sub(r"\s+", " ", role).strip(" ,.;:-")
    return cleaned[:1].upper() + cleaned[1:] if cleaned else ""


def _looks_like_false_party(name: str, role: str) -> bool:
    if len(name) < 3 or len(role) < 2:
        return True

    blocked_names = {
        "agreement",
        "contract",
        "section",
        "schedule",
        "exhibit",
        "recitals",
        "whereas",
    }
    if name.lower() in blocked_names:
        return True

    if len(name.split()) > 12:
        return True

    return False


def _describe_party_role(role: str) -> str:
    normalized_role = role.lower()
    if normalized_role in ROLE_DESCRIPTIONS:
        return ROLE_DESCRIPTIONS[normalized_role]

    return (
        "This appears to be a defined role in the agreement. Use it to track which side has "
        "the related rights, duties, or restrictions."
    )


def _type_phrase(document_type: str) -> str:
    if document_type == "Unknown document":
        return "an unknown document"

    article = "an" if document_type[:1].lower() in {"a", "e", "i", "o", "u"} else "a"
    return f"{article} {document_type.lower()}"
