import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary: "bg-surface-2 text-fg hover:bg-surface-3",
        outline:
          "border border-border bg-surface/60 text-fg backdrop-blur-sm hover:border-accent/50 hover:bg-surface-2",
        ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-danger text-white hover:opacity-90",
        link: "bg-transparent text-accent underline-offset-4 hover:underline",
      },
      size: {
        // 44px minimum touch target on the default and larger sizes.
        sm: "h-9 px-3 text-[0.8125rem] [&_svg]:size-4",
        md: "h-11 px-4 [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  full,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      // Buttons inside forms default to submit, which causes accidental
      // submissions. Explicit is safer.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
