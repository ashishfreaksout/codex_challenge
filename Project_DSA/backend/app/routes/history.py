from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import (
    RenameAnalysisRequest,
    SaveAnalysisRequest,
    SavedAnalysisDetail,
    SavedAnalysisSummary,
    UserProfile,
)
from app.routes.auth import get_current_user
from app.services.storage import (
    delete_saved_analysis,
    get_saved_analysis,
    list_saved_analyses,
    rename_saved_analysis,
    save_analysis,
)

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("", response_model=list[SavedAnalysisSummary])
def list_history(user: UserProfile = Depends(get_current_user)) -> list[SavedAnalysisSummary]:
    return list_saved_analyses(user.id)


@router.post("", response_model=SavedAnalysisDetail)
def save_history_item(
    payload: SaveAnalysisRequest,
    user: UserProfile = Depends(get_current_user),
) -> SavedAnalysisDetail:
    return save_analysis(user.id, payload.analysis, payload.document_name)


@router.get("/{analysis_id}", response_model=SavedAnalysisDetail)
def get_history_item(
    analysis_id: str,
    user: UserProfile = Depends(get_current_user),
) -> SavedAnalysisDetail:
    saved = get_saved_analysis(user.id, analysis_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved analysis not found.")
    return saved


@router.patch("/{analysis_id}", response_model=SavedAnalysisDetail)
def rename_history_item(
    analysis_id: str,
    payload: RenameAnalysisRequest,
    user: UserProfile = Depends(get_current_user),
) -> SavedAnalysisDetail:
    saved = rename_saved_analysis(user.id, analysis_id, payload.document_name.strip())
    if not saved:
        raise HTTPException(status_code=404, detail="Saved analysis not found.")
    return saved


@router.delete("/{analysis_id}")
def delete_history_item(
    analysis_id: str,
    user: UserProfile = Depends(get_current_user),
) -> dict[str, bool]:
    deleted = delete_saved_analysis(user.id, analysis_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved analysis not found.")
    return {"deleted": True}
