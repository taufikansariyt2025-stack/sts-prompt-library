import { CheckCircle2, Clock, ShieldX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type AccessOutcome = "pending" | "rejected" | "suspended" | "reset-sent";

const CONFIG: Record<
  AccessOutcome,
  { Icon: typeof Clock; tone: string; ring: string; title: string; body: string }
> = {
  pending: {
    Icon: Clock,
    tone: "text-warning",
    ring: "border-warning/30 bg-warning/8",
    title: "Access request sent to admin",
    body: "Your account is created and the admin has been notified. As soon as they approve you, sign in again and the library unlocks.",
  },
  rejected: {
    Icon: ShieldX,
    tone: "text-danger",
    ring: "border-danger/30 bg-danger/8",
    title: "Access not approved",
    body: "The admin hasn't approved this account. If you think that's a mistake, contact them directly.",
  },
  suspended: {
    Icon: ShieldX,
    tone: "text-danger",
    ring: "border-danger/30 bg-danger/8",
    title: "Access suspended",
    body: "This account's access has been suspended. Contact the admin if you need it restored.",
  },
  "reset-sent": {
    Icon: CheckCircle2,
    tone: "text-success",
    ring: "border-success/30 bg-success/8",
    title: "Check your email",
    body: "If an account exists for that address, a password reset link is on its way.",
  },
};

/**
 * The terminal screen after a sign-in attempt.
 *
 * Rendered from the URL (`/login?status=pending`) rather than from client
 * state, so it survives the things that used to lose it: the Google redirect
 * flow navigating the page away and back, a refresh, or the back button.
 * It also needs no JavaScript to display.
 */
export function AccessStatusPanel({ status }: { status: AccessOutcome }) {
  const { Icon, tone, ring, title, body } = CONFIG[status];

  return (
    <div className="space-y-5 text-center">
      <div className={cn("mx-auto grid size-12 place-items-center rounded-full border", ring)}>
        <Icon className={cn("size-5", tone)} />
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
      </div>

      <Button variant="outline" full asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}

export function isAccessOutcome(value: unknown): value is AccessOutcome {
  return (
    value === "pending" ||
    value === "rejected" ||
    value === "suspended" ||
    value === "reset-sent"
  );
}
