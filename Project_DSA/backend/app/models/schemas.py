from typing import Optional

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    privacy: bool = False
    hidden_fees: bool = False
    employment_restrictions: bool = False
    cancellation_refunds: bool = False


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=20, max_length=250_000)
    document_name: Optional[str] = Field(default=None, max_length=160)
    preferences: Optional[UserPreferences] = None


class RiskItem(BaseModel):
    id: str
    title: str
    category: str
    severity: str
    confidence: int = Field(default=0, ge=0, le=100)
    explanation: str
    plain_english: str
    why_it_matters: str = ""
    questions: list[str] = Field(default_factory=list)
    what_to_check: list[str] = Field(default_factory=list)
    trigger_terms: list[str] = Field(default_factory=list)
    matched_snippets: list[str] = Field(default_factory=list)


class PartyInfo(BaseModel):
    name: str
    role: Optional[str] = None
    description: str
    source_text: Optional[str] = None


class DocumentClassification(BaseModel):
    document_type: str
    confidence: int = Field(default=0, ge=0, le=100)
    matched_signals: list[str] = Field(default_factory=list)
    explanation: str


class AnalysisResponse(BaseModel):
    document_name: Optional[str] = None
    document_type: str = "Unknown document"
    document_type_confidence: int = Field(default=0, ge=0, le=100)
    document_type_signals: list[str] = Field(default_factory=list)
    document_type_explanation: str = ""
    summary: str
    risk_score: int
    risk_level: str
    scoring_notes: list[str] = Field(default_factory=list)
    detected_risks: list[RiskItem] = Field(default_factory=list)
    obligations: list[str] = Field(default_factory=list)
    deadlines: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    parties: list[PartyInfo] = Field(default_factory=list)
    word_count: int
    disclaimer: str


class DocumentTextResponse(BaseModel):
    file_name: Optional[str] = None
    page_count: int
    file_type: Optional[str] = None
    text: str


class AuthRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)


class UserProfile(BaseModel):
    id: int
    email: str
    preferences: UserPreferences


class AuthResponse(BaseModel):
    token: str
    user: UserProfile


class SaveAnalysisRequest(BaseModel):
    analysis: AnalysisResponse
    document_name: Optional[str] = Field(default=None, max_length=160)


class SavedAnalysisSummary(BaseModel):
    id: str
    document_name: str
    document_type: str
    risk_score: int
    risk_level: str
    finding_count: int
    created_at: str
    updated_at: str


class SavedAnalysisDetail(SavedAnalysisSummary):
    analysis: AnalysisResponse


class RenameAnalysisRequest(BaseModel):
    document_name: str = Field(..., min_length=1, max_length=160)
