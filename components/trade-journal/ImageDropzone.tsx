"use client";

import { ImagePlus, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type ImageDropzoneProps = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

export function ImageDropzone({ label, value, onChange }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
        <div className="group relative overflow-hidden rounded-xl border border-border bg-surface-overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-44 w-full object-cover"
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
        className={`flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
          isDragging
            ? "border-accent bg-accent/10"
            : "border-border bg-surface-overlay hover:border-accent/50 hover:bg-surface-overlay/80"
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            isDragging ? "bg-accent/20 text-accent" : "bg-surface-raised text-zinc-500"
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
