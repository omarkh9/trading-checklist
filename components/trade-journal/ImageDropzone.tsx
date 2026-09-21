"use client";

import { ImagePlus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type ImageDropzoneProps = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  compact?: boolean;
};

export function ImageDropzone({ label, value, onChange, compact = false }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previewHeight = compact ? "h-32" : "h-44";

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (value) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-300">{label}</p>
        <div className="group relative overflow-hidden rounded-xl border border-indigo-400/20 bg-[#0c0c16]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className={`${previewHeight} w-full object-cover`}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-zinc-300 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 hover:text-white group-hover:opacity-100"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex ${previewHeight} cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? "border-indigo-400 bg-indigo-500/15 shadow-[0_0_24px_rgba(99,102,241,0.2)]"
            : "border-white/10 bg-white/[0.03] hover:border-indigo-400/50 hover:bg-indigo-500/5"
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            isDragging ? "bg-indigo-500/20 text-indigo-300" : "bg-[#12121a] text-zinc-500"
          }`}
        >
          <ImagePlus className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-400">
          Drop image here or click to browse
        </p>
        <p className="mt-1 text-xs text-zinc-600">PNG, JPG, WEBP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}
