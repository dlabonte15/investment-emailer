"use client";

import { useCallback, useRef, useState } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadResult {
  rowCount: number;
  matchedColumns: string[];
  unmatchedColumns: string[];
  unmappedFields: string[];
}

export default function DataUpload() {
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setState("uploading");
    setResult(null);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/data/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data);
      setState("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Upload failed"
      );
      setState("error");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const reset = () => {
    setState("idle");
    setResult(null);
    setErrorMessage("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
          cursor-pointer transition-colors
          ${
            dragOver
              ? "border-blue-400 bg-blue-900/10"
              : "border-slate-600 hover:border-slate-500 bg-slate-900/50"
          }
          ${state === "uploading" ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        {state === "uploading" ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-500 border-t-blue-400" />
            <p className="mt-3 text-sm text-slate-400">Processing file...</p>
          </>
        ) : (
          <>
            <svg
              className="h-10 w-10 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-3 text-sm text-slate-300">
              Drag & drop an Excel file, or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-500">.xlsx or .xls files</p>
          </>
        )}
      </div>

      {/* Success result */}
      {state === "success" && result && (
        <div className="rounded-lg border border-green-500/30 bg-green-900/20 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="font-medium text-green-300">Upload successful</p>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-300">
              <span className="text-slate-400">Rows loaded:</span>{" "}
              <span className="font-medium">{result.rowCount}</span>
            </p>
            <p className="text-slate-300">
              <span className="text-slate-400">Columns matched:</span>{" "}
              <span className="font-medium">
                {result.matchedColumns.length}
              </span>
            </p>

            {result.unmatchedColumns.length > 0 && (
              <div className="mt-2">
                <p className="text-amber-400 text-xs font-medium">
                  Unmatched Excel columns ({result.unmatchedColumns.length}):
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {result.unmatchedColumns.join(", ")}
                </p>
              </div>
            )}

            {result.unmappedFields.length > 0 && (
              <div className="mt-2">
                <p className="text-amber-400 text-xs font-medium">
                  Unmapped internal fields ({result.unmappedFields.length}):
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {result.unmappedFields.join(", ")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <a
              href="/api/data/preview"
              target="_blank"
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              View Preview
            </a>
            <button
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-300 underline"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <p className="font-medium text-red-300">Upload failed</p>
          </div>
          <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
          <button
            onClick={reset}
            className="mt-2 text-xs text-slate-400 hover:text-slate-300 underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
