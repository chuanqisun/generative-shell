import { html, render } from "lit";
import "./style.css";
import { component } from "./ui-kit";

const AppComponent = component(() => {
  return html`<div class="app-component">App</div>`;
});

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
