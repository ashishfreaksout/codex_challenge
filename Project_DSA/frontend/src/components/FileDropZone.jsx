import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";

const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
  ".pdf",
  ".docx",
  ".odt",
  ".rtf",
  ".txt",
  ".md",
  ".markdown",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".bmp",
  ".webp",
].join(",");

export default function FileDropZone({ documentName, isExtracting, onDocumentSelected }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length > 0) {
      onDocumentSelected(selectedFiles);
    }
  }

  return (
    <div>
      <div
        className={`drop-zone upload-zone flex min-h-72 flex-col items-center justify-center border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? "upload-zone-active border-teal-500"
            : "border-slate-300 hover:border-slate-400"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_DOCUMENT_TYPES}
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <div className="icon-tile mb-4 flex h-12 w-12 items-center justify-center text-teal-700">
          {documentName ? (
            <FileText className="h-6 w-6" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <p className="text-lg font-bold text-slate-950">
          {documentName || "Upload an agreement file"}
        </p>
        <p className="mt-2 max-w-sm text-base leading-7 text-slate-600">
          Supports PDF, DOCX, ODT, RTF, TXT, Markdown, and clear image scans such as JPG,
          PNG, TIFF, BMP, or WebP. Select multiple photos for a multi-page scan.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isExtracting}
          className="primary-action mt-5 inline-flex h-12 items-center gap-2 px-5 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-400"
        >
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          {isExtracting ? "Extracting..." : "Choose files"}
        </button>
      </div>
    </div>
  );
}
