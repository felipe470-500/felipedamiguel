import React from "react";

interface ImageCounterProps {
  current: number;
  total: number;
}

export const ImageCounter: React.FC<ImageCounterProps> = ({ current, total }) => {
  if (total <= 1) return null;
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
      <div className="px-4 py-1.5 rounded-full bg-white/20 text-white text-[13px] font-medium backdrop-blur-md border border-white/10 shadow-lg tracking-wider">
        {current} / {total}
      </div>
    </div>
  );
};
