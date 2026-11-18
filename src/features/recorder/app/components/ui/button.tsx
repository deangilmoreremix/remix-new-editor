import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../helpers/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-rr-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rr-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-rr-primary text-rr-primary-foreground hover:bg-rr-primary/90",
        destructive:
          "bg-rr-destructive text-rr-destructive-foreground hover:bg-rr-destructive/90",
        outline:
          "border border-rr-input bg-rr-background hover:bg-rr-accent hover:text-rr-accent-foreground",
        secondary:
          "bg-rr-secondary text-rr-secondary-foreground hover:bg-rr-secondary/80",
        ghost: "hover:bg-rr-accent hover:text-rr-accent-foreground",
        link: "text-rr-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
