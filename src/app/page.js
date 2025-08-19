"use client";
import { useState } from "react";
import FileDropzone from "./components/FileDropzone";

export default function Home() {
  const [emailText, setEmailText] = useState("");
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [inputMethod, setInputMethod] = useState("text"); // "text" or "file"
  const isDisabled = loading || (inputMethod === "text" && !emailText.trim()) || (inputMethod === "file" && !file) || fileError;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      if (inputMethod === "text") {
        formData.append("emailText", emailText);
      } else {
        formData.append("emailText", ""); // Empty text when using file
        if (file) formData.append("file", file);
      }

      const res = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-host flex items-center justify-center bg-[#fdfcfe] p-8">
      <div className="w-full max-w-[768px]">
        <h1 className="text-3xl font-satoshi font-semibold mb-4">
          Hotel Quote Parser
        </h1>

        <div className="mb-6">
          {/* Input Method Toggle */}
          <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setInputMethod("text");
                setFile(null);
                setFileError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMethod === "text"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Paste Text
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMethod("file");
                setEmailText("");
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                inputMethod === "file"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Upload File
            </button>
          </div>

          {/* Text Input */}
          {inputMethod === "text" && (
            <div>
              <label className="block mb-2">
                Paste Email Content (HTML/plain text)
                <span className="text-red-600 ml-1">*</span>:
              </label>
              <textarea
                rows={10}
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Paste email content here..."
                className="w-full p-3 border font-satoshi rounded-xl resize-y focus:outline-none focus:border-[#a9aff6] transition-colors duration-200"
              />
            </div>
          )}

          {/* File Upload */}
          {inputMethod === "file" && (
            <div>
              <label className="block mb-2 font-medium">
                Upload File (PDF or HTML):
              </label>
              <FileDropzone onFileSelect={setFile} onError={setFileError} />
              {file && (
                <p className="text-xs mt-1 text-gray-400">
                  Selected file: {file.name}
                </p>
              )}
              {fileError && (
                <p className="mt-1 text-xs text-red-500">{fileError}</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={isDisabled || loading}
          className={`
    px-6 py-2 rounded-xl text-white font-medium transition-colors duration-200
    ${
      loading || isDisabled
        ? "bg-[#a9aff6] cursor-not-allowed"
        : "bg-[#4753d1] hover:bg-[#3c47b8] cursor-pointer"
    }
  `}
        >
          {loading ? "Parsing..." : "Parse Quote"}
        </button>

        {error && <p className="mt-4 text-red-500">{error}</p>}

        {results && (
          <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 border-b border-gray-100 pb-3">
              Extracted Totals
            </h2>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Headers */}
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Category
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">
                Amount
              </div>
              
              {/* Data Rows */}
              
              <div className="text-sm text-gray-700 py-2 border-b border-gray-50">
                Guestroom Total
              </div>
              <div className="text-sm text-gray-900 font-mono py-2 border-b border-gray-50 text-right">
                {results.guestroomTotal !== null
                  ? `$${results.guestroomTotal.toLocaleString()}`
                  : "—"}
              </div>
              
              <div className="text-sm text-gray-700 py-2 border-b border-gray-50">
                Meeting Room Total
              </div>
              <div className="text-sm text-gray-900 font-mono py-2 border-b border-gray-50 text-right">
                {results.meetingRoomTotal !== null
                  ? `$${results.meetingRoomTotal.toLocaleString()}`
                  : "—"}
              </div>
              
              <div className="text-sm text-gray-700 py-2">
                Food & Beverage Total
              </div>
              <div className="text-sm text-gray-900 font-mono py-2 text-right">
                {results.foodBeverageTotal !== null
                  ? `$${results.foodBeverageTotal.toLocaleString()}`
                  : "—"}
              </div>

              <div className="col-span-2 mt-1 bg-blue-50 rounded-lg px-3 py-3 -mx-3">
  <div className="grid grid-cols-2 gap-x-8">
    <div className="text-sm font-bold text-gray-900">
      Total Quote
    </div>
    <div className="text-sm font-black text-gray-900 font-mono text-right">
      {results.totalQuote !== null
        ? `$${results.totalQuote.toLocaleString()}`
        : "—"}
    </div>
  </div>
</div>
            </div>

            {/* AI Confidence & Notes */}
            {results.confidence && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Confidence: {Math.round(results.confidence * 100)}%</span>
                  {results.hasLinkedContent && (
                    <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                      Includes linked content
                    </span>
                  )}
                </div>
                {results.aiNotes && (
                  <p className="text-xs text-gray-400 mt-2 italic">
                    {results.aiNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}