"use client";

import * as React from "react";
import { motion, type HTMLMotionProps, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

export interface CopyIconHandle {
  triggerSuccess: () => void;
  reset: () => void;
}

export interface CopyIconProps
  extends Omit<HTMLMotionProps<"button">, "children" | "onClick"> {
  size?: number;
  strokeWidth?: number;
  value?: string;
  copied?: boolean;
  onCopyChange?: (copied: boolean) => void;
  timeout?: number;
  onClick?: (event: React.MouseEvent) => void;
  as?: "button" | "span" | "div";
  children?: React.ReactNode;
}

const springConfig: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
};

const CopyIcon = React.forwardRef<CopyIconHandle, CopyIconProps>(
  (
    {
      size = 18,
      strokeWidth = 2,
      value,
      copied: controlledCopied,
      onCopyChange,
      timeout = 2000,
      className,
      onClick,
      disabled,
      as = "button",
      children,
      ...props
    },
    ref
  ) => {
    const [internalCopied, setInternalCopied] = React.useState(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const isControlled = controlledCopied !== undefined;
    const isCopied = isControlled ? controlledCopied : internalCopied;

    const setCopyState = React.useCallback(
      (status: boolean) => {
        if (!isControlled) {
          setInternalCopied(status);
        }
        onCopyChange?.(status);
      },
      [isControlled, onCopyChange]
    );

    const triggerSuccess = React.useCallback(() => {
      setCopyState(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopyState(false);
      }, timeout);
    }, [setCopyState, timeout]);

    const reset = React.useCallback(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCopyState(false);
    }, [setCopyState]);

    React.useImperativeHandle(
      ref,
      () => ({
        triggerSuccess,
        reset,
      }),
      [triggerSuccess, reset]
    );

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    const handleClick = async (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      onClick?.(event);

      if (value) {
        try {
          await navigator.clipboard.writeText(value);
        } catch (err) {
          console.error("Clipboard copy failed:", err);
        }
      }

      triggerSuccess();
    };

    const isButton = as === "button";
    const MotionComponent = as === "span" ? motion.span : as === "div" ? motion.div : motion.button;

    return (
      <MotionComponent
        {...(isButton ? { type: "button", role: "button" } : { "aria-hidden": props["aria-label"] ? undefined : true })}
        aria-label={props["aria-label"] || (isButton ? (isCopied ? "Copied" : "Copy to clipboard") : undefined)}
        disabled={isButton ? disabled : undefined}
        onClick={handleClick}
        whileTap={isButton ? { scale: disabled ? 1 : 0.92 } : undefined}
        className={cn(
          isButton
            ? "inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            : "inline-flex items-center justify-center",
          className
        )}
        {...(props as any)}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "pointer-events-none transition-colors duration-200",
            isCopied && "text-emerald-500"
          )}
        >
          {/* Copy Icon (Default State) */}
          <motion.g
            animate={{
              scale: isCopied ? 0.5 : 1,
              opacity: isCopied ? 0 : 1,
            }}
            transition={springConfig}
            style={{ transformOrigin: "12px 12px" }}
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </motion.g>

          {/* Circle Outline (Success State) */}
          <motion.circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            initial={false}
            animate={{
              scale: isCopied ? 1 : 0.6,
              opacity: isCopied ? 1 : 0,
            }}
            transition={springConfig}
            style={{ transformOrigin: "12px 12px" }}
          />

          {/* Checkmark Icon (Success State) */}
          <motion.path
            d="m9 12 2 2 4-4"
            initial={false}
            animate={{
              pathLength: isCopied ? 1 : 0,
              opacity: isCopied ? 1 : 0,
              scale: isCopied ? 1 : 0.6,
            }}
            transition={{
              pathLength: { duration: 0.2, ease: "easeOut", delay: isCopied ? 0.05 : 0 },
              opacity: { duration: 0.15 },
              scale: springConfig,
            }}
            style={{ transformOrigin: "12px 12px" }}
          />
        </motion.svg>
        {children}
      </MotionComponent>
    );
  }
);

CopyIcon.displayName = "CopyIcon";

export { CopyIcon };
export default CopyIcon;
