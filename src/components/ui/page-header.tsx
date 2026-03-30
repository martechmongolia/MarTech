import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Optional subtitle shown below the title (smaller, muted) */
  subtitle?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, subtitle, className = "" }: PageHeaderProps) {
  return (
    <header className={["ui-page-header", className].filter(Boolean).join(" ")}>
      <h1 className="ui-page-header__title">{title}</h1>
      {subtitle ? <p className="ui-page-header__subtitle">{subtitle}</p> : null}
      {description ? <p className="ui-page-header__description">{description}</p> : null}
    </header>
  );
}
