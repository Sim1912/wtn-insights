"use client";

import { useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const reducedMotionSnapshot = () => window.matchMedia(reducedMotionQuery).matches;
const reducedMotionServerSnapshot = () => false;
const subscribeToReducedMotion = (notify: () => void) => {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

export function useReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, reducedMotionSnapshot, reducedMotionServerSnapshot);
}

export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const finalValue = `${prefix}${value.toFixed(decimals)}${suffix}`;
  return <span>{finalValue}</span>;
}
