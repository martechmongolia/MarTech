import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline-white"
  | "hero-primary";

export type ButtonSize = "sm" | "md" | "lg" | "default";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /**
   * - "sm" / "lg" → explicit size
   * - "md" / "default" → base size (default)
   */
  size?: ButtonSize;
  /** Stretch to full container width */
  full?: boolean;
};

export function Button({
  variant = "primary",
  size = "default",
  full = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const sizeClass =
    size === "sm" ? "ui-button--sm" :
    size === "lg" ? "ui-button--lg" :
    null;

  const cls = [
    "ui-button",
    `ui-button--${variant}`,
    sizeClass,
    full && "ui-button--full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={cls} {...rest} />;
}
