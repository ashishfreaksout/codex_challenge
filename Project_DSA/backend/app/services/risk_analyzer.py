from dataclasses import dataclass
import re
from typing import Optional

from app.models.schemas import AnalysisResponse, RiskItem, UserPreferences
from app.services.document_classifier import classify_document
from app.services.scoring import build_scoring_notes, calculate_risk_score, get_risk_level
from app.services.summarizer import (
    build_next_steps,
    build_questions_to_ask,
    build_summary,
    extract_deadlines,
    extract_obligations,
    extract_parties,
)
from app.utils.text import normalize_spacing

DISCLAIMER = (
    "This is not legal advice. This educational tool flags potential document risks "
    "and plain-English questions to consider. Consult a licensed attorney for legal decisions."
)


@dataclass(frozen=True)
class ClauseRule:
    id: str
    title: str
    category: str
    severity: str
    patterns: tuple[str, ...]
    explanation: str
    plain_english: str
    questions: tuple[str, ...]
    document_types: tuple[str, ...] = ()


CLAUSE_RULES: tuple[ClauseRule, ...] = (
    ClauseRule(
        id="arbitration",
        title="Arbitration clause",
        category="Dispute resolution",
        severity="High",
        patterns=(
            r"\bbinding arbitration\b",
            r"\barbitration\b",
            r"\bwaiv(?:e|er) (?:of )?(?:jury trial|class action|right to sue)\b",
            r"\bclass action waiver\b",
            r"\bjury trial waiver\b",
            r"\bresolve .{0,80} disputes? .{0,80} arbitration\b",
        ),
        explanation="Arbitration language can limit where and how disputes are resolved.",
        plain_english=(
            "You may be giving up the ability to take a dispute to court or join a class action."
        ),
        questions=(
            "What rights am I giving up if a dispute happens?",
            "Who chooses the arbitrator and who pays arbitration costs?",
            "Can I opt out of arbitration before signing?",
        ),
    ),
    ClauseRule(
        id="auto_renewal",
        title="Auto-renewal",
        category="Renewal",
        severity="Medium",
        patterns=(
            r"\bautomatic(?:ally)? renew",
            r"\bauto[- ]renew",
            r"\brenews? (?:automatically|for successive)",
            r"\bsuccessive (?:terms|periods)\b",
            r"\brenewal term\b",
        ),
        explanation="Auto-renewal terms may extend the agreement unless you cancel in time.",
        plain_english="The agreement may keep going and keep charging you unless you act before a deadline.",
        questions=(
            "When does the agreement renew?",
            "How much notice must I give to stop renewal?",
            "Will I receive a reminder before renewal?",
        ),
    ),
    ClauseRule(
        id="cancellation_restriction",
        title="Cancellation restriction",
        category="Cancellation",
        severity="High",
        patterns=(
            r"\bmay not cancel\b",
            r"\bnon[- ]cancelable\b",
            r"\bcancell?ation (?:is )?(?:not permitted|prohibited|restricted)\b",
            r"\bcancell?ation fee\b",
            r"\b\d{1,3}\s+days'? notice\b.{0,80}\b(?:cancel|termination|renewal)\b",
        ),
        explanation="Cancellation restrictions may make it difficult to exit the agreement.",
        plain_english="You may have limited windows or strict steps to cancel.",
        questions=(
            "Exactly how do I cancel?",
            "What happens if I miss the cancellation window?",
            "Can the cancellation process be confirmed in writing?",
        ),
    ),
    ClauseRule(
        id="early_termination_penalty",
        title="Early termination penalty",
        category="Termination",
        severity="High",
        patterns=(
            r"\bearly termination (?:fee|penalty|charge)\b",
            r"\btermination fee\b",
            r"\bliquidated damages\b",
        ),
        explanation="Early termination penalties can create extra costs if you leave before the term ends.",
        plain_english="Ending the agreement early may cost you money.",
        questions=(
            "How much would I owe if I terminate early?",
            "Are there exceptions for hardship, non-performance, or relocation?",
            "Can the penalty be reduced or removed?",
        ),
    ),
    ClauseRule(
        id="hidden_fees",
        title="Potential hidden fees",
        category="Fees",
        severity="Medium",
        patterns=(
            r"\badditional fees?\b",
            r"\badministrative fees?\b",
            r"\bprocessing fees?\b",
            r"\bservice charges?\b",
            r"\blate fees?\b",
            r"\bconvenience fees?\b",
            r"\bsurcharges?\b",
            r"\bfees? may apply\b",
        ),
        explanation="Fee language may allow charges beyond the headline price.",
        plain_english="The total cost may be higher than it first appears.",
        questions=(
            "What is the full list of fees I could be charged?",
            "Are any fees optional, recurring, or variable?",
            "Can fee changes happen without my approval?",
        ),
    ),
    ClauseRule(
        id="liability_waiver",
        title="Liability waiver",
        category="Liability",
        severity="High",
        patterns=(
            r"\bwaiv(?:e|er) (?:any|all)? ?(?:liability|claims)\b",
            r"\bhold harmless\b",
            r"\brelease .{0,80} from liability\b",
            r"\blimitation of liability\b",
            r"\bassumption of risk\b",
            r"\bnegligence\b.{0,80}\b(?:waiv|release|claim)\b",
        ),
        explanation="Liability waivers can reduce another party's responsibility if something goes wrong.",
        plain_english="You may have fewer options to recover losses or bring claims later.",
        questions=(
            "What claims or damages am I waiving?",
            "Does this apply even if the other party is negligent?",
            "Is there a cap on what the other party must pay?",
        ),
    ),
    ClauseRule(
        id="non_compete",
        title="Non-compete",
        category="Employment restrictions",
        severity="High",
        patterns=(
            r"\bnon[- ]compete\b",
            r"\bnot compete\b",
            r"\brestrict(?:ed|ion) .{0,80} employment\b",
            r"\bcompetitive business\b",
        ),
        explanation="Non-compete terms may restrict where or how you can work later.",
        plain_english="Signing may limit future jobs, clients, or business opportunities.",
        questions=(
            "How long does the restriction last?",
            "What geography, industry, or roles are restricted?",
            "Is the restriction enforceable where I live or work?",
        ),
    ),
    ClauseRule(
        id="non_solicit",
        title="Non-solicit",
        category="Employment restrictions",
        severity="Medium",
        patterns=(
            r"\bnon[- ]solicit\b",
            r"\bnot solicit\b",
            r"\bsolicit(?:ing)? (?:employees|clients|customers)\b",
        ),
        explanation="Non-solicit terms can limit contact with customers, clients, or coworkers.",
        plain_english="You may be restricted from working with or contacting certain people after the agreement ends.",
        questions=(
            "Which people or organizations are covered?",
            "How long does the restriction last?",
            "What normal business activities are still allowed?",
        ),
    ),
    ClauseRule(
        id="data_sharing_privacy",
        title="Data sharing or privacy risk",
        category="Privacy",
        severity="Medium",
        patterns=(
            r"\bshare .{0,80} (?:data|information|personal information)\b",
            r"\bthird parties\b",
            r"\bcookies\b",
            r"\bpersonal data\b",
            r"\badvertising partners?\b",
            r"\baffiliates\b.{0,80}\b(?:data|information|personal information)\b",
            r"\bsell .{0,80} (?:data|information|personal information)\b",
            r"\btracking\b",
        ),
        explanation="Data sharing terms may allow personal information to be used or shared broadly.",
        plain_english="Your personal information may be shared with others or used in ways you do not expect.",
        questions=(
            "What personal information is collected?",
            "Who can receive my information?",
            "Can I opt out, delete data, or limit sharing?",
        ),
    ),
    ClauseRule(
        id="refund_restriction",
        title="Refund restriction",
        category="Refunds",
        severity="Medium",
        patterns=(
            r"\bno refunds?\b",
            r"\bnon[- ]refundable\b",
            r"\ball sales are final\b",
            r"\brefunds? .{0,80} (?:sole discretion|not available|not provided)\b",
        ),
        explanation="Refund restrictions may prevent you from recovering payments.",
        plain_english="If you change your mind or the service disappoints you, getting money back may be hard.",
        questions=(
            "When are refunds allowed?",
            "Are deposits, setup fees, or prepaid amounts refundable?",
            "Who decides whether a refund is approved?",
        ),
    ),
    ClauseRule(
        id="one_sided_modification",
        title="One-sided modification clause",
        category="Contract changes",
        severity="High",
        patterns=(
            r"\bmodify .{0,80} (?:terms|agreement) .{0,80} (?:at any time|without notice|sole discretion)\b",
            r"\bchange .{0,80} (?:terms|fees|agreement) .{0,80} (?:at any time|without notice)\b",
            r"\bsole discretion\b.{0,80}\b(?:change|modify)\b",
            r"\breserve (?:the )?right .{0,80} (?:change|modify|update)\b",
            r"\bcontinued use\b.{0,80}\b(?:acceptance|agree)\b",
        ),
        explanation="One-sided modification terms may let the other party change important terms later.",
        plain_english="The deal you sign today may be changed later without meaningful approval from you.",
        questions=(
            "What terms can be changed after I sign?",
            "Will I receive notice before changes take effect?",
            "Can I cancel without penalty if terms change?",
        ),
    ),
    ClauseRule(
        id="personal_guarantee",
        title="Personal guarantee",
        category="Personal responsibility",
        severity="High",
        patterns=(
            r"\bpersonal guarantee\b",
            r"\bpersonally liable\b",
            r"\bguarantor\b",
            r"\bindividual liability\b",
        ),
        explanation="A personal guarantee can make you personally responsible for another party's debt or promise.",
        plain_english="If the other person or business does not pay, you may have to pay from your own money.",
        questions=(
            "Am I personally responsible if a business or another person fails to pay?",
            "Is there a dollar limit on the guarantee?",
            "When does the guarantee end?",
        ),
    ),
    ClauseRule(
        id="payment_acceleration",
        title="Payment acceleration or collection costs",
        category="Payments",
        severity="High",
        patterns=(
            r"\ball amounts .{0,80} immediately due\b",
            r"\baccelerat(?:e|ion) .{0,80} payment\b",
            r"\bcollection costs?\b",
            r"\battorneys'? fees\b.{0,80}\b(?:collection|enforcement|default)\b",
        ),
        explanation="This language can make unpaid amounts due all at once and add collection costs.",
        plain_english="If you miss a payment, the bill could suddenly become much bigger.",
        questions=(
            "What happens after one missed payment?",
            "Can all future payments become due immediately?",
            "Would I have to pay collection costs or attorney fees?",
        ),
    ),
    ClauseRule(
        id="intellectual_property",
        title="Broad intellectual property ownership",
        category="Ownership",
        severity="Medium",
        patterns=(
            r"\bassign .{0,80} (?:all rights|intellectual property|work product)\b",
            r"\bwork product\b",
            r"\bexclusive ownership\b",
            r"\bintellectual property\b.{0,80}\b(?:belongs to|owned by|assigned to)\b",
            r"\bsole property\b",
            r"\ball right, title, and interest\b",
        ),
        explanation="IP ownership terms can decide who owns work, ideas, files, designs, or inventions.",
        plain_english="Something you create might belong to someone else after you sign.",
        questions=(
            "What work or ideas would I give up ownership of?",
            "Can I reuse my own templates, portfolio work, or prior ideas?",
            "Does this apply only to work created for this agreement?",
        ),
    ),
    ClauseRule(
        id="confidentiality",
        title="Broad confidentiality duty",
        category="Confidentiality",
        severity="Medium",
        patterns=(
            r"\bconfidential information\b",
            r"\bnon[- ]disclosure\b",
            r"\bnondisclosure\b",
            r"\bproprietary information\b",
            r"\btrade secrets?\b",
            r"\bkeep .{0,80} confidential\b",
            r"\bconfidentiality\b.{0,80}\b(?:indefinitely|survive|forever)\b",
        ),
        explanation="Confidentiality terms can restrict what information you may share and for how long.",
        plain_english="You may be promising to keep certain information secret, sometimes even after the agreement ends.",
        questions=(
            "What information must stay private?",
            "How long does the duty last?",
            "What information can I still share with advisors, family, or future employers?",
        ),
    ),
    ClauseRule(
        id="governing_law_venue",
        title="Governing law or venue",
        category="Dispute location",
        severity="Medium",
        patterns=(
            r"\bgoverned by the laws of\b",
            r"\bchoice of law\b",
            r"\bexclusive jurisdiction\b",
            r"\bjurisdiction and venue\b",
            r"\bvenue\b.{0,80}\b(?:state|county|court)\b",
            r"\bsubmit to jurisdiction\b",
        ),
        explanation="Governing law and venue terms can decide where disputes happen and which rules apply.",
        plain_english="If there is a fight about the agreement, you might have to handle it in a faraway place.",
        questions=(
            "Where would a dispute have to be handled?",
            "Would travel or out-of-state rules make it harder for me?",
            "Can the dispute location be changed to somewhere fairer?",
        ),
    ),
    ClauseRule(
        id="assignment",
        title="Assignment to another party",
        category="Transfer",
        severity="Medium",
        patterns=(
            r"\bassign (?:this agreement|its rights|its obligations)\b",
            r"\btransfer (?:this agreement|its rights|its obligations)\b",
            r"\bwithout (?:your|prior) consent\b.{0,80}\b(?:assign|transfer)\b",
            r"\bassign\b.{0,80}\bwithout (?:your|prior) consent\b",
        ),
        explanation="Assignment terms may let the other party transfer the agreement to someone else.",
        plain_english="You could end up dealing with a different company or person than the one you chose.",
        questions=(
            "Can the other party transfer this agreement without asking me?",
            "Would the new party have the same duties?",
            "Can I cancel if the agreement is transferred?",
        ),
    ),
    ClauseRule(
        id="indemnification",
        title="Indemnification duty",
        category="Responsibility for claims",
        severity="High",
        patterns=(
            r"\bindemnif(?:y|ication)\b",
            r"\bdefend .{0,80} hold harmless\b",
            r"\bhold .{0,80} harmless\b.{0,80}\b(?:claims|losses|liability)\b",
        ),
        explanation="Indemnification language can make you responsible for claims, losses, or costs connected to the agreement.",
        plain_english="You may have to pay for problems, claims, or costs that involve the other party.",
        questions=(
            "What claims or costs would I have to cover?",
            "Does this include attorney fees or third-party claims?",
            "Can the duty be limited to problems I directly caused?",
        ),
    ),
    ClauseRule(
        id="unilateral_termination",
        title="One-sided termination right",
        category="Termination",
        severity="Medium",
        patterns=(
            r"\bmay terminate .{0,80} (?:at any time|without cause|without notice)\b",
            r"\bright to terminate .{0,80} (?:at any time|without cause|without notice)\b",
            r"\bterminate .{0,80} sole discretion\b",
        ),
        explanation="One-sided termination language may let the other party end the agreement with little warning.",
        plain_english="The other side may be able to end the deal suddenly while you still have duties or costs.",
        questions=(
            "Can either side terminate, or only one side?",
            "How much notice is required before termination?",
            "What payments, refunds, or duties survive termination?",
        ),
    ),
    ClauseRule(
        id="medical_consent",
        title="Medical care consent",
        category="Waiver or release",
        severity="Medium",
        patterns=(
            r"\bmedical (?:care )?consent\b",
            r"\bemergency medical\b",
            r"\bauthorize .{0,80} (?:medical|first aid|treatment)\b",
        ),
        explanation="Medical consent language may authorize treatment or transport if something happens during an activity.",
        plain_english="Someone may be allowed to get medical help for you, but the agreement may also limit claims about that care.",
        questions=(
            "Who can authorize medical help?",
            "Who pays medical or transport costs?",
            "Are claims about first aid or delayed care waived?",
        ),
    ),
)

CHILD_FRIENDLY_DETAILS = {
    "arbitration": {
        "why": "This can move a disagreement away from a normal court. That may change your choices if something goes wrong.",
        "check": [
            "Look for words like arbitration, class action, jury trial, or right to sue.",
            "Check whether you can say no to arbitration before a deadline.",
            "Check who pays the arbitration costs.",
        ],
    },
    "auto_renewal": {
        "why": "The agreement may restart by itself. You might keep paying even if you forgot about it.",
        "check": [
            "Find the renewal date.",
            "Find the last day you can cancel.",
            "Check if they promise to remind you before renewal.",
        ],
    },
    "cancellation_restriction": {
        "why": "The agreement may make leaving hard. Missing one step could keep you stuck.",
        "check": [
            "Find the exact cancellation steps.",
            "Check if cancellation must be in writing.",
            "Check what happens if you cancel late.",
        ],
    },
    "early_termination_penalty": {
        "why": "Leaving early may cost extra money. That can make the agreement expensive to escape.",
        "check": [
            "Find the exact fee or formula.",
            "Check if any situations let you leave without a fee.",
            "Ask for the fee to be capped or removed.",
        ],
    },
    "hidden_fees": {
        "why": "Small extra fees can add up. The real price may be higher than the price you saw first.",
        "check": [
            "Ask for a full fee list.",
            "Check which fees repeat every month or year.",
            "Check if fees can change later.",
        ],
    },
    "liability_waiver": {
        "why": "This can limit what the other party owes you if you are hurt, lose money, or something breaks.",
        "check": [
            "Find what claims you are giving up.",
            "Check if the other party is protected even when they make a mistake.",
            "Look for a dollar cap on what they must pay.",
        ],
    },
    "non_compete": {
        "why": "This can limit where you work or what business you can do later.",
        "check": [
            "Find how long the restriction lasts.",
            "Find what jobs, locations, or customers are covered.",
            "Ask whether the rule applies where you live or work.",
        ],
    },
    "non_solicit": {
        "why": "This can limit who you can contact after the agreement ends.",
        "check": [
            "Find which clients, customers, or coworkers are covered.",
            "Find how long the restriction lasts.",
            "Ask what normal contact is still allowed.",
        ],
    },
    "data_sharing_privacy": {
        "why": "Your personal information may be shared, sold, tracked, or used in ways you did not expect.",
        "check": [
            "Find what data they collect.",
            "Find who they share it with.",
            "Check if you can opt out or delete your data.",
        ],
    },
    "refund_restriction": {
        "why": "You may not get your money back, even if you stop using the product or service.",
        "check": [
            "Find when refunds are allowed.",
            "Check if deposits or setup fees are refundable.",
            "Ask who decides if a refund is approved.",
        ],
    },
    "one_sided_modification": {
        "why": "The other party may be able to change the deal after you sign.",
        "check": [
            "Find what terms can be changed.",
            "Check if they must tell you first.",
            "Ask if you can cancel without a fee after a change.",
        ],
    },
    "personal_guarantee": {
        "why": "Your personal money or property may be at risk if someone else does not pay.",
        "check": [
            "Find who is personally responsible.",
            "Look for a dollar limit.",
            "Find when the promise ends.",
        ],
    },
    "payment_acceleration": {
        "why": "A missed payment may make many payments due at once, plus extra costs.",
        "check": [
            "Find what counts as default.",
            "Check if future payments become due immediately.",
            "Check if collection costs or attorney fees are added.",
        ],
    },
    "intellectual_property": {
        "why": "The agreement may decide who owns your work, ideas, designs, code, photos, or files.",
        "check": [
            "Find what work is covered.",
            "Protect work you made before this agreement.",
            "Ask if you can show the work in a portfolio.",
        ],
    },
    "confidentiality": {
        "why": "You may be promising to keep information secret for a long time.",
        "check": [
            "Find what information is confidential.",
            "Find how long the duty lasts.",
            "Check who you are still allowed to talk to.",
        ],
    },
    "governing_law_venue": {
        "why": "A dispute may have to happen in a specific state, county, or court.",
        "check": [
            "Find the state or court named in the clause.",
            "Think about travel and cost.",
            "Ask if the location can be changed.",
        ],
    },
    "assignment": {
        "why": "The other party may hand the agreement to someone else.",
        "check": [
            "Find if your permission is required first.",
            "Check if the new party must follow the same promises.",
            "Ask if you can cancel after a transfer.",
        ],
    },
    "indemnification": {
        "why": "You may have to protect or pay back the other side if a claim happens.",
        "check": [
            "Find exactly which claims or losses are covered.",
            "Check if attorney fees are included.",
            "Ask for the duty to apply only when you caused the problem.",
        ],
    },
    "unilateral_termination": {
        "why": "The other side may be able to end the agreement quickly or unfairly.",
        "check": [
            "Find who can terminate and why.",
            "Check how much notice is required.",
            "Check what money or duties survive after termination.",
        ],
    },
    "medical_consent": {
        "why": "Someone may be allowed to get medical help for you, and claims about that help may be limited.",
        "check": [
            "Find who can authorize treatment.",
            "Check who pays emergency costs.",
            "Check whether first-aid claims are waived.",
        ],
    },
}

RISK_DOCUMENT_TYPE_FIT = {
    "arbitration": ("Contractor/freelance agreement", "Terms of service", "Waiver/release form"),
    "auto_renewal": ("Lease agreement", "Terms of service"),
    "cancellation_restriction": ("Lease agreement", "Terms of service"),
    "early_termination_penalty": ("Lease agreement", "Employment agreement"),
    "hidden_fees": ("Lease agreement", "Terms of service"),
    "liability_waiver": ("Waiver/release form", "Contractor/freelance agreement"),
    "non_compete": ("Employment agreement", "Contractor/freelance agreement"),
    "non_solicit": ("Employment agreement", "Contractor/freelance agreement"),
    "data_sharing_privacy": ("Privacy policy", "Terms of service"),
    "refund_restriction": ("Terms of service", "Lease agreement"),
    "one_sided_modification": ("Terms of service", "Privacy policy"),
    "personal_guarantee": ("Lease agreement", "Contractor/freelance agreement"),
    "payment_acceleration": ("Contractor/freelance agreement", "Lease agreement"),
    "intellectual_property": ("Contractor/freelance agreement", "Employment agreement", "Waiver/release form"),
    "confidentiality": ("Non-disclosure agreement", "Employment agreement", "Contractor/freelance agreement"),
    "governing_law_venue": ("Non-disclosure agreement", "Contractor/freelance agreement"),
    "assignment": ("Contractor/freelance agreement", "Terms of service"),
    "indemnification": ("Contractor/freelance agreement", "Waiver/release form"),
    "unilateral_termination": ("Employment agreement", "Terms of service"),
    "medical_consent": ("Waiver/release form",),
}


def analyze_document(
    text: str,
    document_name: Optional[str] = None,
    preferences: Optional[UserPreferences] = None,
) -> AnalysisResponse:
    cleaned_text = normalize_spacing(text)
    classification = classify_document(cleaned_text)
    risks = _detect_risks(cleaned_text, classification.document_type)
    obligations = extract_obligations(cleaned_text)
    deadlines = extract_deadlines(cleaned_text)
    parties = extract_parties(cleaned_text)
    score = calculate_risk_score(risks, classification.document_type, preferences)

    return AnalysisResponse(
        document_name=document_name,
        document_type=classification.document_type,
        document_type_confidence=classification.confidence,
        document_type_signals=classification.matched_signals,
        document_type_explanation=classification.explanation,
        summary=build_summary(cleaned_text, risks, classification.document_type),
        risk_score=score,
        risk_level=get_risk_level(score),
        scoring_notes=build_scoring_notes(risks, classification.document_type, preferences),
        detected_risks=risks,
        obligations=obligations,
        deadlines=deadlines,
        questions_to_ask=build_questions_to_ask(risks),
        next_steps=build_next_steps(risks),
        parties=parties,
        word_count=len(cleaned_text.split()),
        disclaimer=DISCLAIMER,
    )


def _detect_risks(text: str, document_type: str) -> list[RiskItem]:
    detected: list[RiskItem] = []

    for rule in CLAUSE_RULES:
        trigger_terms: list[str] = []
        matched_snippets: list[str] = []
        total_matches = 0
        for pattern in rule.patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE | re.DOTALL):
                total_matches += 1
                term = normalize_spacing(match.group(0))
                if term and term.lower() not in {item.lower() for item in trigger_terms}:
                    trigger_terms.append(term[:140])
                snippet = _snippet_for_match(text, match.start(), match.end())
                if snippet and snippet.lower() not in {item.lower() for item in matched_snippets}:
                    matched_snippets.append(snippet)
                if len(trigger_terms) >= 5:
                    break
            if len(trigger_terms) >= 5:
                break

        if trigger_terms:
            details = CHILD_FRIENDLY_DETAILS.get(rule.id, {"why": rule.plain_english, "check": []})
            detected.append(
                RiskItem(
                    id=rule.id,
                    title=rule.title,
                    category=rule.category,
                    severity=rule.severity,
                    explanation=rule.explanation,
                    plain_english=rule.plain_english,
                    why_it_matters=details["why"],
                    confidence=_risk_confidence(rule, total_matches, len(trigger_terms), document_type),
                    questions=list(rule.questions),
                    what_to_check=list(details["check"]),
                    trigger_terms=trigger_terms,
                    matched_snippets=matched_snippets[:3],
                )
            )

    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    return sorted(
        detected,
        key=lambda item: (severity_order.get(item.severity, 3), -item.confidence, item.title),
    )


def _snippet_for_match(text: str, start: int, end: int) -> str:
    left_boundary = max([
        text.rfind(".", 0, start),
        text.rfind("?", 0, start),
        text.rfind("!", 0, start),
        text.rfind("\n", 0, start),
    ])
    left = left_boundary + 1 if left_boundary != -1 else 0

    right_candidates = [
        index for index in (
            text.find(".", end),
            text.find("?", end),
            text.find("!", end),
            text.find("\n", end),
        )
        if index != -1
    ]
    right = min(right_candidates) + 1 if right_candidates else min(len(text), end + 180)

    return normalize_spacing(text[left:right])


def _risk_confidence(
    rule: ClauseRule,
    match_count: int,
    unique_trigger_count: int,
    document_type: str,
) -> int:
    confidence = 48 + min(match_count, 5) * 8 + min(unique_trigger_count, 4) * 6
    if document_type in rule.document_types or document_type in RISK_DOCUMENT_TYPE_FIT.get(rule.id, ()):
        confidence += 10
    if rule.severity == "High":
        confidence += 3
    return max(35, min(98, confidence))
