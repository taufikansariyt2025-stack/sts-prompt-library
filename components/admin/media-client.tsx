"use client";

import { ImageOff, Loader2, Trash2 } from "lucide-react";
import NextImage from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

type Asset = {
  id: string;
  r2Key: string;
  url: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  originalName: string;
  uploadedAt: string | null;
};

export function MediaClient({ initial }: { initial: Asset[] }) {
  const [assets, setAssets] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(asset: Asset) {
    if (!window.confirm("Delete this file permanently?")) return;
    setBusyId(asset.id);
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        // Refused while a prompt still points at it.
        toast.error(payload.error ?? "Couldn't delete.");
        return;
      }

      setAssets((a) => a.filter((x) => x.id !== asset.id));
      toast.success("File deleted");
    } finally {
      setBusyId(null);
    }
  }

  const totalMb = assets.reduce((sum, a) => sum + a.bytes, 0) / 1024 / 1024;

  if (assets.length === 0) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <ImageOff className="mx-auto size-6 text-fg-subtle" />
          <p className="mt-3 text-sm text-fg-muted">
            Nothing uploaded yet. Images added from the prompt editor appear here.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        {assets.length} file{assets.length === 1 ? "" : "s"} ·{" "}
        <span className="font-mono tabular-nums">{totalMb.toFixed(1)} MB</span>
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {assets.map((asset) => (
          <Card key={asset.id} className="overflow-hidden">
            <div
              className="media-frame relative"
              style={{
                aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : "1 / 1",
              }}
            >
              <NextImage
                src={asset.url}
                alt={asset.originalName || "Uploaded image"}
                fill
                sizes="200px"
                // Served through our gated route; the optimiser can't fetch it.
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="space-y-1.5 p-2.5">
              <p className="truncate text-xs font-medium text-fg">
                {asset.originalName || asset.r2Key.split("/").pop()}
              </p>
              <p className="font-mono text-[0.625rem] tabular-nums text-fg-subtle">
                {asset.width}×{asset.height} · {(asset.bytes / 1024).toFixed(0)} KB
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-danger"
                disabled={busyId === asset.id}
                onClick={() => remove(asset)}
              >
                {busyId === asset.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
