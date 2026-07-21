import { useEffect, useRef, useState } from "react";

export function bustSignedUrl(src: string): string {
  return src;
}

/**
 * Hook para <img> e <video>: gerencia recarregamentos de mídia sem quebrar o src
 * para strings vazias (que geravam caixas pretas na interface).
 */
export function useMediaFallback(originalSrc: string, maxRetries = 2) {
  const [currentSrc, setCurrentSrc] = useState(originalSrc);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    retriesRef.current = 0;
    setCurrentSrc(originalSrc);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [originalSrc]);

  function onError() {
    if (!originalSrc) return;
    if (retriesRef.current >= maxRetries) return;
    retriesRef.current += 1;
    const delay = retriesRef.current === 1 ? 200 : 800;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSrc(originalSrc);
    }, delay);
  }

  return { currentSrc, onError };
}
