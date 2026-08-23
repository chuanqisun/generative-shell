---
applyTo: "web/**/*.ts"
---

- We embrace pure functional style but also use component architecture for rxjs/lit/DOM
- The top level app.component.ts should stay on the high level. Low level details should be pushed into self contained components or functions
- Generally we want a single top level export or main function per file. If we have to bundle multiple things, organize in this order
  - imports, exports
  - constants, parameters
  - main functions
  - low level pure functions/utils/helps.
