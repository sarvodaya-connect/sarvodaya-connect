"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { FounderSignature } from "./founder-signature";

const DASHBOARD_URL = "/dashboard";
const DASHBOARD_ENTRY_PATH = "/welcome";

const HOLD_MS = 5000;
// If the portrait is slow, start the countdown anyway rather than wait on it.
const ARTWORK_WAIT_MS = 3000;

// His quotation, as confirmed by the project owner.
// The lettered image (quotation-sithumina.webp) is rendered from this text; keep them in step.
const QUOTATION_LINES = [
  "පොදු මහජනතාවට අවසාන ජයග්‍රහණය",
  "ලැබෙන්නේ රට පුරාම සෘජු වශයෙන්",
  "තමන්ට පාලනය කරගත හැකි කුඩා පරිමාණ",
  "ආයතන බිහිවූ තරමටයි",
];

const noSubscription = () => () => {};
// `?preview` holds the screen still for design review. It only pauses the timer.
const isStillPreview = () =>
  new URLSearchParams(window.location.search).has("preview");

export function SignInWelcome() {
  const router = useRouter();
  const still = useSyncExternalStore(noSubscription, isStillPreview, () => false);
  const [ready, setReady] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const portrait = useRef<HTMLImageElement>(null);
  const left = useRef(false);

  // Ready once the portrait has loaded, failed, or taken too long.
  useEffect(() => {
    const wait = window.setTimeout(
      () => setReady(true),
      portrait.current?.complete ? 0 : ARTWORK_WAIT_MS,
    );
    return () => window.clearTimeout(wait);
  }, []);

  // Warm the role home during the tribute; keep this screen visible while
  // Next transitions instead of tearing down the document with location.replace.
  useEffect(() => {
    if (ready && !still) router.prefetch(DASHBOARD_URL);
  }, [ready, still, router]);

  useEffect(() => {
    if (!ready || still) return;
    const hold = window.setTimeout(() => {
      if (left.current) return;
      left.current = true;
      router.replace(DASHBOARD_URL);
    }, HOLD_MS);
    return () => window.clearTimeout(hold);
  }, [ready, still, router]);

  return (
    <main className="founder-entry relative min-h-dvh overflow-hidden text-[#18120a]">
      {/* Keyboard and screen-reader users can skip the wait; it only appears on focus. */}
      <a
        className="sr-only z-20 rounded-button bg-white px-4 py-2.5 text-sm font-semibold text-ink focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:outline-none focus:ring-3 focus:ring-orange-ring"
        href={DASHBOARD_URL}
        onClick={(event) => {
          event.preventDefault();
          left.current = true;
          router.replace(DASHBOARD_URL);
        }}
      >
        Skip to the dashboard
      </a>

      <div className="founder-entry-stage relative mx-auto grid min-h-dvh max-w-[1400px] items-center px-5 md:px-10">
        {/* Watercolour portrait; its white paper edges melt into the white page. */}
        <div className="founder-entry-portrait-wrap relative flex items-center justify-center">
          {portraitFailed ? (
            <p className="relative text-center text-2xl font-bold text-ink">Dr. A. T. Ariyaratne</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static export; plain img gives direct load and error events
            <img
              alt="Watercolour portrait of Dr. A. T. Ariyaratne, founder of the Sarvodaya Shramadana Movement."
              className={`founder-entry-portrait relative block h-auto ${ready ? "founder-entry-in" : ""}`}
              decoding="async"
              height={1427}
              onError={() => {
                setPortraitFailed(true);
                setReady(true);
              }}
              onLoad={() => setReady(true)}
              ref={portrait}
              src="/founder/portrait-watercolour.webp"
              width={1102}
            />
          )}
        </div>

        {/* His quotation, then his signature signed in stroke by stroke. */}
        <figure className={`founder-entry-quote m-0 flex flex-col items-center ${ready ? "founder-entry-write" : ""}`}>
          <blockquote className="m-0 text-center" lang="si">
            {/* Lettered in SINHA Sithumina 2012, rendered to an image so the font file is not served. */}
            {!quoteFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                aria-hidden="true"
                className="founder-entry-quote-art block h-auto"
                height={810}
                onError={() => setQuoteFailed(true)}
                src="/founder/quotation-sithumina.webp"
                width={1665}
              />
            )}
            <div className={quoteFailed ? "founder-entry-text" : "sr-only"}>
              {QUOTATION_LINES.map((line) => (
                <p className="m-0" key={line}>
                  {line}
                </p>
              ))}
            </div>
          </blockquote>
          <figcaption className="mt-[3dvh] flex flex-col items-center lg:mt-[4dvh]">
            <FounderSignature />
          </figcaption>

          <div className="founder-entry-loader mt-[3dvh] flex items-center gap-3" role="status">
            <svg aria-hidden="true" className="size-9" viewBox="0 0 40 40">
              <circle cx="20" cy="20" fill="none" r="17" stroke="rgb(24 18 10 / 0.12)" strokeWidth="2" />
              <circle
                className={ready && !still ? "founder-entry-ring" : "founder-entry-ring-idle"}
                cx="20"
                cy="20"
                fill="none"
                pathLength={1}
                r="17"
                stroke="#5c4d2e"
                strokeDasharray="1"
                strokeLinecap="round"
                strokeWidth="2"
                transform="rotate(-90 20 20)"
              />
              <circle className="founder-entry-dot" cx="20" cy="20" fill="#5c4d2e" r="3" />
            </svg>
            <span className="text-sm font-medium tracking-wide text-[#4a3f2a]">
              Opening the Staff Dashboard
            </span>
          </div>
        </figure>
      </div>

      {still ? (
        <a
          className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#18120a]/80 px-4 py-2 text-xs text-white underline-offset-2 hover:underline"
          href={DASHBOARD_ENTRY_PATH}
        >
          Preview · timer paused — play the timed version
        </a>
      ) : null}
    </main>
  );
}
