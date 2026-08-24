import { html } from "lit";
import { map as litMap } from "lit/directives/map.js";
import { concatMap, map, Observable, startWith, switchMap } from "rxjs";
import { fromFetch } from "rxjs/fetch";

export function useFileList$() {
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
          ${litMap(entries, (entry: string) => html`<li>${entry}</li>`)}
        </ul>`,
    ),
  );
}
