from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import re
from typing import Optional
import zipfile
from xml.etree import ElementTree

from app.services.ocr import extract_image_text
from app.utils.text import normalize_spacing


@dataclass(frozen=True)
class ExtractedDocument:
    text: str
    page_count: int
    file_type: str


SUPPORTED_DOCUMENT_EXTENSIONS = {
    ".pdf": "PDF",
    ".docx": "DOCX",
    ".odt": "ODT",
    ".rtf": "RTF",
    ".txt": "TXT",
    ".md": "Markdown",
    ".markdown": "Markdown",
    ".jpg": "Image OCR",
    ".jpeg": "Image OCR",
    ".png": "Image OCR",
    ".tif": "Image OCR",
    ".tiff": "Image OCR",
    ".bmp": "Image OCR",
    ".webp": "Image OCR",
}

SUPPORTED_DOCUMENT_MIME_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.oasis.opendocument.text": ".odt",
    "application/rtf": ".rtf",
    "application/x-rtf": ".rtf",
    "text/rtf": ".rtf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/x-markdown": ".md",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
    "image/webp": ".webp",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}

SUPPORTED_FORMATS_MESSAGE = (
    "Please upload a PDF, DOCX, ODT, RTF, TXT, Markdown, JPG, PNG, TIFF, BMP, or WebP file."
)


def extract_document_text(
    file_bytes: bytes,
    filename: str = "",
    content_type: Optional[str] = None,
) -> ExtractedDocument:
    extension = _detect_extension(filename, content_type)

    if extension == ".pdf":
        return extract_pdf_text(file_bytes)
    if extension == ".docx":
        return _extract_docx_text(file_bytes)
    if extension == ".odt":
        return _extract_odt_text(file_bytes)
    if extension == ".rtf":
        return _extract_rtf_text(file_bytes)
    if extension in {".txt", ".md", ".markdown"}:
        return _extract_plain_text(file_bytes, SUPPORTED_DOCUMENT_EXTENSIONS[extension])
    if extension in IMAGE_EXTENSIONS:
        ocr_result = extract_image_text(file_bytes)
        return ExtractedDocument(
            text=ocr_result.text,
            page_count=ocr_result.page_count,
            file_type=SUPPORTED_DOCUMENT_EXTENSIONS[extension],
        )

    raise ValueError(SUPPORTED_FORMATS_MESSAGE)


def extract_pdf_text(file_bytes: bytes) -> ExtractedDocument:
    if not file_bytes:
        raise ValueError("The uploaded PDF is empty.")

    if not file_bytes.lstrip().startswith(b"%PDF-"):
        raise ValueError("The uploaded file is not a valid PDF document.")

    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError(
            "PDF extraction dependency is missing. Install backend requirements first."
        ) from exc

    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("The uploaded file could not be opened as a PDF.") from exc

    try:
        if document.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported in the Phase 1 MVP.")

        page_text = []
        for page in document:
            text = page.get_text("text")
            if text:
                page_text.append(text)

        extracted_text = normalize_spacing("\n".join(page_text))
        if not extracted_text:
            raise ValueError(
                "No selectable text was found. Try uploading clear image scans after OCR setup, or paste the text manually."
            )

        return ExtractedDocument(text=extracted_text, page_count=document.page_count, file_type="PDF")
    finally:
        document.close()


def _detect_extension(filename: str, content_type: Optional[str]) -> str:
    extension = Path(filename or "").suffix.lower()
    normalized_content_type = (content_type or "").split(";")[0].strip().lower()

    if extension == ".doc" or normalized_content_type == "application/msword":
        raise ValueError(
            "Legacy .doc files are not supported. Save the file as DOCX, PDF, RTF, or TXT and upload it again."
        )

    if extension in SUPPORTED_DOCUMENT_EXTENSIONS:
        return extension

    if normalized_content_type in SUPPORTED_DOCUMENT_MIME_TYPES:
        return SUPPORTED_DOCUMENT_MIME_TYPES[normalized_content_type]

    return ""


def _extract_docx_text(file_bytes: bytes) -> ExtractedDocument:
    if not file_bytes:
        raise ValueError("The uploaded DOCX file is empty.")

    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
            document_xml = archive.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("The uploaded file could not be opened as a DOCX document.") from exc

    try:
        root = ElementTree.fromstring(document_xml)
    except ElementTree.ParseError as exc:
        raise ValueError("The DOCX document XML could not be parsed.") from exc

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []

    for paragraph in root.findall(".//w:p", namespace):
        parts = []
        for node in paragraph.iter():
            tag_name = _local_xml_name(node.tag)
            if tag_name == "t" and node.text:
                parts.append(node.text)
            elif tag_name == "tab":
                parts.append("\t")
            elif tag_name in {"br", "cr"}:
                parts.append("\n")

        paragraph_text = "".join(parts).strip()
        if paragraph_text:
            paragraphs.append(paragraph_text)

    return _build_text_document(paragraphs, "DOCX", "No readable text was found in the DOCX file.")


def _extract_odt_text(file_bytes: bytes) -> ExtractedDocument:
    if not file_bytes:
        raise ValueError("The uploaded ODT file is empty.")

    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
            content_xml = archive.read("content.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("The uploaded file could not be opened as an ODT document.") from exc

    try:
        root = ElementTree.fromstring(content_xml)
    except ElementTree.ParseError as exc:
        raise ValueError("The ODT document XML could not be parsed.") from exc

    paragraphs = []
    for node in root.iter():
        if _local_xml_name(node.tag) not in {"p", "h"}:
            continue

        paragraph_text = "".join(node.itertext()).strip()
        if paragraph_text:
            paragraphs.append(paragraph_text)

    return _build_text_document(paragraphs, "ODT", "No readable text was found in the ODT file.")


def _extract_plain_text(file_bytes: bytes, file_type: str) -> ExtractedDocument:
    if not file_bytes:
        raise ValueError(f"The uploaded {file_type} file is empty.")

    decoded_text = _decode_text_file(file_bytes)
    extracted_text = normalize_spacing(decoded_text)
    if not extracted_text:
        raise ValueError(f"No readable text was found in the {file_type} file.")

    return ExtractedDocument(text=extracted_text, page_count=1, file_type=file_type)


def _extract_rtf_text(file_bytes: bytes) -> ExtractedDocument:
    if not file_bytes:
        raise ValueError("The uploaded RTF file is empty.")

    raw_text = _decode_text_file(file_bytes)
    extracted_text = normalize_spacing(_rtf_to_text(raw_text))
    if not extracted_text:
        raise ValueError("No readable text was found in the RTF file.")

    return ExtractedDocument(text=extracted_text, page_count=1, file_type="RTF")


def _build_text_document(paragraphs: list[str], file_type: str, empty_message: str) -> ExtractedDocument:
    extracted_text = normalize_spacing("\n".join(paragraphs))
    if not extracted_text:
        raise ValueError(empty_message)

    return ExtractedDocument(text=extracted_text, page_count=1, file_type=file_type)


def _decode_text_file(file_bytes: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

    return file_bytes.decode("utf-8", errors="replace")


def _local_xml_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _rtf_to_text(rtf: str) -> str:
    destinations = {
        "fonttbl",
        "colortbl",
        "datastore",
        "footer",
        "footerf",
        "footerl",
        "footerr",
        "header",
        "headerf",
        "headerl",
        "headerr",
        "info",
        "object",
        "pict",
        "stylesheet",
    }

    text = []
    stack = []
    ignorable = False
    unicode_skip_count = 1
    skip_chars = 0
    index = 0

    while index < len(rtf):
        character = rtf[index]

        if character == "{":
            stack.append((ignorable, unicode_skip_count))
            index += 1
            continue

        if character == "}":
            if stack:
                ignorable, unicode_skip_count = stack.pop()
            index += 1
            continue

        if character == "\\":
            index += 1
            if index >= len(rtf):
                break

            escaped = rtf[index]
            if escaped in "\\{}":
                if not ignorable and skip_chars == 0:
                    text.append(escaped)
                elif skip_chars > 0:
                    skip_chars -= 1
                index += 1
                continue

            if escaped == "*":
                ignorable = True
                index += 1
                continue

            if escaped == "'":
                hex_value = rtf[index + 1:index + 3]
                if re.fullmatch(r"[0-9a-fA-F]{2}", hex_value):
                    if not ignorable and skip_chars == 0:
                        text.append(bytes.fromhex(hex_value).decode("cp1252", errors="replace"))
                    elif skip_chars > 0:
                        skip_chars -= 1
                    index += 3
                    continue

            if escaped in "\r\n":
                index += 1
                continue

            match = re.match(r"([a-zA-Z]+)(-?\d+)? ?", rtf[index:])
            if not match:
                if not ignorable and skip_chars == 0:
                    text.append(escaped)
                index += 1
                continue

            word, parameter = match.group(1), match.group(2)
            index += len(match.group(0))

            if word in destinations:
                ignorable = True
            elif word == "uc" and parameter:
                unicode_skip_count = int(parameter)
            elif word == "u" and parameter:
                if not ignorable:
                    codepoint = int(parameter)
                    if codepoint < 0:
                        codepoint += 65536
                    text.append(chr(codepoint))
                    skip_chars = unicode_skip_count
            elif word in {"par", "line"}:
                if not ignorable:
                    text.append("\n")
            elif word == "tab":
                if not ignorable:
                    text.append("\t")

            continue

        if character in "\r\n":
            index += 1
            continue

        if skip_chars > 0:
            skip_chars -= 1
        elif not ignorable:
            text.append(character)

        index += 1

    return "".join(text)
