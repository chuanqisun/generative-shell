import { BehaviorSubject, Subject } from "rxjs";

export interface ShellOptions {
  pty?: boolean;
}

export interface ShellRunner {
  stream$: Subject<string>;
  output$: Subject<string>;
  isRunning$: BehaviorSubject<boolean>;
  execute: (command: string, options?: ShellOptions) => void;
  cancel: () => void;
}

export function useShell(): ShellRunner {
  const stream$ = new Subject<string>();
  const output$ = new Subject<string>();
  const isRunning$ = new BehaviorSubject<boolean>(false);
  let activeEventSource: EventSource | null = null;
  let activeId: string | null = null;
  let accumulatedOutput = "";

  const cancel = () => {
    if (activeId) {
      const idToCancel = activeId;
      fetch("api/shell/cancel", {
        method: "POST",
        body: JSON.stringify({ id: idToCancel }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
      activeId = null;
      isRunning$.next(false);
      const cancelMsg = "\r\n[command cancelled]\r\n";
      accumulatedOutput += cancelMsg;
      stream$.next(cancelMsg);
      output$.next(accumulatedOutput);
    }
  };

  const execute = (command: string, options?: ShellOptions) => {
    if (activeEventSource) {
      cancel();
    }

    const id = Math.random().toString(36).substring(2);
    activeId = id;
    isRunning$.next(true);

    accumulatedOutput = "";
    stream$.next("\x1bc"); // Send ANSI reset clear screen signal
    output$.next("");

    const url = new URL("api/shell/subscribe", window.location.href);
    url.searchParams.set("command", command);
    url.searchParams.set("id", id);
    if (options?.pty) {
      url.searchParams.set("pty", "true");
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
          if (activeEventSource === eventSource) {
            activeEventSource = null;
            activeId = null;
            isRunning$.next(false);
          }
        }
      } catch (error) {
        console.error("Error parsing shell SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (activeEventSource === eventSource) {
        activeEventSource = null;
        activeId = null;
        isRunning$.next(false);
      }
    };
  };

  return {
    stream$,
    output$,
    isRunning$,
    execute,
    cancel,
  };
}
