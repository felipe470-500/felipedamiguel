import React, { useState, useRef, useEffect } from "react";
import { X, MessageCircle, Share2 } from "lucide-react";
import { Vehicle } from "@/lib/vehicles-store";
import { ImageCarousel } from "./ImageCarousel";
import { ImageCounter } from "./ImageCounter";
import { VehicleBottomSheet } from "./VehicleBottomSheet";
import { isVideoUrl } from "@/lib/vehicles-store";
import { buildVehicleShareUrl } from "@/lib/canonical-url";
import { MediaImg, MediaVideo } from "./MediaFallback";


interface ImageViewerProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onContact: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  vehicle,
  onClose,
  onContact,
}) => {
  if (!vehicle) return null;

  const images = vehicle.images.length > 0 ? vehicle.images : ["data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'/>"];
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lightboxScrollRef = useRef<HTMLDivElement>(null);

  // Trigger fade-in animation
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 30);
    return () => clearTimeout(timer);
  }, []);

  function scrollToIndex(i: number) {
    setIdx(i);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.clientWidth * i,
        behavior: "smooth",
      });
    }
    if (lightboxScrollRef.current) {
      lightboxScrollRef.current.scrollTo({
        left: lightboxScrollRef.current.clientWidth * i,
        behavior: "smooth",
      });
    }
  }

  // Handle scroll on the main inline carousel
  function handleMainScroll() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth === 0) return;
    const index = Math.round(scrollLeft / clientWidth);
    if (index !== idx) {
      setIdx(index);
    }
  }

  // Handle scroll on the lightbox carousel
  function handleLightboxScrollIndex(index: number) {
    setIdx(index);
  }

  function handleShare() {
    const shareUrl = buildVehicleShareUrl(vehicle!.id);
    if (navigator.share) {
      navigator.share({
        title: vehicle!.name,
        text: `Confira este veículo: ${vehicle!.name}`,
        url: shareUrl,
      }).catch(() => {
        // Ignora erro
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copiado para a área de transferência!");
    }
  }


  // Sync index when opening/closing lightbox
  useEffect(() => {
    if (lightboxOpen) {
      setTimeout(() => {
        if (lightboxScrollRef.current) {
          lightboxScrollRef.current.scrollTo({
            left: lightboxScrollRef.current.clientWidth * idx,
            behavior: "auto",
          });
        }
      }, 50);
    } else {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          left: scrollRef.current.clientWidth * idx,
          behavior: "auto",
        });
      }
    }
  }, [lightboxOpen]);

  return (
    <>
      {/* Visualização de Publicação (Modal Padrão) */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-0 md:p-4 transition-opacity duration-300 ${
          isMounted ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] md:rounded-2xl border-0 md:border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden"
        >
          {/* Botão de Fechar Fixo (X Flutuante) para o modal da publicação */}
          <button
            onClick={onClose}
            aria-label="Fechar publicação"
            className="absolute right-4 top-[env(safe-area-inset-top,24px)] z-[110] w-[52px] h-[52px] rounded-full bg-[rgba(20,20,20,0.75)] hover:bg-[rgba(20,20,20,0.9)] text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-lg"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Área de Conteúdo Rolar (Fica rolável dentro do card) */}
          <div className="flex-1 overflow-y-auto">
            {/* Carrossel de Mídia (Clicável para abrir Tela Inteira) */}
            <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-[#101318] border-b border-border flex items-center justify-center">
              <div
                ref={scrollRef}
                onScroll={handleMainScroll}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth"
              >
                {images.map((src, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (!isVideoUrl(src)) {
                        setLightboxOpen(true);
                      }
                    }}
                    className="h-full w-full flex-shrink-0 snap-start snap-always flex items-center justify-center bg-black cursor-zoom-in"
                  >
                    {isVideoUrl(src) ? (
                      <MediaVideo
                        src={i === idx ? src : undefined}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload={i === idx ? "metadata" : "none"}
                        className="max-h-full max-w-full block cursor-pointer"
                        style={{ objectFit: "contain" }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      />
                    ) : (
                      <MediaImg
                        src={src}
                        alt={`${vehicle.name} - Foto ${i + 1}`}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                        className="max-h-full max-w-full block cursor-pointer object-contain"
                        style={{ objectFit: "contain" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxOpen(true);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Contador simples na foto */}
              <ImageCounter current={idx + 1} total={images.length} />
            </div>

            {/* Ficha Técnica e Botões de Contato Inline */}
            <VehicleBottomSheet
              vehicle={vehicle}
              images={images}
              idx={idx}
              scrollToIndex={scrollToIndex}
              onContact={onContact}
              onShare={handleShare}
            />
          </div>
        </div>
      </div>

      {/* Visualização em Tela Inteira (Lightbox Premium com Gestos) */}
      {lightboxOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(false);
          }}
          className="fixed inset-0 z-[200] bg-black select-none overflow-y-auto overflow-x-hidden flex flex-col justify-center animate-fade-in"
        >
          {/* Botão de Voltar (X Flutuante) para fechar a tela cheia */}
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Fechar tela cheia"
            className="fixed right-4 top-[env(safe-area-inset-top,24px)] z-[220] w-[52px] h-[52px] rounded-full bg-[rgba(20,20,20,0.75)] hover:bg-[rgba(20,20,20,0.9)] text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-lg"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Carrossel Interativo em Tela Cheia com Gestos */}
          <div className="relative w-full h-[72dvh] md:h-[550px] bg-black overflow-hidden flex items-center justify-center">
            <ImageCarousel
              images={images}
              vehicleName={vehicle.name}
              idx={idx}
              onScrollIndex={handleLightboxScrollIndex}
              scrollRef={lightboxScrollRef}
              onDragDown={(distance) => {
                // Drag down gesture within lightbox
              }}
              onDragEnd={(shouldClose) => {
                if (shouldClose) setLightboxOpen(false);
              }}
            />

            {/* Contador de Imagens */}
            <ImageCounter current={idx + 1} total={images.length} />
          </div>
        </div>
      )}
    </>
  );
};



