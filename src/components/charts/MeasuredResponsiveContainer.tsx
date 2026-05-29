"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

type MeasuredResponsiveContainerProps = {
  children: ReactElement;
  className?: string;
  minHeight?: number;
  style?: CSSProperties;
};

type ChartSize = {
  width: number;
  height: number;
};

export default function MeasuredResponsiveContainer({
  children,
  className,
  minHeight = 240,
  style,
}: MeasuredResponsiveContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      setSize((current) => {
        if (width <= 0 || height <= 0) {
          return current;
        }

        if (current?.width === width && current.height === height) {
          return current;
        }

        return { width, height };
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight,
        ...style,
      }}
    >
      {size ? (
        <ResponsiveContainer width={size.width} height={size.height}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
