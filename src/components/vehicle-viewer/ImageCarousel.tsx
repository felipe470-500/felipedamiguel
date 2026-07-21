import React from "react";
import { ImageZoom } from "./ImageZoom";
import { MediaVideo } from "./MediaFallback";
import { isVideoUrl } from "@/lib/vehicles-store";

interface ImageCarouselProps {
  images: string[];
  vehicleName: string;
  idx: number;
  onScrollIndex: (index: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onDragDown?: (distance: number) => void;
  onDragEnd?: (shouldClose: boolean) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  vehicleName,
  idx,
  onScrollIndex,
  scrollRef,
  onDragDown,
  onDragEnd,
}) => {
  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth === 0) return;
    const index = Math.round(scrollLeft / clientWidth);
    if (index !== idx) {
      onScrollIndex(index);
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
    >
      {images.map((src, i) => (
        <div key={i} className="w-full h-full flex-shrink-0 snap-start snap-always">
          {isVideoUrl(src) ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <MediaVideo
                src={i === idx ? src : undefined}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload={i === idx ? "metadata" : "none"}
                className="w-full h-auto max-h-full max-w-full"
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : (
            <ImageZoom
              src={src}
              alt={`${vehicleName} - Foto ${i + 1}`}
              onDragDown={onDragDown}
              onDragEnd={onDragEnd}
            />
          )}
        </div>
      ))}
    </div>
  );
};
