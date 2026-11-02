"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

export interface UseDiffScrollSyncOptions {
  filename: string;
  diffMode: "split" | "unified";
  wrapLines: boolean;
  maxLineLength: number;
}

/**
 * Custom hook providing lockstep synchronized dual-pane horizontal scrolling.
 * Supports:
 * - Wheel events (trackpad horizontal swipe deltaX & Shift + mouse wheel)
 * - Keyboard navigation (ArrowLeft, ArrowRight, Home, End)
 * - Draggable custom scrollbar thumb with linear tracking
 * - Click-to-jump on track
 * - Dynamic bounds recalculation via ResizeObserver
 */
export function useDiffScrollSync({
  filename,
  diffMode,
  wrapLines,
  maxLineLength,
}: UseDiffScrollSyncOptions) {
  const [scrollX, setScrollX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(960);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startScrollX: number }>({
    startX: 0,
    startScrollX: 0,
  });

  // Monitor container width dynamically with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 960);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
  }, []);

  // Compute column visible width & max scroll range
  const columnWidth = useMemo(() => {
    if (diffMode === "split") {
      return Math.max(300, containerWidth / 2 - 72);
    }
    return Math.max(400, containerWidth - 120);
  }, [diffMode, containerWidth]);

  const maxScrollX = useMemo(() => {
    if (wrapLines) return 0;
    const contentWidth = Math.max(columnWidth, maxLineLength * 7.6 + 60);
    return Math.max(0, contentWidth - columnWidth);
  }, [wrapLines, maxLineLength, columnWidth]);

  // Reset scroll whenever the file changes or line wrap is toggled
  useEffect(() => {
    setScrollX(0);
  }, [filename, wrapLines]);

  // Synchronized Wheel Event Listener (Trackpad swipe deltaX & Shift + Mouse wheel deltaY)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (wrapLines || maxScrollX <= 0) return;

      const isHorizontal =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) || (e.shiftKey && e.deltaY !== 0);

      if (isHorizontal) {
        e.preventDefault();
        const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
        setScrollX((prev) => Math.max(0, Math.min(maxScrollX, prev + delta)));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [wrapLines, maxScrollX]);

  // Keyboard navigation for horizontal scroll (ArrowLeft, ArrowRight, Home, End)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (wrapLines || maxScrollX <= 0) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setScrollX((prev) => Math.max(0, prev - 50));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setScrollX((prev) => Math.min(maxScrollX, prev + 50));
    } else if (e.key === "Home") {
      e.preventDefault();
      setScrollX(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setScrollX(maxScrollX);
    }
  };

  // Draggable Scrollbar Thumb Handling
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startScrollX: scrollX,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!trackRef.current || maxScrollX <= 0) return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const trackWidth = trackRect.width;
      const deltaMouseX = e.clientX - dragStartRef.current.startX;
      const scrollDelta = (deltaMouseX / trackWidth) * maxScrollX;
      const newScrollX = Math.max(
        0,
        Math.min(maxScrollX, dragStartRef.current.startScrollX + scrollDelta)
      );
      setScrollX(newScrollX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, maxScrollX]);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current || maxScrollX <= 0) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - trackRect.left;
    const ratio = Math.max(0, Math.min(1, clickX / trackRect.width));
    setScrollX(ratio * maxScrollX);
  };

  // Scrollbar dimensions
  const visibleRatio = Math.min(1, columnWidth / (columnWidth + maxScrollX));
  const thumbWidthPercent = Math.max(16, Math.min(80, visibleRatio * 100));
  const availableThumbTrack = 100 - thumbWidthPercent;
  const scrollRatio = maxScrollX > 0 ? scrollX / maxScrollX : 0;
  const thumbLeftPercent = scrollRatio * availableThumbTrack;

  const scrollLeftStep = (step = 80) => setScrollX((prev) => Math.max(0, prev - step));
  const scrollRightStep = (step = 80) => setScrollX((prev) => Math.min(maxScrollX, prev + step));
  const resetScroll = () => setScrollX(0);

  return {
    scrollX,
    maxScrollX,
    isDragging,
    containerRef,
    trackRef,
    columnWidth,
    thumbWidthPercent,
    thumbLeftPercent,
    handleKeyDown,
    handleThumbMouseDown,
    handleTrackClick,
    scrollLeftStep,
    scrollRightStep,
    resetScroll,
    setScrollX,
  };
}
