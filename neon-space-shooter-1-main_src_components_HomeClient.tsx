"use client";

import { useEffect, useState } from "react";
import GalaxyRacer from "@/components/GalaxyRacer";

export const HomeClient = () => {
  const [started, setStarted] = useState(false);
  const [showGate, setShowGate] = useState(true);

  // Focus management hint: prevent background scroll when gate is open
  useEffect(() => {
    if (showGate) {
      document.documentElement.classList.add("overflow-hidden");
      document.body.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, [showGate]);

  const handlePlay = () => {
    setStarted(true);
    setShowGate(false);
  };

  const handleClose = () => {
    setStarted(false);
    setShowGate(false);
  };

  return (
    <div className="relative min-h-[100dvh] w-full">
      {/* Initial gate overlay */}
      {showGate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-white/15 bg-card/90 p-6 text-center shadow-xl">
            <h2 className="mb-3 text-lg md:text-xl">Ready to Play?</h2>
            <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
              Galaxy Racer: Neon Drift is a fast-paced retro space shooter. Choose
              Play to start the game, or Close to view the landing screen.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePlay}
                className="inline-flex h-10 flex-none items-center justify-center rounded-md bg-primary px-4 text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
              >
                Play
              </button>
              <button
                onClick={handleClose}
                className="inline-flex h-10 flex-none items-center justify-center rounded-md border border-border bg-background px-4 text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content: either landing or the game */}
      {!started ? (
        <section className="mx-auto grid min-h-[100dvh] max-w-5xl place-items-center px-4 py-16 text-center">
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Retro Arcade Shooter
              </p>
              <h2 className="text-2xl md:text-4xl">
                Galaxy Racer: Neon Drift
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                Pilot a neon starfighter through a synthwave galaxy. Dodge asteroids,
                blast enemies, collect power-ups, and chase high scores.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePlay}
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
              >
                Play Now
              </button>
            </div>
            <ul className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 text-left text-[11px] text-muted-foreground md:text-xs">
              <li className="rounded-md border border-border/70 p-3">
                <span className="font-medium text-foreground">Desktop Controls</span>
                <br /> WASD / Arrows to move · Space to toggle autofire · P/Esc to pause · R to restart
              </li>
              <li className="rounded-md border border-border/70 p-3">
                <span className="font-medium text-foreground">Mobile</span>
                <br /> On-screen controls and adaptive layout for smaller screens
              </li>
            </ul>
          </div>
        </section>
      ) : (
        <div className="h-[100dvh] w-full touch-none overscroll-none">
          <GalaxyRacer />
        </div>
      )}
    </div>
  );
};

export default HomeClient;