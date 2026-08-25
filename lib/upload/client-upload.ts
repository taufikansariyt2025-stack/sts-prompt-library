"use client";

import imageCompression from "browser-image-compression";

import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_DIMENSION,
  MAX_PREVIEW_BYTES,
  type ImageMedia,
} from "@/lib/schemas/media";

/**
 * Browser → app → R2.
 *
 * A single multipart POST. The heavy work still happens in the browser —
 * downscale, re-encode to WebP, build the blur placeholder — so what crosses
 * the wire is already small.
 *
 * The bucket has no public origin and no CORS rules, which is the point: media
 * is private and read back through a session-checked route.
 */

export type UploadProgress = {
  stage: "preparing" | "uploading" | "finalising";
  percent: number;
};

export type UploadResult =
  | { ok: true; media: Omit<ImageMedia, "alt"> }
  | { ok: false; error: string };

export async function uploadImage(
  file: File,
  options: {
    scope?: "prompts" | "categories" | "branding";
    onProgress?: (progress: UploadProgress) => void;
    /** Branding keeps SVG/PNG as-is; previews are always re-encoded. */
    preserveFormat?: boolean;
  } = {},
): Promise<UploadResult> {
  const { scope = "prompts", onProgress, preserveFormat = false } = options;

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "That file isn't an image." };
  }

  try {
    onProgress?.({ stage: "preparing", percent: 0 });

    const prepared = preserveFormat ? file : await compress(file);

    if (
      !preserveFormat &&
      !ALLOWED_IMAGE_MIME.includes(prepared.type as (typeof ALLOWED_IMAGE_MIME)[number])
    ) {
      return { ok: false, error: "Use a JPG, PNG, WebP or AVIF image." };
    }

    if (prepared.size > MAX_PREVIEW_BYTES) {
      return { ok: false, error: "That image is too large, even after compression." };
    }

    const [dimensions, blurDataURL] = await Promise.all([
      readDimensions(prepared),
      makeBlurPlaceholder(prepared),
    ]);

    onProgress?.({ stage: "uploading", percent: 0 });

    const form = new FormData();
    form.append("file", prepared, file.name);
    form.append("scope", scope);
    form.append("width", String(dimensions.width));
    form.append("height", String(dimensions.height));
    form.append("blurDataURL", blurDataURL);
    form.append("originalName", file.name.slice(0, 255));

    const payload = await postWithProgress(form, (percent) =>
      onProgress?.({ stage: "uploading", percent }),
    );

    onProgress?.({ stage: "finalising", percent: 100 });

    if (!payload.ok || !payload.data) {
      return { ok: false, error: payload.error ?? "Upload failed." };
    }

    return {
      ok: true,
      media: {
        kind: "image",
        url: payload.data.url,
        r2Key: payload.data.r2Key,
        source: "upload",
        width: dimensions.width,
        height: dimensions.height,
        blurDataURL,
        bytes: payload.data.bytes,
        mime: payload.data.mime,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }
}

async function compress(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: MAX_IMAGE_DIMENSION,
    maxSizeMB: MAX_PREVIEW_BYTES / 1024 / 1024,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.82,
  });
}

function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    image.src = url;
  });
}

/**
 * A ~20px-wide JPEG data URI. Small enough to inline in the document, which is
 * what removes the grey flash on the masonry grid.
 */
async function makeBlurPlaceholder(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const width = 20;
    const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return "";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", 0.5);
  } catch {
    // A missing placeholder degrades gracefully to a plain skeleton.
    return "";
  }
}

type UploadResponse = {
  ok: boolean;
  error?: string;
  data?: { url: string; r2Key: string; bytes: number; mime: string };
};

/** fetch() still can't report upload progress, so this one call uses XHR. */
function postWithProgress(
  form: FormData,
  onProgress: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as UploadResponse);
      } catch {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}
