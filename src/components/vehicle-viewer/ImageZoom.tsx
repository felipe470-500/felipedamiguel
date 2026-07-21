import React, { useState, useRef, useEffect } from "react";
import { MediaImg } from "./MediaFallback";

interface ImageZoomProps {
  src: string;
  alt: string;
  onDragDown?: (distance: number) => void;
  onDragEnd?: (shouldClose: boolean) => void;
}

export const ImageZoom: React.FC<ImageZoomProps> = ({
  src,
  alt,
  onDragDown,
  onDragEnd,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const lastDistance = useRef<number | null>(null);
  const isPinching = useRef(false);
  const lastTap = useRef<number>(0);
  const dragStartY = useRef<number | null>(null);
  const isDraggingDown = useRef(false);

  // Reset zoom on index/src change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastTouch.current = { x: touch.clientX, y: touch.clientY };
      isPinching.current = false;

      // Check double tap
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // Toggle Zoom
        if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setScale(2.5);
          // Center zoom at touch point
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const touchX = touch.clientX - rect.left - rect.width / 2;
            const touchY = touch.clientY - rect.top - rect.height / 2;
            setPosition({ x: -touchX * 1.5, y: -touchY * 1.5 });
          }
        }
        e.preventDefault();
      }
      lastTap.current = now;

      // Handle drag down initiation
      if (scale === 1) {
        dragStartY.current = touch.clientY;
        isDraggingDown.current = true;
      }
    } else if (e.touches.length === 2) {
      isPinching.current = true;
      isDraggingDown.current = false;
      dragStartY.current = null;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastDistance.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching.current && e.touches.length === 2 && lastDistance.current !== null) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = dist / lastDistance.current;
      const newScale = Math.max(1, Math.min(4, scale * factor));
      setScale(newScale);
      lastDistance.current = dist;
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (!isPinching.current && e.touches.length === 1 && lastTouch.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastTouch.current.x;
      const deltaY = touch.clientY - lastTouch.current.y;

      if (scale > 1) {
        e.preventDefault();
        setPosition((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
        lastTouch.current = { x: touch.clientX, y: touch.clientY };
      } else if (isDraggingDown.current && dragStartY.current !== null) {
        const pullDistance = touch.clientY - dragStartY.current;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        if (pullDistance > 10 && absY > absX * 1.5) {
          e.preventDefault();
          onDragDown?.(pullDistance);
        } else if (pullDistance < 0 || absX > absY) {
          isDraggingDown.current = false;
          dragStartY.current = null;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    lastTouch.current = null;
    lastDistance.current = null;
    isPinching.current = false;

    if (isDraggingDown.current && dragStartY.current !== null) {
      isDraggingDown.current = false;
      onDragEnd?.(true);
      dragStartY.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full flex items-center justify-center overflow-hidden bg-black select-none"
      style={{ touchAction: scale > 1 ? "none" : "pan-x pan-y" }}
    >
      <MediaImg
        src={src}
        alt={alt}
        className="max-h-full max-w-full select-none pointer-events-none block transition-transform duration-75 ease-out object-contain"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          objectFit: "contain",
        }}
      />
    </div>
  );
};

