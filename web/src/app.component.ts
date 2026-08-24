import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { html, render } from "lit";
import { ref } from "lit/directives/ref.js";
import "./app.component.css";
import "./style.css";
import { component, observe } from "./ui-kit";
import { useFileList$ } from "./use-file-list";
import { useShell } from "./use-shell";

const AppComponent = component(() => {
  const dirFiles$ = useFileList$();
  const shell = useShell();

  const handleTerminalRef = (container: Element | undefined) => {
    if (!container || (container as any)._term) return;

    const term = new Terminal({
      rows: 24,
      cols: 80,
      convertEol: true,
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container as HTMLElement);
    fitAddon.fit();
    (container as any)._term = term;
    (container as any)._fitAddon = fitAddon;

    term.onData((data) => {
      shell.sendInput(data);
    });

    term.onResize(({ cols, rows }) => {
      shell.resize(cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (err) {
        console.error("Fit error:", err);
      }
    });
    resizeObserver.observe(container);

    shell.stream$.subscribe((data) => {
      term.write(data);
    });
  };

  const handleShell = (event: Event) => {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const command = data.get("command") as string;
    const pty = data.get("pty") === "on";
    const term = (document.querySelector(".terminal-container") as any)?._term;
    const cols = term ? term.cols : 80;
    const rows = term ? term.rows : 24;
    if (command) {
      shell.execute(command, { pty, cols, rows });
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
      <label><input type="checkbox" name="pty" /> PTY</label>
      <textarea name="command" @keydown=${handleEnter}></textarea>
      <menu>
        <button type="submit">Execute</button>
        ${observe(shell.isRunning$) ? html`<button type="button" @click=${handleCancelShell}>Cancel</button>` : ""}
      </menu>
    </form>
    <div class="terminal-container" ${ref(handleTerminalRef)}></div>
  </div>`;
});

render(AppComponent(), document.querySelector<HTMLDivElement>("#app")!);
