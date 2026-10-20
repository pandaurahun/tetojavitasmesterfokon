import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toPngDataUrl: () => string | null;
}

// A brush stroke shorter than this (CSS px, summed over the whole signature)
// is an accidental touch or a dot, not a signature.
const MIN_SIGNATURE_PATH_PX = 20;

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const pathLengthRef = useRef(0);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const snapshot = emptyRef.current ? null : canvas.toDataURL("image/png");
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "#1a1a1a";
        if (snapshot) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
          img.src = snapshot;
        }
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }, []);

    const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety (keeps the stroke going outside the box) */
      }
      drawingRef.current = true;
      lastPointRef.current = pointFromEvent(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const last = lastPointRef.current;
      if (!canvas || !ctx || !last) return;
      const point = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      pathLengthRef.current += Math.hypot(point.x - last.x, point.y - last.y);
      lastPointRef.current = point;
      if (emptyRef.current && pathLengthRef.current >= MIN_SIGNATURE_PATH_PX) {
        emptyRef.current = false;
        setIsEmpty(false);
      }
    };

    const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = false;
      lastPointRef.current = null;
      // After a touch's pointerup the pointer no longer exists, and releasing
      // its capture throws — only release one that is actually held.
      const canvas = canvasRef.current;
      try {
        if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      emptyRef.current = true;
      pathLengthRef.current = 0;
      setIsEmpty(true);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        clear,
        isEmpty: () => emptyRef.current,
        toPngDataUrl: () => {
          if (emptyRef.current || !canvasRef.current) return null;
          return canvasRef.current.toDataURL("image/png");
        },
      }),
      [clear],
    );

    return (
      <div className={className}>
        <div className="relative touch-none rounded-[var(--radius-button)] border-2 border-dashed border-input bg-white">
          <canvas
            ref={canvasRef}
            aria-label="Aláírás mező: rajzoljon ujjal, tollal vagy egérrel"
            className="h-40 w-full touch-none sm:h-48"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          />
          {isEmpty ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Írjon alá ujjal, tollal vagy egérrel ide
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={clear}>
          <Eraser className="h-4 w-4" /> Törlés
        </Button>
      </div>
    );
  },
);
