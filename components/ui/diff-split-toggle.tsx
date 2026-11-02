"use client";

import * as React from "react";
import { motion, type HTMLMotionProps, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

export interface DiffSplitToggleHandle {
  toggle: () => void;
  setSplit: (split: boolean) => void;
}

export interface DiffSplitToggleProps
  extends Omit<HTMLMotionProps<"button">, "children" | "onClick"> {
  size?: number;
  isSplit?: boolean;
  defaultSplit?: boolean;
  onSplitChange?: (isSplit: boolean) => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const springTransition: Transition = {
  type: "spring",
  stiffness: 450,
  damping: 32,
  mass: 0.8,
};

const DiffSplitToggle = React.forwardRef<
  DiffSplitToggleHandle,
  DiffSplitToggleProps
>(
  (
    {
      size = 28,
      isSplit: controlledSplit,
      defaultSplit = false,
      onSplitChange,
      className,
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalSplit, setInternalSplit] = React.useState(defaultSplit);
    const isControlled = controlledSplit !== undefined;
    const split = isControlled ? controlledSplit : internalSplit;

    const handleToggle = React.useCallback(
      (nextState: boolean) => {
        if (!isControlled) {
          setInternalSplit(nextState);
        }
        onSplitChange?.(nextState);
      },
      [isControlled, onSplitChange]
    );

    const toggle = React.useCallback(() => {
      handleToggle(!split);
    }, [handleToggle, split]);

    const setSplit = React.useCallback(
      (val: boolean) => {
        handleToggle(val);
      },
      [handleToggle]
    );

    React.useImperativeHandle(
      ref,
      () => ({
        toggle,
        setSplit,
      }),
      [toggle, setSplit]
    );

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(event);
      toggle();
    };

    return (
      <motion.button
        type="button"
        role="button"
        aria-label={
          split
            ? "Switch to horizontal unified view"
            : "Switch to vertical split view"
        }
        aria-pressed={split}
        disabled={disabled}
        onClick={handleClick}
        whileTap={{ scale: disabled ? 1 : 0.94 }}
        className={cn(
          "relative inline-flex items-center justify-center p-0 m-0 bg-transparent outline-none cursor-pointer select-none border-none",
          "focus-visible:ring-1 focus-visible:ring-neutral-400 focus-visible:ring-offset-1 rounded-[7px]",
          "disabled:pointer-events-none disabled:opacity-40",
          className
        )}
        {...props}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none block overflow-visible"
        >
          {/* Minimalist Outer Border Frame (Figma Frame style) */}
          <rect
            x="2.5"
            y="2.5"
            width="19"
            height="19"
            rx="5.5"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-neutral-500/70 dark:text-neutral-500"
          />

          {/* Red Tile (Deletion block) */}
          <motion.rect
            rx="3"
            fill="#dc2626"
            initial={false}
            animate={
              split
                ? {
                    // Vertical Split (Left column)
                    x: 4.5,
                    y: 4.5,
                    width: 6.8,
                    height: 15,
                  }
                : {
                    // Horizontal Unified (Top row)
                    x: 4.5,
                    y: 4.5,
                    width: 15,
                    height: 6.8,
                  }
            }
            transition={springTransition}
          />

          {/* Green Tile (Addition block) */}
          <motion.rect
            rx="3"
            fill="#16a34a"
            initial={false}
            animate={
              split
                ? {
                    // Vertical Split (Right column)
                    x: 12.7,
                    y: 4.5,
                    width: 6.8,
                    height: 15,
                  }
                : {
                    // Horizontal Unified (Bottom row)
                    x: 4.5,
                    y: 12.7,
                    width: 15,
                    height: 6.8,
                  }
            }
            transition={springTransition}
          />
        </svg>
      </motion.button>
    );
  }
);

DiffSplitToggle.displayName = "DiffSplitToggle";

export { DiffSplitToggle };
export default DiffSplitToggle;
