"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils/slug";

const MAX_TAGS = 8;

export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [entry, setEntry] = useState("");

  function commit() {
    const tag = slugify(entry);
    if (!tag) {
      setEntry("");
      return;
    }
    if (value.includes(tag) || value.length >= MAX_TAGS) {
      setEntry("");
      return;
    }
    onChange([...value, tag]);
    setEntry("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-2.5 pr-1 text-xs font-medium text-accent"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="grid size-4 place-items-center rounded-full transition-colors hover:bg-accent/20"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {value.length < MAX_TAGS ? (
        <Input
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            // Comma is a natural separator when typing several in a row.
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && !entry && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder="Add a tag and press Enter"
        />
      ) : null}
    </div>
  );
}
