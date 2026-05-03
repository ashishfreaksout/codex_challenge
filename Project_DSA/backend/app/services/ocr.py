from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from app.utils.text import normalize_spacing


class OCRNotConfiguredError(RuntimeError):
    """Raised when image OCR dependencies or the OCR engine are unavailable."""


@dataclass(frozen=True)
class OCRResult:
    text: str
    page_count: int


def extract_image_text(file_bytes: bytes) -> OCRResult:
    if not file_bytes:
        raise ValueError("The uploaded image is empty.")

    try:
        from PIL import Image, ImageOps, ImageSequence, UnidentifiedImageError
        import pytesseract
    except ImportError as exc:
        raise OCRNotConfiguredError(
            "Image OCR is not configured yet. Install Pillow and pytesseract with backend requirements."
        ) from exc

    try:
        image = Image.open(BytesIO(file_bytes))
    except UnidentifiedImageError as exc:
        raise ValueError("The uploaded file could not be opened as an image.") from exc

    page_text = []
    page_count = 0

    try:
        for frame in ImageSequence.Iterator(image):
            page_count += 1
            prepared_image = _prepare_for_ocr(frame, Image, ImageOps)
            try:
                text = pytesseract.image_to_string(prepared_image, config="--psm 6")
            except pytesseract.pytesseract.TesseractNotFoundError as exc:
                raise OCRNotConfiguredError(
                    "Tesseract OCR is not installed. Install the Tesseract engine to read scanned images."
                ) from exc

            cleaned_text = normalize_spacing(text)
            if cleaned_text:
                page_text.append(cleaned_text)
    finally:
        image.close()

    extracted_text = normalize_spacing("\n\n".join(page_text))
    if not extracted_text:
        raise ValueError(
            "No readable text was found in the image. Try a sharper, well-lit scan or paste the text manually."
        )

    return OCRResult(text=extracted_text, page_count=max(page_count, 1))


def _prepare_for_ocr(frame, image_module, image_ops_module):
    image = image_ops_module.exif_transpose(frame.convert("RGB"))
    image = image_ops_module.grayscale(image)
    image = image_ops_module.autocontrast(image)

    width, height = image.size
    longest_side = max(width, height)
    if longest_side and longest_side < 1800:
        scale = 1800 / longest_side
        new_size = (int(width * scale), int(height * scale))
        resampling_filter = getattr(getattr(image_module, "Resampling", image_module), "LANCZOS")
        image = image.resize(new_size, resampling_filter)

    return image
