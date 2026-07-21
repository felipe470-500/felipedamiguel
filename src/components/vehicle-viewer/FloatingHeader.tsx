import React from "react";
import { ArrowLeft, Share2 } from "lucide-react";

interface FloatingHeaderProps {
  onBack: () => void;
  onShare: () => void;
  vehicleId: string;
}

export const FloatingHeader: React.FC<FloatingHeaderProps> = ({
  onBack,
  onShare,
  vehicleId,
}) => {
  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 pt-[env(safe-area-inset-top,24px)] pb-4 pointer-events-none">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="pointer-events-auto w-[52px] h-[52px] rounded-full bg-[rgba(20,20,20,0.75)] hover:bg-[rgba(20,20,20,0.9)] text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-lg"
      >
        <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={onShare}
          aria-label="Compartilhar"
          className="pointer-events-auto w-[52px] h-[52px] rounded-full bg-[rgba(20,20,20,0.75)] hover:bg-[rgba(20,20,20,0.9)] text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-lg"
        >
          <Share2 className="w-5.5 h-5.5" />
        </button>
      </div>
    </header>
  );
};

