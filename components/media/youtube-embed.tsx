"use client";

import { Play } from "lucide-react";
import NextImage from "next/image";
import { useState } from "react";

import type { YouTubeMedia } from "@/lib/schemas/media";
import { cn } from "@/lib/utils/cn";
import { youtubeEmbedUrl } from "@/lib/youtube/parse";

/**
 * Lazy façade: we render the thumbnail plus a play button, and only mount the
 * iframe once the user activates it. That saves roughly 700 KB and several
 * third-party connections per embed — significant on a grid of them.
 *
 * `format` drives the aspect ratio and comes from the stored document, never
 * from guessing, so a Short is never letterboxed into a 16:9 box.
 */
export function YouTubeEmbed({
  media,
  className,
  autoplayOnActivate = true,
  priority = false,
}: {
  media: YouTubeMedia;
  className?: string;
  autoplayOnActivate?: boolean;
  priority?: boolean;
}) {
  const [active, setActive] = useState(false);
  const isShort = media.format === "short";
  const label = media.title ? `Play “${media.title}”` : "Play video";

  return (
    <div
      className={cn(
        "media-frame mx-auto w-full rounded-xl",
        isShort ? "max-w-[min(100%,22rem)]" : "max-w-full",
        className,
      )}
      style={{ aspectRatio: isShort ? "9 / 16" : "16 / 9" }}
    >
      {active ? (
        <iframe
          src={youtubeEmbedUrl(media.youtubeId, {
            startSeconds: media.startSeconds,
            autoplay: autoplayOnActivate,
          })}
          title={media.title ?? "YouTube video"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={label}
          className="group absolute inset-0 size-full cursor-pointer"
        >
          <NextImage
            src={media.thumbnailUrl}
            alt=""
            fill
            priority={priority}
            sizes={isShort ? "(max-width: 768px) 100vw, 352px" : "(max-width: 1024px) 100vw, 800px"}
            className="object-cover"
          />
          {/* Scrim keeps the play button legible over bright thumbnails. */}
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 transition-opacity duration-200 group-hover:opacity-80" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 place-items-center rounded-full bg-black/55 backdrop-blur-sm transition-transform duration-200 ease-[var(--ease-out-quint)] group-hover:scale-110">
              <Play className="size-7 translate-x-0.5 fill-white text-white" />
            </span>
          </span>
          {media.title ? (
            <span className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-left text-xs font-medium text-white/90">
              {media.title}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
