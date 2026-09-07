"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { IconLoader } from "@/components/icons";

type Variant = "primary" | "success" | "danger" | "outline" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-200 disabled:text-ink-400",
  success:
    "bg-success-600 text-white shadow-sm hover:bg-success-700 active:bg-success-700 disabled:bg-ink-200 disabled:text-ink-400",
  danger:
    "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700 disabled:bg-ink-200 disabled:text-ink-400",
  outline:
    "border border-ink-300 bg-white text-ink-700 shadow-xs hover:bg-ink-50 hover:border-ink-400 disabled:text-ink-400 disabled:hover:bg-white",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-800 disabled:text-ink-300",
  subtle:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:bg-ink-100 disabled:text-ink-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-sm gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <IconLoader width={16} height={16} />}
      {children}
    </button>
  );
});
