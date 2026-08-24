import { BehaviorSubject, Subject } from "rxjs";

export interface ShellOptions {
  pty?: boolean;
  cols?: number;
  rows?: number;
}

export interface ShellSession {
  id: string;
  title: string;
  stream$: Subject<string>;
  output$: Subject<string>;
  isRunning$: BehaviorSubject<boolean>;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
}

export interface ShellManager {
  sessions$: BehaviorSubject<ShellSession[]>;
  createSession: (command?: string, options?: ShellOptions) => ShellSession;
  closeSession: (id: string) => void;
}

export function useShell(): ShellManager {
  const sessions$ = new BehaviorSubject<ShellSession[]>([]);

  const closeSession = (id: string) => {
    const currentSessions = sessions$.value;
    const session = currentSessions.find((s) => s.id === id);
    if (session) {
      session.close();
    }
  };

  const createSession = (command?: string, options?: ShellOptions): ShellSession => {
    const id = Math.random().toString(36).substring(2, 9);
    const stream$ = new Subject<string>();
    const output$ = new Subject<string>();
    const isRunning$ = new BehaviorSubject<boolean>(true);
    let activeEventSource: EventSource | null = null;
    let accumulatedOutput = "";
    let isClosed = false;

    const removeSelf = () => {
      if (isClosed) return;
      isClosed = true;
      isRunning$.next(false);
      const updated = sessions$.value.filter((s) => s.id !== id);
      sessions$.next(updated);
    };

    const close = () => {
      if (isClosed) return;
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      fetch("api/shell/cancel", {
        method: "POST",
        body: JSON.stringify({ id }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      removeSelf();
    };

    const sendInput = (data: string) => {
      if (isClosed) return;
      fetch("api/shell/input", {
        method: "POST",
        body: JSON.stringify({ id, data }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };

    const resize = (cols: number, rows: number) => {
      if (isClosed) return;
      fetch("api/shell/resize", {
        method: "POST",
        body: JSON.stringify({ id, cols, rows }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };

    const url = new URL("api/shell/subscribe", window.location.href);
    url.searchParams.set("id", id);
    if (command) {
      url.searchParams.set("command", command);
    }
    if (options?.pty !== undefined) {
      url.searchParams.set("pty", String(options.pty));
    }
    if (options?.cols) {
      url.searchParams.set("cols", String(options.cols));
    }
    if (options?.rows) {
      url.searchParams.set("rows", String(options.rows));
    }

    const eventSource = new EventSource(url.toString());
    activeEventSource = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "stdout" || msg.type === "stderr") {
          stream$.next(msg.text);
          accumulatedOutput += msg.text;
          output$.next(accumulatedOutput);
        } else if (msg.type === "exit") {
          eventSource.close();
          activeEventSource = null;
          removeSelf();
        }
      } catch (error) {
        console.error("Error parsing shell SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      activeEventSource = null;
      removeSelf();
    };

    const title = command ? `Shell (${command.slice(0, 25)}${command.length > 25 ? "..." : ""})` : `Shell (${id})`;

    const session: ShellSession = {
      id,
      title,
      stream$,
      output$,
      isRunning$,
      sendInput,
      resize,
      close,
    };

    sessions$.next([...sessions$.value, session]);
    return session;
  };

  // Automatically open initial persistent shell session on load
  createSession();

  return {
    sessions$,
    createSession,
    closeSession,
  };
}
