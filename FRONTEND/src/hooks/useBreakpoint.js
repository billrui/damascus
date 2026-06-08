/**
 * useBreakpoint — shared responsive hook for Damascus Hotel POS
 * xs: < 480px  (small phones)
 * sm: < 640px  (phones)
 * md: < 768px  (large phones / small tablets)
 * lg: < 1024px (tablets)
 * xl: >= 1024px (desktops)
 */
import { useState, useEffect } from "react";

export function useBreakpoint() {
  const [w, setW] = useState(() => window.innerWidth);

  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    const ro = new ResizeObserver(() => setW(window.innerWidth));
    ro.observe(document.documentElement);
    window.addEventListener("resize", handler);
    return () => { ro.disconnect(); window.removeEventListener("resize", handler); };
  }, []);

  return {
    w,
    xs:     w < 480,
    sm:     w < 640,
    mobile: w < 768,
    tablet: w < 1024,
    desktop: w >= 1024,
    // Helpers
    cols: (desktop, tablet, mobile) => w >= 1024 ? desktop : w >= 768 ? tablet : mobile,
    pad:  w < 480 ? 10 : w < 768 ? 14 : w < 1024 ? 18 : 24,
    fontSize: (base) => w < 480 ? Math.max(10, base - 2) : w < 768 ? Math.max(11, base - 1) : base,
  };
}

export default useBreakpoint;
