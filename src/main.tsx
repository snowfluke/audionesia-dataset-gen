import { render } from "@solidjs/web";

import App from "./app.tsx";
import "./styles/app.css";

const root = document.getElementById("root");
if (!(root instanceof HTMLElement)) throw new Error("#root is missing from index.html");

render(() => <App />, root);
