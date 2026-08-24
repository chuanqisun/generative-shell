import { html, render } from "lit";
import { Subject } from "rxjs";
import "./app.component.css";
import "./style.css";
import { component, observe } from "./ui-kit";
import { useFileList$ } from "./use-file-list";
import { useShell } from "./use-shell";

const AppComponent = component(() => {
  const dirFiles$ = useFileList$("files");
  const script$ = new Subject<string>();
  const result$ = new Subject<string>();
  const shell = useShell();

  const handleGenerate = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);

    const selectedFiles = data.getAll("files") as string[];

    const payload = {
      files: selectedFiles,
      prompt: data.get("prompt"),
    };

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

  const handleShell = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const command = data.get("command") as string;
    if (command) {
      shell.execute(command);
    }
  };

  const handleCancelShell = (event: Event) => {
    event.preventDefault();
    shell.cancel();
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  };

  return html`<div class="app-component">
    <form @submit=${handleGenerate}>
      <div>${observe(dirFiles$)}</div>
      <textarea name="prompt" @keydown=${handleEnter}></textarea>
      <menu>
        <button>Generate</button>
      </menu>
    </form>
    <form @submit=${handleRun}>
      <textarea name="script" @keydown=${handleEnter} .value=${observe(script$)}></textarea>
      <menu>
        <button>Run</button>
      </menu>
    </form>
    <form @submit=${handleSave}>
      <textarea name="content" .value=${observe(result$)}></textarea>
      <menu>
        <button>Save</button>
      </menu>
    </form>
    <form @submit=${handleShell}>
      <textarea name="command" @keydown=${handleEnter}></textarea>
      <menu>
        <button type="submit">Execute</button>
        ${observe(shell.isRunning$) ? html`<button type="button" @click=${handleCancelShell}>Cancel</button>` : ""}
      </menu>
    </form>
    <div class="output">${observe(shell.output$)}</div>
  </div>`;
});

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
