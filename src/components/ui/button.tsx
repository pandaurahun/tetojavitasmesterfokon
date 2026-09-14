import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-button)] text-sm font-medium cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent hover:bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-[color-mix(in_oklab,var(--primary)_7%,transparent)]",
        link: "text-primary underline-offset-4 hover:underline",
        ink: "bg-ink text-ink-foreground shadow-soft hover:shadow-lift hover:-translate-y-0.5",
        copper:
          "bg-accent text-accent-foreground shadow-soft hover:shadow-lift hover:-translate-y-0.5",
        forest: "bg-forest text-forest-foreground shadow-soft hover:shadow-lift hover:-translate-y-0.5",
        hairline:
          "border border-[color-mix(in_oklab,var(--ink-foreground)_35%,transparent)] bg-transparent text-ink-foreground hover:border-accent hover:text-accent",
        quiet:
          "bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] text-foreground hover:bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-7 text-[0.95rem]",
        xl: "h-14 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);


export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
