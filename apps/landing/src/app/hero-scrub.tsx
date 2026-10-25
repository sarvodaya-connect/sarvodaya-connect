"use client";

import { useEffect, useRef } from "react";

/** How quickly the shown frame catches up with the scroll position (0–1). */
const EASE = 0.2;

/** Frame order for loading: a few frames spread across the clip first, then the gaps. */
function loadOrder(count: number) {
  const order: number[] = [];
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) if (!order.includes(i)) order.push(i);
  }
  return order;
}

/**
 * The village animation in the first screen, scrubbed by scroll: scrolling down moves it
 * forward, scrolling up moves it back. It draws still frames on a canvas instead of
 * seeking a video, so every position is instant and the scrub stays smooth. On wide
 * screens the hero is pinned inside a taller `[data-hero-scrub]` wrapper, so the
 * animation plays across that extra scroll distance; on phones it scrubs while it
 * passes through the screen. Frames load in the background, coarse to fine, and the
 * nearest loaded frame is shown until the rest arrive. It stays on the still first
 * frame (the poster underneath) for anyone who prefers reduced motion.
 */
export function HeroScrubFrames({ base, count }: { base: string; count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const wrapper = canvas.closest<HTMLElement>("[data-hero-scrub]");
    const pinned = wrapper?.firstElementChild as HTMLElement | null;
    const images: (HTMLImageElement | null)[] = Array(count).fill(null);
    let target = 0;
    let shown = 0;
    let drawn = -1;
    let frame = 0;
    let cancelled = false;

    const nearestLoaded = (index: number) => {
      for (let d = 0; d < count; d++) {
        if (images[index - d]) return index - d;
        if (images[index + d]) return index + d;
      }
      return -1;
    };

    const draw = (force = false) => {
      const index = nearestLoaded(Math.round(shown * (count - 1)));
      if (index < 0 || (index === drawn && !force)) return;
      const image = images[index]!;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      // Cover the canvas, like object-fit: cover.
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.drawImage(
        image,
        ((width - drawWidth) / 2) * ratio,
        ((height - drawHeight) / 2) * ratio,
        drawWidth * ratio,
        drawHeight * ratio,
      );
      drawn = index;
    };

    const progress = () => {
      const distance = wrapper && pinned ? wrapper.offsetHeight - pinned.offsetHeight : 0;
      if (distance > 40) return window.scrollY / distance;
      const box = canvas.getBoundingClientRect();
      return (window.innerHeight - box.top) / (window.innerHeight + box.height);
    };

    const tick = () => {
      frame = 0;
      shown += (target - shown) * EASE;
      if (Math.abs(target - shown) < 0.001) shown = target;
      draw();
      if (shown !== target) frame = requestAnimationFrame(tick);
    };

    const update = () => {
      target = Math.min(1, Math.max(0, progress()));
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      update();
      draw(true);
    };

    for (const index of loadOrder(count)) {
      const image = new Image();
      image.decoding = "async";
      image.src = `${base}${String(index + 1).padStart(2, "0")}.webp`;
      image
        .decode()
        .then(() => {
          if (cancelled) return;
          images[index] = image;
          draw();
        })
        .catch(() => {});
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", onResize);
    };
  }, [base, count]);

  return (
    <canvas
      className="hero-frames absolute inset-0 size-full"
      data-count={count}
      data-frames={base}
      ref={ref}
    />
  );
}
