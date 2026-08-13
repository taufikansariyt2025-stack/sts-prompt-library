"use client";

import imageCompression from "browser-image-compression";

import {
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_DIMENSION,
  MAX_PREVIEW_BYTES,
  type ImageMedia,
} from "@/lib/schemas/media";

/**
 * Browser → R2 upload.
 *
 * Everything expensive happens client-side: downscale, re-encode to WebP, and
 * generate the blur placeholder. The server only signs the URL and verifies the
 * result, so large files never touch a serverless function.
 */

export type UploadProgress = {
  stage: "preparing" | "uploading" | "finalising";
  percent: number;
};

export type UploadResult =
  | { ok: true; media: Omit<ImageMedia, "alt"> }
  | { ok: false; error: string };

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string };

export async function uploadImage(
  file: File,
  options: {
    scope?: "prompts" | "categories" | "branding";
    onProgress?: (progress: UploadProgress) => void;
    /** Branding uploads keep SVG/PNG as-is; previews are always re-encoded. */
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

    if (!ALLOWED_IMAGE_MIME.includes(prepared.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
      if (!preserveFormat) {
        return { ok: false, error: "Use a JPG, PNG, WebP or AVIF image." };
      }
    }

    if (prepared.size > MAX_PREVIEW_BYTES) {
      return { ok: false, error: "That image is too large, even after compression." };
    }

    const [dimensions, blurDataURL] = await Promise.all([
      readDimensions(prepared),
      makeBlurPlaceholder(prepared),
    ]);

    onProgress?.({ stage: "preparing", percent: 100 });

    // 1. Ask the server to sign an upload.
    const signResponse = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mime: prepared.type,
        bytes: prepared.size,
        width: dimensions.width,
        height: dimensions.height,
        scope,
      }),
    });

    const signed = (await signResponse.json()) as ApiEnvelope<{
      uploadUrl: string;
      key: string;
      publicUrl: string;
    }>;

    if (!signResponse.ok || !signed.ok || !signed.data) {
      return { ok: false, error: signed.error ?? "Couldn't start the upload." };
    }

    // 2. PUT straight to R2 with real progress.
    onProgress?.({ stage: "uploading", percent: 0 });
    await putWithProgress(signed.data.uploadUrl, prepared, (percent) =>
      onProgress?.({ stage: "uploading", percent }),
    );

    // 3. Register it.
    onProgress?.({ stage: "finalising", percent: 100 });
    const completeResponse = await fetch("/api/admin/upload-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        r2Key: signed.data.key,
        width: dimensions.width,
        height: dimensions.height,
        blurDataURL,
        originalName: file.name.slice(0, 255),
      }),
    });

    const completed = (await completeResponse.json()) as ApiEnvelope<{
      url: string;
      r2Key: string;
      bytes: number;
      mime: string;
    }>;

    if (!completeResponse.ok || !completed.ok || !completed.data) {
      return { ok: false, error: completed.error ?? "Couldn't finish the upload." };
    }

    return {
      ok: true,
      media: {
        kind: "image",
        url: completed.data.url,
        r2Key: completed.data.r2Key,
        source: "upload",
        width: dimensions.width,
        height: dimensions.height,
        blurDataURL,
        bytes: completed.data.bytes,
        mime: completed.data.mime,
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
 * A ~20px-wide JPEG data URI. Tiny enough to inline in the document, which is
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

/** fetch() has no upload progress, so this one case uses XHR. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${xhr.status}).`));

    xhr.onerror = () =>
      reject(new Error("Network error during upload. Check the bucket's CORS rules."));

    xhr.send(file);
  });
}
