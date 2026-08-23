import { html, render } from "lit";
import { map as litMap } from "lit/directives/map.js";
import { Observable, Subject } from "rxjs";
import { fromFetch } from "rxjs/fetch";
import { concatMap, map, startWith, switchMap } from "rxjs/operators";
import "./app.component.css";
import "./style.css";
import { component, observe } from "./ui-kit";

const AppComponent = component(() => {
  const dirFiles$ = useDirFiles$();
  const script$ = new Subject<string>();
  const result$ = new Subject<string>();

  const handleGenerate = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const payload = data.get("prompt");
    fetch("api/code", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => script$.next(data));
  };

  const handleRun = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const script = data.get("script") as string;
    fetch("api/run", {
      method: "POST",
      body: JSON.stringify(script.trim()),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => result$.next(JSON.stringify(data, null, 2)));
  };

  const handleSave = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const result = data.get("content") as string;
    fetch("api/files", {
      method: "POST",
      body: JSON.stringify({ filename: "result.json", content: result }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => console.log("File saved:", data));
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  };

  return html`<div class="app-component">
    <div>${observe(dirFiles$)}</div>
    <form @submit=${handleGenerate}>
      <textarea name="prompt" @keydown=${handleEnter}></textarea>
      <menu>
        <button>Generate</button>
      </menu>
    </form>
    <form @submit=${handleRun}>
      <textarea name="script" @keydown=${handleEnter}>${observe(script$)}</textarea>
      <menu>
        <button>Run</button>
      </menu>
    </form>
    <form @submit=${handleSave}>
      <textarea name="content">${observe(result$)}</textarea>
      <menu>
        <button>Save</button>
      </menu>
    </form>
  </div>`;
});

export function useDirFiles$() {
  const fileEvents$ = new Observable<void>((subscriber) => {
    const eventSource = new EventSource("api/files/subscribe");
    eventSource.onmessage = () => subscriber.next();
    eventSource.onerror = (err) => subscriber.error(err);
    return () => eventSource.close();
  });

  return fileEvents$.pipe(
    startWith(void 0),
    switchMap(() => fromFetch("api/files")),
    concatMap((res) => res.json()),
    map(
      (entries) =>
        html`<ul>
          ${litMap(
            entries,
            (entry: string) =>
              html`<li>
                <label> <input type="checkbox" name="files" value="${entry}" /> ${entry} </label>
              </li>`,
          )}
        </ul>`,
    ),
  );
}

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
