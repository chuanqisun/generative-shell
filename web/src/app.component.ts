import { html, render } from "lit";
import { fromFetch } from "rxjs/fetch";
import { concatMap } from "rxjs/operators";
import "./app.component.css";
import "./style.css";
import { component, observe } from "./ui-kit";

const AppComponent = component(() => {
  const dirFiles$ = useDirFiles$();

  const handleSubmit = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const payload = { prompt: data.get("prompt") };
    fetch("api/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  };

  return html`<div class="app-component">
    <div>${observe(dirFiles$)}</div>
    <form class="action-form" @submit=${handleSubmit}>
      <textarea name="prompt" @keydown=${handleEnter}></textarea>
    </form>
  </div>`;
});

export function useDirFiles$() {
  return fromFetch("api/files").pipe(concatMap((res) => res.json()));
}

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
