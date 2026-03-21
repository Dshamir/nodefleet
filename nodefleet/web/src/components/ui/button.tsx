"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "default",
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const baseClasses =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed";

    const variantClasses = {
      default:
        "bg-primary text-white hover:bg-primary-dark shadow-glow-primary",
      destructive:
        "bg-error text-white hover:bg-error-dark shadow-glow-error",
      outline:
        "border border-slate-700 text-slate-100 hover:bg-slate-900 hover:border-slate-600",
      secondary:
        "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
      ghost: "text-slate-300 hover:bg-slate-900/50 hover:text-white",
      link: "text-primary underline-offset-4 hover:underline",
    };

    const sizeClasses = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "h-12 rounded-lg px-8 text-base",
      icon: "h-10 w-10 p-0",
    };

    return (
      <Comp
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
