"use client";

import * as React from "react";
import { FieldError } from "react-hook-form";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError;
  description?: string;
}

export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, description, id, required, className, ...props }, ref) => {
    const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </label>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : description ? `${fieldId}-desc` : undefined}
          className={`w-full px-3 py-2 bg-slate-900 border rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
            error ? 'border-error' : 'border-slate-700 hover:border-slate-600'
          } ${className || ''}`}
          {...props}
        />
        {error && (
          <p id={`${fieldId}-error`} className="text-sm text-error" role="alert">
            {error.message}
          </p>
        )}
        {description && !error && (
          <p id={`${fieldId}-desc`} className="text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";
