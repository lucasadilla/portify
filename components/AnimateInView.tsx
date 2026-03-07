"use client";

import { useRef, type RefObject } from "react";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";

interface AnimateInViewProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms (e.g. for list items) */
  delay?: number;
  /** Animation style */
  animation?: "fadeUp" | "fade" | "scale";
}

export function AnimateInView({
  children,
  className,
  delay = 0,
  animation = "fadeUp",
}: AnimateInViewProps) {
  const [ref, isInView] = useInView<HTMLDivElement>({
    rootMargin: "0px 0px -50px 0px",
    threshold: 0.05,
    triggerOnce: true,
  });

  const animationClasses = {
    fadeUp: isInView
      ? "opacity-100 translate-y-0"
      : "opacity-0 translate-y-6",
    fade: isInView ? "opacity-100" : "opacity-0",
    scale: isInView
      ? "opacity-100 scale-100"
      : "opacity-0 scale-95",
  };

  return (
    <div
      ref={ref as RefObject<HTMLDivElement>}
      className={cn(
        "transition-all duration-500 ease-out",
        animationClasses[animation],
        className
      )}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
