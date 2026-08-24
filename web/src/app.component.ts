import { html, render } from "lit";
import "./app.component.css";
import "./style.css";
import { component, observe } from "./ui-kit";
import { useFileList$ } from "./use-file-list";
import { useShell } from "./use-shell";

const AppComponent = component(() => {
  const dirFiles$ = useFileList$();
  const shell = useShell();

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
    <div class="file-list">${observe(dirFiles$)}</div>
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
