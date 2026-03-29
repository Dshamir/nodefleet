"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Accessible label when no visible <label> is associated */
  "aria-label"?: string;
  /** Marks the input as invalid for assistive technologies */
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  /** ID of the element that describes this input (e.g. error message) */
  "aria-describedby"?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, "aria-label": ariaLabel, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedby, ...props }, ref) => (
    <input
      type={type}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      className={`flex h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus-ring transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
