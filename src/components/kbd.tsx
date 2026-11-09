import type { JSX } from "@solidjs/web";

// "button" sits inside a Button: it takes the button's colour, hides on touch screens, which have no
// keyboard, and is hidden from screen readers because the button announces it through aria-keyshortcuts.
const TONES = {
  default: "bg-kumo-fill text-kumo-subtle ring-kumo-hairline",
  button: "hidden bg-transparent text-current opacity-70 ring-current pointer-fine:inline",
} as const;

export type KbdProps = { children: JSX.Element; tone?: keyof typeof TONES };

export default function Kbd(props: KbdProps): JSX.Element {
  return (
    <kbd
      aria-hidden={props.tone === "button" ? "true" : undefined}
      class={["rounded-md px-1.5 py-0.5 font-mono text-xs ring", TONES[props.tone ?? "default"]]}
    >
      {props.children}
    </kbd>
  );
}
