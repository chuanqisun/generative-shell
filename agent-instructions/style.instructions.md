---
applyTo: "web/**/*.css"
---

# Style Guide

- Use css custom variables to capture color, spacing, and parameter that could be reused.
- The best css code is no css. Use browser default html/css features until you have to implement your own. If you have to implement your own, keep it basic like an MVP. We will fine tune polish later.
- Space efficient. This is a full screen app. Areas should individually handle their scroll/overflow behavior.
- Avoid shadows.
- Modern CSS, allow nesting
- Global styles is reserved for minimum amount of resets/normalize
- Component should have their own [name].component.css, and imported by the [name].component.ts like this `import "./component.css"`.
- The root element of the component should generally have a class that matches the name of the component so in the css, all the rules can be nested under `.component-name { ... }` to prevent collision.
- The main entry point for global styles is `src/style.css`, which imports detailed styles from `src/styles/*.css`.
