import React from "react";
import { Vehicle, isVideoUrl } from "@/lib/vehicles-store";
import { MessageCircle, Share2, PlayCircle } from "lucide-react";
import { MediaImg } from "./MediaFallback";


interface VehicleBottomSheetProps {
  vehicle: Vehicle;
  images: string[];
  idx: number;
  scrollToIndex: (i: number) => void;
  onContact: () => void;
  onShare: () => void;
}

export const VehicleBottomSheet: React.FC<VehicleBottomSheetProps> = ({
  vehicle,
  images,
  idx,
  scrollToIndex,
  onContact,
  onShare,
}) => {
  return (
    <div className="bg-[#171717] rounded-t-[28px] p-6 shadow-[0_-8px_30px_rgb(0,0,0,0.5)] border-t border-white/5 pb-28">
      {/* Miniaturas de Navegação (integradas logo no topo do card) */}
      {images.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto pb-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-xl border transition-all ${
                i === idx ? "border-primary scale-[1.03] ring-2 ring-primary/20" : "border-white/10 opacity-70"
              }`}
            >
              {isVideoUrl(src) ? (
                <span className="flex h-full w-full items-center justify-center bg-black text-white/80">
                  <PlayCircle className="h-6 w-6" />
                </span>
              ) : (
                <MediaImg src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Nome e Preço */}
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
          {vehicle.name}
        </h1>
        <div className="text-3xl font-extrabold text-white tracking-tight">
          R$ {vehicle.price}
        </div>
      </div>

      {/* Especificações Básicas */}
      <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-6">
        <span>Ano {vehicle.year}</span>
      </div>

      {/* Tags de Destaque */}
      {vehicle.tag && (
        <div className="flex flex-wrap gap-2.5 mb-8">
          <span className="bg-primary/20 border border-primary/30 text-primary-foreground rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wider">
            {vehicle.tag}
          </span>
        </div>
      )}

      {/* Descrição */}
      {vehicle.description && (
        <div className="border-t border-white/10 pt-6">
          <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-3">
            Descrição do Vendedor
          </h3>
          <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap font-normal">
            {vehicle.description}
          </p>
        </div>
      )}

      {/* Botões de Ação Inline (no final da publicação) */}
      <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onContact}
          className="flex-1 h-14 rounded-2xl bg-whatsapp hover:opacity-90 text-whatsapp-foreground font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg text-[15px]"
        >
          <MessageCircle className="w-5.5 h-5.5 fill-current" />
          Falar com a equipe
        </button>
        <button
          onClick={onShare}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#2A2A2A] hover:bg-[#3A3A3A] px-6 h-14 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        >
          <Share2 className="w-4.5 h-4.5" />
          Compartilhar link
        </button>
      </div>
    </div>
  );
};

