from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import DocumentTextResponse
from app.services.document_extraction import (
    SUPPORTED_FORMATS_MESSAGE,
    ExtractedDocument,
    extract_document_text,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_BATCH_UPLOAD_BYTES = 30 * 1024 * 1024


@router.post("/extract", response_model=DocumentTextResponse)
async def extract_document(file: UploadFile = File(...)) -> DocumentTextResponse:
    return await _extract_uploaded_document(file)


@router.post("/extract-pdf", response_model=DocumentTextResponse)
async def extract_pdf(file: UploadFile = File(...)) -> DocumentTextResponse:
    return await _extract_uploaded_document(file)


@router.post("/extract-batch", response_model=DocumentTextResponse)
async def extract_document_batch(files: list[UploadFile] = File(...)) -> DocumentTextResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one file.")

    extracted_documents = []
    total_bytes = 0

    for file in files:
        filename = file.filename or "uploaded-document"
        try:
            contents = await file.read()
        finally:
            await file.close()

        total_bytes += len(contents)
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"{filename} is too large. Please upload files under 15 MB each.",
            )
        if total_bytes > MAX_BATCH_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="The selected files are too large together. Please keep the batch under 30 MB.",
            )

        extracted_documents.append(
            {
                "filename": filename,
                "document": _extract_contents(
                    contents,
                    filename=filename,
                    content_type=file.content_type,
                ),
            }
        )

    combined_text = "\n\n".join(
        f"--- {item['filename']} ---\n{item['document'].text}"
        for item in extracted_documents
    )
    file_names = ", ".join(item["filename"] for item in extracted_documents[:3])
    if len(extracted_documents) > 3:
        file_names += f", +{len(extracted_documents) - 3} more"

    return DocumentTextResponse(
        file_name=file_names,
        page_count=sum(item["document"].page_count for item in extracted_documents),
        file_type="Multiple files",
        text=combined_text,
    )


async def _extract_uploaded_document(file: UploadFile) -> DocumentTextResponse:
    filename = file.filename or "uploaded-document"
    try:
        contents = await file.read()
    finally:
        await file.close()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Document is too large for the Phase 1 MVP. Please upload a file under 15 MB.",
        )

    extracted = _extract_contents(contents, filename=filename, content_type=file.content_type)

    return DocumentTextResponse(
        file_name=filename,
        page_count=extracted.page_count,
        file_type=extracted.file_type,
        text=extracted.text,
    )


def _extract_contents(
    contents: bytes,
    filename: str,
    content_type: Optional[str],
) -> ExtractedDocument:
    try:
        return extract_document_text(contents, filename=filename, content_type=content_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc) or SUPPORTED_FORMATS_MESSAGE) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
