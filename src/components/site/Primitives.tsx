import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, tone = "copper" }: { children: ReactNode; tone?: "copper" | "light" }) {
  return (
    <span
      className={`label-eyebrow inline-flex items-center gap-2 ${
        tone === "copper" ? "text-accent" : "text-[color-mix(in_oklab,var(--ink-foreground)_70%,transparent)]"
      }`}
    >
      <span className="h-px w-6 bg-current opacity-60" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  tone = "dark",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: string;
  align?: "left" | "center";
  tone?: "dark" | "light";
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow ? <Eyebrow tone={tone === "light" ? "light" : "copper"}>{eyebrow}</Eyebrow> : null}
      <h2
        className={`mt-4 text-3xl leading-[1.1] font-semibold text-balance-tight sm:text-4xl lg:text-[2.75rem] ${
          tone === "light" ? "text-ink-foreground" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`mt-4 text-base leading-relaxed ${
            tone === "light"
              ? "text-[color-mix(in_oklab,var(--ink-foreground)_72%,transparent)]"
              : "text-muted-foreground"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-6 ${className}`}>{children}</div>;
}
