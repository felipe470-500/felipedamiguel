import React from "react";
import { MessageCircle } from "lucide-react";

interface VehicleActionsProps {
  onContactChat?: () => void;
  onCall?: () => void;
  onWhatsApp: () => void;
}

export const VehicleActions: React.FC<VehicleActionsProps> = ({
  onWhatsApp,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#171717]/95 backdrop-blur-md border-t border-white/5 px-6 pt-4 pb-[env(safe-area-inset-bottom,20px)] flex items-center">
      {/* Botão WhatsApp (Verde) */}
      <button
        onClick={onWhatsApp}
        className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-600/10 text-[16px]"
      >
        <MessageCircle className="w-5.5 h-5.5 fill-current" />
        <span>Falar no WhatsApp</span>
      </button>
    </div>
  );
};

