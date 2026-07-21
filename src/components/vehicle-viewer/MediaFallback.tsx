import React from "react";
import { useMediaFallback } from "@/lib/media-refresh";

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & { src: string };
type VideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & { src?: string };

/**
 * <img> que revalida a signed URL automaticamente ao dar erro
 * (ex.: link expirado após 1h).
 */
export const MediaImg: React.FC<ImgProps> = ({ src, onError, ...rest }) => {
  const { currentSrc, onError: retry } = useMediaFallback(src);
  return (
    <img
      {...rest}
      src={currentSrc}
      onError={(e) => {
        retry();
        onError?.(e);
      }}
    />
  );
};

/**
 * <video> que revalida a signed URL automaticamente ao dar erro.
 * `src` pode ser undefined (usado para pausar carregamento fora do viewport).
 */
export const MediaVideo = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ src, onError, ...rest }, ref) => {
    const { currentSrc, onError: retry } = useMediaFallback(src ?? "");
    return (
      <video
        {...rest}
        ref={ref}
        src={src ? currentSrc : undefined}
        onError={(e) => {
          if (src) retry();
          onError?.(e);
        }}
      />
    );
  },
);
MediaVideo.displayName = "MediaVideo";
