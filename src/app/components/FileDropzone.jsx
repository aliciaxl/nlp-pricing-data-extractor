import { useState } from "react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/html",
  "text/plain",
  "text/htm",
];

export default function FileDropzone({ onFileSelect, onError }) {
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file) => {
    if (!file) return false;
    return ACCEPTED_TYPES.includes(file.type);
  };

  const handleFile = (file) => {
    if (!file) {
      onFileSelect(null);
      onError(null);
      return;
    }

    if (!validateFile(file)) {
      onError("File must be PDF, HTML, or TXT format");
      onFileSelect(null);
    } else {
      onError(null);
      onFileSelect(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  return (
    <label
      htmlFor="dropzone-file"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-[#fdfcfe] hover:bg-[#f0f2ff] transition-colors duration-200 ${
        dragActive ? "border-[#3c47b8] bg-[#e1e6ff]" : "border-[#a9aff6]"
      }`}
    >
      <div className="flex flex-col items-center justify-center pt-3 pb-3">
        <svg
          className="w-6 h-6 mb-2 text-[#a9aff6]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 16"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
        </svg>
        <p className="mb-1 text-sm text-[#6470f1] font-semibold">
          Drag & drop files or <span className="underline">click to browse</span>
        </p>
        <p className="text-xs text-gray-400">PDF, HTML, or TXT files only</p>
      </div>
      <input
        id="dropzone-file"
        type="file"
        accept=".pdf,.html,.htm,.txt"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
        className="hidden"
      />
    </label>
  );
}
