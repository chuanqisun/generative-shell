import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import "./terminal.component.css";
import { component } from "./ui-kit";
import type { ShellSession } from "./use-shell";

export const TerminalComponent = component((props: { session: ShellSession }) => {
  let term: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let streamSub: { unsubscribe: () => void } | null = null;

  const handleTerminalRef = (container: Element | undefined) => {
    if (!container) {
      if (streamSub) {
        streamSub.unsubscribe();
        streamSub = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (term) {
        term.dispose();
        term = null;
      }
      return;
    }

    if ((container as any)._term) return;

    term = new Terminal({
      rows: 24,
      cols: 80,
      convertEol: true,
      cursorBlink: true,
    });
    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container as HTMLElement);
    fitAddon.fit();

    (container as any)._term = term;

    term.onData((data) => {
      props.session.sendInput(data);
    });

    term.onResize(({ cols, rows }) => {
      props.session.resize(cols, rows);
    });

    resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon?.fit();
      } catch (err) {
        console.error("Fit error:", err);
      }
    });
    resizeObserver.observe(container);

    streamSub = props.session.stream$.subscribe((data) => {
      term?.write(data);
    });
  };

  const handleClose = () => {
    props.session.close();
  };

  return html`<div class="terminal-component">
    <header>
      <span class="title">${props.session.title}</span>
      <button type="button" @click=${handleClose}>Close</button>
    </header>
    <div class="terminal-container" ${ref(handleTerminalRef)}></div>
  </div>`;
});
