from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import AnalysisResponse, AnalyzeRequest
from app.services.risk_analyzer import analyze_document
from app.services.storage import get_user_by_token

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_agreement(
    payload: AnalyzeRequest,
    authorization: Optional[str] = Header(default=None),
) -> AnalysisResponse:
    text = payload.text.strip()
    if len(text) < 20:
        raise HTTPException(
            status_code=400,
            detail="Please provide more agreement text before analyzing.",
        )

    preferences = payload.preferences
    if preferences is None and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        user = get_user_by_token(token)
        if user:
            preferences = user.preferences

    return analyze_document(
        text=text,
        document_name=payload.document_name,
        preferences=preferences,
    )
