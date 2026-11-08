import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

// Size and focus strings come from the Kumo registry entry "Input".
export const FIELD_BASE =
  "w-full bg-kumo-base text-kumo-default ring ring-kumo-line outline-none placeholder:text-kumo-subtle disabled:bg-kumo-base/50 disabled:text-kumo-default/70";

// Fields use 16px (text-lg), not Kumo's 14px: iOS Safari zooms the page when a field under 16px gets focus.
export const FIELD_SIZES = {
  sm: "h-8 rounded-md px-2 text-lg",
  base: "h-9 rounded-lg px-3 text-lg",
  lg: "h-10 rounded-lg px-4 text-lg",
} as const;

export const FIELD_VARIANTS = {
  default: "focus:ring-kumo-focus/50 focus:ring-[1.5px]",
  error: "!ring-kumo-danger focus:ring-kumo-danger/50 focus:ring-[1.5px]",
} as const;

export type InputProps = ComponentProps<"input"> & {
  size?: keyof typeof FIELD_SIZES;
  variant?: keyof typeof FIELD_VARIANTS;
};

export default function Input(props: InputProps): JSX.Element {
  const local = merge({ size: "base", variant: "default" } as const, props);
  const rest = omit(local, "size", "variant", "class");
  return (
    <input
      {...rest}
      class={[FIELD_BASE, FIELD_SIZES[local.size], FIELD_VARIANTS[local.variant], local.class]}
    />
  );
}
