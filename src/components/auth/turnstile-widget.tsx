"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type TurnstileWidgetProps = {
  siteKey: string;
  /** Controlled setter — receives the Turnstile token when the challenge
   * completes, or null when it expires / is reset. */
  onTokenChange: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact" | "invisible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    __turnstileLoadedCallbacks?: Array<() => void>;
    onloadTurnstileCallback?: () => void;
  }
}

/**
 * Cloudflare Turnstile CAPTCHA widget. Renders a managed challenge and reports
 * the validation token back via onTokenChange. The consumer should wire that
 * token into a hidden form input so the server action can verify it.
 */
export function TurnstileWidget({ siteKey, onTokenChange, theme = "auto" }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const render = () => {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // already rendered
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => onTokenChange(null)
      });
    };

    if (window.turnstile) {
      render();
      return;
    }
    const callbacks = (window.__turnstileLoadedCallbacks ??= []);
    callbacks.push(render);
    return () => {
      const idx = callbacks.indexOf(render);
      if (idx >= 0) callbacks.splice(idx, 1);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, onTokenChange]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          window.onloadTurnstileCallback = () => {
            (window.__turnstileLoadedCallbacks ?? []).forEach((cb) => cb());
          };
          if (window.turnstile) {
            // Script onload can fire after turnstile object is ready (SPA navigations).
            (window.__turnstileLoadedCallbacks ?? []).forEach((cb) => cb());
          }
        }}
      />
      <div ref={containerRef} className="login-turnstile" />
    </>
  );
}
