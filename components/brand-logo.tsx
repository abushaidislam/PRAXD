import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;

interface BrandLogoProps {
  size?: BrandLogoSize;
  showText?: boolean;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  priority?: boolean;
}

const SIZE_MAP: Record<string, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  "2xl": 64,
};

export function BrandLogo({
  size = "md",
  showText = false,
  className,
  imageClassName,
  textClassName,
  priority = true,
}: BrandLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size] || 24;

  return (
    <div className={cn("inline-flex items-center gap-2 select-none group", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center shrink-0 rounded-[22%] transition-transform duration-150 group-hover:scale-105",
          imageClassName
        )}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <Image
          src="/logo.png"
          alt="PRAXD"
          width={pixelSize}
          height={pixelSize}
          priority={priority}
          unoptimized
          className="w-full h-full object-contain shrink-0 drop-shadow-sm rounded-[22%]"
        />
      </div>

      {showText && (
        <span
          className={cn(
            "font-bold tracking-[0.03em] text-praxd-text text-[13px] leading-none",
            textClassName
          )}
        >
          PRAXD
        </span>
      )}
    </div>
  );
}
