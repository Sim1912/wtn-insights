"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

let revealObserver: IntersectionObserver | null = null;

function sharedRevealObserver() {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) return null;
  revealObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.setAttribute("data-visible", "true");
      revealObserver?.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -7%", threshold: .08 });
  return revealObserver;
}

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

export function ScrollReveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    if (reduced) { node.setAttribute("data-visible", "true"); return; }
    node.classList.add("reveal-enabled");
    const observer = sharedRevealObserver();
    if (!observer) { node.setAttribute("data-visible", "true"); return; }
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [reduced]);
  return <div ref={element} className={`scroll-reveal ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</div>;
}

export function RevealScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const nodes = [...(scope.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [])];
    const observer = sharedRevealObserver();
    for (const [index, node] of nodes.entries()) {
      node.style.setProperty("--reveal-delay", `${Math.min(index, 3) * 60}ms`);
      if (reduced || !observer) node.setAttribute("data-visible", "true");
      else { node.classList.add("reveal-enabled"); observer.observe(node); }
    }
    return () => { if (observer) for (const node of nodes) observer.unobserve(node); };
  }, [reduced]);
  return <div ref={scope} className={className}>{children}</div>;
}

export function ChartEntrance({ children, className = "" }: { children: ReactNode; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced);
  useEffect(() => {
    const node = host.current;
    if (!node || visible) return;
    if (reduced || !("IntersectionObserver" in window)) { queueMicrotask(() => setVisible(true)); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "80px 0px", threshold: .05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, visible]);
  return <div ref={host} className={`chart-entrance ${className}`}>{visible ? children : null}</div>;
}

export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", from }: { value: number; decimals?: number; prefix?: string; suffix?: string; from?: number }) {
  const output = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const finalValue = `${prefix}${value.toFixed(decimals)}${suffix}`;
  useEffect(() => {
    const node = output.current;
    if (!node || reduced) return;
    const formatNumber = (number: number) => `${prefix}${number.toFixed(decimals)}${suffix}`;
    const start = from ?? (value === 0 ? 0 : value - Math.sign(value) * Math.min(Math.abs(value) * .18, decimals ? .12 : 8));
    const started = performance.now();
    const duration = 680;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      node.textContent = formatNumber(start + (value - start) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    node.textContent = formatNumber(start);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, decimals, prefix, suffix, from, reduced]);
  return <span ref={output} aria-label={finalValue}>{finalValue}</span>;
}
