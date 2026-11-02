// eye-toggle — Motion v12 compatible
// Interactive eye icon: open = unviewed, slashed = viewed
// Requires: motion (v12), cn helper at @/lib/utils
"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export interface EyeIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
  toggle: () => void;
  setViewed: (viewed: boolean) => void;
}

interface EyeIconProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    | "color"
    | "onDrag"
    | "onDragStart"
    | "onDragEnd"
    | "onAnimationStart"
    | "onAnimationEnd"
    | "onAnimationIteration"
    | "onToggle"
  > {
  size?: number;
  duration?: number;
  isAnimated?: boolean;
  color?: string;
  /** Controlled: file is viewed (slash visible) */
  viewed?: boolean;
  /** Initial uncontrolled state */
  defaultViewed?: boolean;
  /** Fired when the user toggles the icon */
  onToggle?: (viewed: boolean) => void;
}

// ─── Animation helper types ─────────────────────────────────────────────────

type EyeState = "open" | "blink" | "slashed";
type PupilState = "center" | "scan" | "slashed";
type SlashState = "hidden" | "visible";

const EyeIcon = forwardRef<EyeIconHandle, EyeIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      onClick,
      onKeyDown,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      color,
      viewed,
      defaultViewed = false,
      onToggle,
      ...props
    },
    ref,
  ) => {
    const isControlledRef = useRef(false);
    const [internalViewed, setInternalViewed] = useState(defaultViewed);
    const isViewed = viewed !== undefined ? viewed : internalViewed;

    // Animation state
    const [eyeState, setEyeState] = useState<EyeState>(
      isViewed ? "slashed" : "open",
    );
    const [pupilState, setPupilState] = useState<PupilState>(
      isViewed ? "slashed" : "center",
    );
    const [slashState, setSlashState] = useState<SlashState>(
      isViewed ? "visible" : "hidden",
    );

    // Sync animation state when isViewed changes
    useEffect(() => {
      if (isViewed) {
        setEyeState("slashed");
        setPupilState("slashed");
        setSlashState("visible");
      } else {
        setEyeState("open");
        setPupilState("center");
        setSlashState("hidden");
      }
    }, [isViewed]);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => {
          if (isViewed) return;
          setEyeState("blink");
          setPupilState("scan");
        },
        stopAnimation: () => {
          if (isViewed) return;
          setEyeState("open");
          setPupilState("center");
        },
        toggle: () => {
          const next = !isViewed;
          if (viewed === undefined) setInternalViewed(next);
          onToggle?.(next);
        },
        setViewed: (state: boolean) => {
          if (viewed === undefined) setInternalViewed(state);
          onToggle?.(state);
        },
      };
    });

    const handleToggle = useCallback(() => {
      const next = !isViewed;
      if (viewed === undefined) setInternalViewed(next);
      onToggle?.(next);
    }, [isViewed, viewed, onToggle]);

    const handleClick = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        handleToggle();
      },
      [onClick, handleToggle],
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      },
      [onKeyDown, handleToggle],
    );

    const handleEnter = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || isViewed || isControlledRef.current) {
          onMouseEnter?.(e);
          return;
        }
        setEyeState("blink");
        setPupilState("scan");
        onMouseEnter?.(e);
      },
      [onMouseEnter, isAnimated, isViewed],
    );

    const handleLeave = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current && !isViewed) {
          setEyeState("open");
          setPupilState("center");
        }
        onMouseLeave?.(e);
      },
      [onMouseLeave, isViewed],
    );

    // ─── Derived animation props ─────────────────────────────────────────────

    const eyeAnimate = (() => {
      if (eyeState === "slashed") return { opacity: 0.55, scaleY: 1 };
      if (eyeState === "blink")
        return { scaleY: [1, 0.08, 1], opacity: 1 } as any;
      return { scaleY: 1, opacity: 1 };
    })();

    const eyeTransition =
      eyeState === "blink"
        ? { duration: 0.25 * duration, ease: "easeInOut" as const }
        : { duration: 0.22 * duration };

    const pupilAnimate = (() => {
      if (pupilState === "slashed") return { scale: 0.6, opacity: 0.4 };
      if (pupilState === "scan") return { x: [-2, 2, -1, 1, 0] } as any;
      return { x: 0, scale: 1, opacity: 1 };
    })();

    const pupilTransition =
      pupilState === "slashed"
        ? { type: "spring" as const, stiffness: 340, damping: 24 }
        : pupilState === "scan"
          ? { duration: 1.6 * duration, ease: "easeInOut" as const }
          : { duration: 0.2 };

    const slashAnimate =
      slashState === "visible"
        ? { pathLength: 1, opacity: 1 }
        : { pathLength: 0, opacity: 0 };

    const slashTransition =
      slashState === "visible"
        ? {
            duration: 0.32 * duration,
            ease: [0.16, 1, 0.3, 1] as any,
          }
        : { duration: 0.22 * duration, ease: "easeInOut" as const };

    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={isViewed ? "Mark as unread" : "Mark as read"}
        aria-pressed={isViewed}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center select-none rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500",
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ color, ...props.style }}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Outer Eye Outline */}
          <motion.path
            d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
            animate={eyeAnimate}
            transition={eyeTransition}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />

          {/* Pupil */}
          <motion.circle
            cx="12"
            cy="12"
            r="3"
            animate={pupilAnimate}
            transition={pupilTransition}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />

          {/* 45° Slash — draws in when viewed, erases when unviewed */}
          <motion.path
            d="M3 3L21 21"
            animate={slashAnimate}
            transition={slashTransition}
          />
        </svg>
      </div>
    );
  },
);

EyeIcon.displayName = "EyeIcon";
export { EyeIcon };
