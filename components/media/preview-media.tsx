import NextImage from "next/image";

import { YouTubeEmbed } from "@/components/media/youtube-embed";
import type { PreviewMedia as PreviewMediaValue } from "@/lib/schemas/media";
import { cn } from "@/lib/utils/cn";
import { shouldSkipOptimizer } from "@/lib/utils/media";

/**
 * Renders whichever preview a prompt carries.
 *
 * Dimensions come from the stored document so the frame reserves space before
 * the image loads — that is what keeps CLS near zero on the masonry grid.
 */
export function PreviewMedia({
  media,
  className,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  rounded = "rounded-xl",
}: {
  media: PreviewMediaValue;
  className?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
}) {
  if (media.kind === "youtube") {
    return <YouTubeEmbed media={media} className={className} priority={priority} />;
  }

  return (
    <div
      className={cn("media-frame w-full", rounded, className)}
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
    >
      <NextImage
        src={media.url}
        alt={media.alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={media.blurDataURL ? "blur" : "empty"}
        blurDataURL={media.blurDataURL || undefined}
        unoptimized={shouldSkipOptimizer(media.url, media.source)}
        className="object-cover"
      />
    </div>
  );
}
