import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icons";

type Common = { variant?: "primary" | "secondary"; small?: boolean; arrow?: boolean; children: ReactNode };

const classes = ({ variant = "primary", small }: Pick<Common, "variant" | "small">, extra?: string) =>
  ["bt", variant === "primary" ? "p" : "s", small && "sm", extra].filter(Boolean).join(" ");

/** Primary (accent fill) or secondary (outline) button. `arrow` adds the design's trailing arrow. */
export function Button({ variant, small, arrow, children, className, type = "button", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, small }, className)} {...rest}>
      {children}{arrow && <Icon name="arrow" />}
    </button>
  );
}

/** The same look for navigation, such as moving to another page. */
export function ButtonLink({ variant, small, arrow, children, href }: Common & { href: string }) {
  return <a className={classes({ variant, small })} href={href}>{children}{arrow && <Icon name="arrow" />}</a>;
}
