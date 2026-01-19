import { useCallback, useEffect, useRef, useState } from "react";

interface MaskState {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DraggableMask = () => {
  const globalHudRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maskRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const coordsRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number>(0);

  const [isHovering, setIsHovering] = useState(false);
  const [maskStates, setMaskStates] = useState<MaskState[]>([]);
  const [draggingState, setDraggingState] = useState<{
    index: number | null;
    offsetX: number;
    offsetY: number;
  }>({ index: null, offsetX: 0, offsetY: 0 });

  const updateCoords = useCallback(
    (index: number) => {
      const coordsEl = coordsRefs.current[index];
      if (coordsEl && maskStates[index]) {
        const s = maskStates[index];
        coordsEl.textContent = `X: ${Math.round(s.x)}px Y: ${Math.round(s.y)}px`;
      }
    },
    [maskStates]
  );

  const drawClipped = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      video: HTMLVideoElement,
      rect: MaskState
    ) => {
      const videoAspect = video.videoWidth / video.videoHeight;
      const windowAspect = window.innerWidth / window.innerHeight;

      let dw: number, dh: number, dx: number, dy: number;

      if (videoAspect > windowAspect) {
        dh = window.innerHeight;
        dw = dh * videoAspect;
        dx = (window.innerWidth - dw) / 2;
        dy = 0;
      } else {
        dw = window.innerWidth;
        dh = dw / videoAspect;
        dx = 0;
        dy = (window.innerHeight - dh) / 2;
      }

      const scaleX = video.videoWidth / dw;
      const scaleY = video.videoHeight / dh;

      ctx.drawImage(
        video,
        (rect.x - dx) * scaleX,
        (rect.y - dy) * scaleY,
        rect.w * scaleX,
        rect.h * scaleY,
        0,
        0,
        rect.w,
        rect.h
      );
    },
    []
  );

  const initMasks = useCallback(() => {
    const newStates: MaskState[] = [];
    maskRefs.current.forEach((mask, index) => {
      if (mask) {
        const r = mask.getBoundingClientRect();
        newStates[index] = {
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
        };

        mask.style.left = "0";
        mask.style.top = "0";
        mask.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      }
    });
    setMaskStates(newStates);
  }, []);

  const initCanvases = useCallback(() => {
    maskStates.forEach((s, index) => {
      const canvas = canvasRefs.current[index];
      if (canvas) {
        canvas.width = s.w;
        canvas.height = s.h;
      }
    });
  }, [maskStates]);

  const draw = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    maskStates.forEach((s, index) => {
      const canvas = canvasRefs.current[index];
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawClipped(ctx, video, s);
          updateCoords(index);
        }
      }
    });

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [maskStates, drawClipped, updateCoords]);

  // Global mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isHovering && globalHudRef.current) {
        globalHudRef.current.innerHTML = `X: ${e.clientX}px Y: ${e.clientY}px`;
      }

      if (globalHudRef.current) {
        globalHudRef.current.style.transform = `translate3d(${e.clientX + 2}px, ${e.clientY + 2}px, 0)`;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isHovering]);

  // Video initialization
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handlePlaying = () => {
      initMasks();
      initCanvases();
      draw();
    };

    video.addEventListener("playing", handlePlaying);
    return () => video.removeEventListener("playing", handlePlaying);
  }, [initMasks, initCanvases, draw]);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    const mask = maskRefs.current[index];
    if (!(mask && maskStates[index])) {
      return;
    }

    setDraggingState({
      index,
      offsetX: e.clientX - maskStates[index].x,
      offsetY: e.clientY - maskStates[index].y,
    });
    mask.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (draggingState.index !== index) {
      return;
    }

    const newStates = [...maskStates];
    newStates[index] = {
      ...newStates[index],
      x: e.clientX - draggingState.offsetX,
      y: e.clientY - draggingState.offsetY,
    };
    setMaskStates(newStates);

    const mask = maskRefs.current[index];
    if (mask) {
      mask.style.transform = `translate3d(${newStates[index].x}px, ${newStates[index].y}px, 0)`;
    }
  };

  const handleMouseUp = () => {
    if (draggingState.index !== null) {
      const mask = maskRefs.current[draggingState.index];
      if (mask) {
        mask.style.cursor = "grab";
      }
      setDraggingState({ index: null, offsetX: 0, offsetY: 0 });
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (globalHudRef.current) {
      globalHudRef.current.textContent = "GRAB";
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (globalHudRef.current) {
      globalHudRef.current.textContent = "HOVER";
    }
  };

  // Set refs for each mask
  const setMaskRef = (el: HTMLButtonElement | null, index: number) => {
    maskRefs.current[index] = el;
  };

  const setCanvasRef = (el: HTMLCanvasElement | null, index: number) => {
    canvasRefs.current[index] = el;
  };

  const setCoordsRef = (el: HTMLDivElement | null, index: number) => {
    coordsRefs.current[index] = el;
  };

  return (
    <div>
      <div
        className="absolute top-4 left-4 z-50 cursor-none text-orange-500 transition-[opacity_0.45s_ease,transform_0.15s_linear] will-change-[transform,opacity]"
        ref={globalHudRef}
      />

      <main className="relative z-40 h-screen w-screen bg-[url('https://www.transparenttextures.com/patterns/batthern.png')] bg-background">
        <video
          autoPlay
          className="fixed h-px w-px cursor-none opacity-0"
          id="clip-video"
          loop
          muted
          playsInline
          ref={videoRef}
          src="/video.mp4"
        />

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute top-[15vh] left-[8vw] h-[20vh] w-[35vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 0)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 0)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 0)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 0)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 0)} />
        </button>

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute bottom-[3vh] left-[15vw] h-[20vh] w-[35vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 1)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 1)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 1)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 1)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 1)} />
        </button>

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute top-[15vh] right-[5vw] h-[20vh] w-[35vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 2)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 2)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 2)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 2)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 2)} />
        </button>

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute bottom-[23vh] left-[5vw] h-[10vh] w-[20vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 3)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 3)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 3)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 3)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 3)} />
        </button>

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute top-[28vh] left-[6vw] h-[12vh] w-[22vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 4)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 4)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 4)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 4)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 4)} />
        </button>

        <button
          aria-label="Draggable video mask"
          className="maskContainer absolute top-[20vh] right-[10vw] h-[35vh] w-[60vw] cursor-grab border-none bg-transparent p-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
            }
          }}
          onMouseDown={(e) => handleMouseDown(e, 5)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={(e) => handleMouseMove(e, 5)}
          onMouseUp={handleMouseUp}
          ref={(el) => setMaskRef(el, 5)}
          tabIndex={0}
          type="button"
        >
          <canvas ref={(el) => setCanvasRef(el, 5)} />
          <div className="coords" ref={(el) => setCoordsRef(el, 5)} />
        </button>
      </main>
    </div>
  );
};
