import { html, render } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { map } from "rxjs/operators";
import "./app.component.css";
import "./style.css";
import { TerminalComponent } from "./terminal.component";
import { component, observe } from "./ui-kit";
import { useFileList$ } from "./use-file-list";
import { useShell } from "./use-shell";

const AppComponent = component(() => {
  const dirFiles$ = useFileList$();
  const shell = useShell();

  const handleShellSubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const command = (data.get("command") as string)?.trim();
    const pty = data.get("pty") === "on";

    shell.createSession(command || undefined, { pty });

    const textarea = form.querySelector("textarea");
    if (textarea) {
      textarea.value = "";
    }
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).form?.requestSubmit();
    }
  };

  const terminals$ = shell.sessions$.pipe(
    map((sessions) =>
      repeat(
        sessions,
        (session) => session.id,
        (session) => TerminalComponent({ session }),
      ),
    ),
  );

  return html`<div class="app-component">
    <div class="file-list">${observe(dirFiles$)}</div>
    <form @submit=${handleShellSubmit}>
      <label><input type="checkbox" name="pty" checked /> PTY</label>
      <textarea name="command" placeholder="Enter command to start new shell session (Ctrl+Enter)" @keydown=${handleEnter}></textarea>
      <menu>
        <button type="submit">New Session</button>
      </menu>
    </form>
    <div class="terminal-grid">${observe(terminals$)}</div>
  </div>`;
});

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
