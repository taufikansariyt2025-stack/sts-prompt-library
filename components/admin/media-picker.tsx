"use client";

import { Check, ImageIcon, Link2, Loader2, Trash2, Upload, SquarePlay } from "lucide-react";
import NextImage from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { YouTubeEmbed } from "@/components/media/youtube-embed";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/input";
import type { PreviewMedia, YouTubeMedia } from "@/lib/schemas/media";
import { uploadImage, type UploadProgress } from "@/lib/upload/client-upload";
import { cn } from "@/lib/utils/cn";
import { shouldSkipOptimizer } from "@/lib/utils/media";

type Source = "upload" | "url" | "youtube";

const SOURCES: { value: Source; label: string; Icon: typeof Upload }[] = [
  { value: "upload", label: "Upload", Icon: Upload },
  { value: "url", label: "Image URL", Icon: Link2 },
  { value: "youtube", label: "YouTube", Icon: SquarePlay },
];

export function MediaPicker({
  value,
  onChange,
  alt,
  onAltChange,
  scope = "prompts",
}: {
  value?: PreviewMedia;
  onChange: (media: PreviewMedia | undefined) => void;
  alt: string;
  onAltChange: (alt: string) => void;
  scope?: "prompts" | "categories" | "branding";
}) {
  const initialSource: Source =
    value?.kind === "youtube" ? "youtube" : value?.source === "url" ? "url" : "upload";

  const [source, setSource] = useState<Source>(initialSource);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Preview source"
        className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
      >
        {SOURCES.map(({ value: option, label, Icon }) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={source === option}
            onClick={() => setSource(option)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              source === option
                ? "bg-surface text-fg shadow-e1"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {source === "upload" ? (
        <UploadPane value={value} onChange={onChange} scope={scope} />
      ) : source === "url" ? (
        <UrlPane value={value} onChange={onChange} />
      ) : (
        <YouTubePane value={value} onChange={onChange} />
      )}

      {value?.kind === "image" ? (
        <div className="space-y-1.5">
          <Label htmlFor="preview-alt">
            Alt text <span className="text-danger">*</span>
          </Label>
          <Input
            id="preview-alt"
            value={alt}
            onChange={(event) => onAltChange(event.target.value)}
            placeholder="An SUV soaring over a man seated in a desert"
            maxLength={200}
          />
          <FieldHint>
            Describes the image for screen readers and search engines. Required to
            publish.
          </FieldHint>
        </div>
      ) : null}
    </div>
  );
}

// ── Upload ───────────────────────────────────────────────────────────────────

function UploadPane({
  value,
  onChange,
  scope,
}: {
  value?: PreviewMedia;
  onChange: (media: PreviewMedia | undefined) => void;
  scope: "prompts" | "categories" | "branding";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setProgress({ stage: "preparing", percent: 0 });

    const result = await uploadImage(file, { scope, onProgress: setProgress });
    setProgress(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onChange({
      ...result.media,
      alt: value?.kind === "image" ? value.alt : "",
    });
    toast.success("Image uploaded");
  }

  if (value?.kind === "image" && !progress) {
    return <ImagePreview media={value} onRemove={() => onChange(undefined)} />;
  }

  if (progress) {
    const label =
      progress.stage === "preparing"
        ? "Optimising…"
        : progress.stage === "uploading"
          ? `Uploading ${progress.percent}%`
          : "Finishing…";

    return (
      <div className="grid place-items-center gap-3 rounded-xl border border-border bg-surface-2 p-10">
        <Loader2 className="size-6 animate-spin text-accent" />
        <p className="text-sm text-fg-muted">{label}</p>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress.stage === "uploading" ? progress.percent : 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void handleFile(event.dataTransfer.files[0]);
      }}
      // Paste an image straight from the clipboard — saves a lot of time when
      // grabbing frames from a video tool.
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.items)
          .find((item) => item.type.startsWith("image/"))
          ?.getAsFile();
        if (file) void handleFile(file);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150",
        dragging ? "border-accent bg-accent-soft" : "border-border bg-surface-2",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <Upload className="mx-auto size-6 text-fg-subtle" />
      <p className="mt-3 text-sm font-medium text-fg">
        Drag an image here, or{" "}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-accent underline underline-offset-4"
        >
          browse
        </button>
      </p>
      <p className="mt-1 text-xs text-fg-subtle">
        You can also paste from the clipboard · JPG, PNG, WebP, AVIF · max 10 MB
      </p>
    </div>
  );
}

// ── External URL ─────────────────────────────────────────────────────────────

function UrlPane({
  value,
  onChange,
}: {
  value?: PreviewMedia;
  onChange: (media: PreviewMedia | undefined) => void;
}) {
  const [url, setUrl] = useState(
    value?.kind === "image" && value.source === "url" ? value.url : "",
  );
  const [checking, setChecking] = useState(false);

  async function verify() {
    if (!url.trim()) return;
    setChecking(true);
    try {
      const response = await fetch("/api/admin/image-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { width: number; height: number; mime: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        toast.error(payload.error ?? "Couldn't load that image.");
        return;
      }

      onChange({
        kind: "image",
        url: url.trim(),
        source: "url",
        width: payload.data.width,
        height: payload.data.height,
        blurDataURL: "",
        alt: value?.kind === "image" ? value.alt : "",
        mime: payload.data.mime,
      });
      toast.success("Image linked");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/preview.jpg"
        />
        <Button onClick={verify} disabled={checking || !url.trim()} variant="secondary">
          {checking ? <Loader2 className="animate-spin" /> : <Check />}
          Check
        </Button>
      </div>
      <FieldHint>
        External hosts disappear or block hotlinking over time. Uploading is
        safer — use this only for images you control.
      </FieldHint>

      {value?.kind === "image" && value.source === "url" ? (
        <ImagePreview media={value} onRemove={() => onChange(undefined)} />
      ) : null}
    </div>
  );
}

// ── YouTube ──────────────────────────────────────────────────────────────────

function YouTubePane({
  value,
  onChange,
}: {
  value?: PreviewMedia;
  onChange: (media: PreviewMedia | undefined) => void;
}) {
  const current = value?.kind === "youtube" ? value : undefined;
  const [url, setUrl] = useState(current?.originalUrl ?? "");
  const [override, setOverride] = useState<"auto" | "short" | "video">("auto");
  const [resolving, setResolving] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  async function resolve(formatOverride = override) {
    if (!url.trim()) return;
    setResolving(true);
    try {
      const response = await fetch("/api/admin/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), formatOverride }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: YouTubeMedia & { autoDetected: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        toast.error(payload.error ?? "Couldn't read that YouTube URL.");
        return;
      }

      const { autoDetected, ...media } = payload.data;
      setDetected(autoDetected);
      onChange(media);
      toast.success(
        media.format === "short" ? "Short detected (9:16)" : "Video detected (16:9)",
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://youtube.com/shorts/… or https://youtube.com/watch?v=…"
        />
        <Button onClick={() => resolve()} disabled={resolving || !url.trim()} variant="secondary">
          {resolving ? <Loader2 className="animate-spin" /> : <Check />}
          Load
        </Button>
      </div>
      <FieldHint>
        Shorts and full videos both work. Paste any YouTube link.
      </FieldHint>

      {current ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 p-3">
            <span className="text-xs font-medium text-fg-muted">Format</span>
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
              {(["auto", "short", "video"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setOverride(option);
                    void resolve(option);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    override === option
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            {detected ? (
              <span className="text-xs text-fg-subtle">
                Auto-detected: {detected === "short" ? "Short (9:16)" : "Video (16:9)"}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-danger"
              onClick={() => {
                onChange(undefined);
                setUrl("");
                setDetected(null);
              }}
            >
              <Trash2 /> Remove
            </Button>
          </div>

          <YouTubeEmbed media={current} autoplayOnActivate={false} />
        </>
      ) : null}
    </div>
  );
}

// ── Shared preview ───────────────────────────────────────────────────────────

function ImagePreview({
  media,
  onRemove,
}: {
  media: Extract<PreviewMedia, { kind: "image" }>;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-surface-2 p-3">
      <div
        className="media-frame relative w-28 shrink-0 rounded-lg"
        style={{ aspectRatio: `${media.width} / ${media.height}` }}
      >
        <NextImage
          src={media.url}
          alt=""
          fill
          sizes="112px"
          className="object-cover"
          placeholder={media.blurDataURL ? "blur" : "empty"}
          blurDataURL={media.blurDataURL || undefined}
          unoptimized={shouldSkipOptimizer(media.url, media.source)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <Check className="size-4" /> Ready
        </p>
        <p className="mt-1 text-xs text-fg-muted">
          {media.width} × {media.height}
          {media.bytes ? ` · ${(media.bytes / 1024).toFixed(0)} KB` : ""}
          {media.source === "url" ? " · external" : ""}
        </p>
        <Button variant="ghost" size="sm" className="mt-2 text-danger" onClick={onRemove}>
          <Trash2 /> Remove
        </Button>
      </div>

      <ImageIcon className="size-4 shrink-0 text-fg-subtle" />
    </div>
  );
}
