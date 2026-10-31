import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number | "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

export function BrandLogo({ size = "md", showText = false, className }: BrandLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 24;

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <Image
        src="/logo.png"
        alt="PRAXD Logo"
        width={pixelSize}
        height={pixelSize}
        priority
        className="rounded-[4px] object-contain shrink-0 shadow-sm"
      />
      {showText && (
        <span className="font-semibold tracking-tight text-praxd-text text-[13px]">
          PRAXD
        </span>
      )}
    </div>
  );
}
