# Fast Grid Layout

Fast editable grid layout system similar to
[React Grid Layout](https://github.com/react-grid-layout/react-grid-layout).
Performant even at **hundreds of items**. Vanilla/framework-agnostic.

- Multi-item drag and drop
- Resizing by dragging border
- Robust, deterministic manipulation (less accidents)
- Touch support (tap to select, then manipulate)
- Data format compatible with
  [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout).

## Installation

With npm:

```sh
npm install fast-grid-layout
```

Via CDN:

```html
<link
  href="https://cdn.jsdelivr.net/npm/fast-grid-layout@0.1/dist/fast-grid-layout.min.css"
  rel="stylesheet"
/>
<script type="module">
  import { GridLayout } from 'https://cdn.jsdelivr.net/npm/fast-grid-layout@0.1/dist/fast-grid-layout.min.js';
</script>
```

## Usage

Include, copy, and/or customize the [CSS](./dist/fast-grid-layout.css) |
[SCSS](./src/fast-grid-layout.scss) |
[minified CSS](./dist/fast-grid-layout.min.css).

### Vanilla

```html
<div id="#layout">
  <div data-key="a">A</div>
  <div data-key="b">B</div>
  <div data-key="c">C</div>
</div>

<script type="module">
  import { GridLayout } from 'https://cdn.jsdelivr.net/npm/fast-grid-layout@0.1/dist/fast-grid-layout.min.js';

  const container = document.getElementById('layout');

  const config = {
    columns: 12,
    rowHeight: 40,
    gap: 10,
  };

  // Format compatible with React Grid Layout.
  const layout = [
    { x: 0, y: 0, w: 3, h: 3, i: 'a' },
    { x: 3, y: 0, w: 6, h: 3, i: 'b' },
    { x: 3, y: 3, w: 3, h: 2, i: 'c' },
  ];

  const gridLayout = new GridLayout(container, config);
  gridLayout.setLayout(layout);
</script>
```

### React

You'll need a thin wrapper component, for example:

```js
import { useEffect, useRef } from 'react';
import { GridLayout as GridLayoutController } from 'fast-grid-layout';

function GridLayout({ config, layout, onLayoutChange, children }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const controller = new GridLayoutController(containerRef.current, config);
    controllerRef.current = controller;

    return () => controller.disconnect();
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;

    if (!controller) return;

    controller.setConfig({ ...config, onLayoutChange });
    controller.setLayout(layout);
  }, [config, layout, onLayoutChange, children]);

  return <div ref={containerRef}>{children}</div>;
}
```

The component can be used like this (note the extra `data-key`):

```js
function App() {
  const config = {
    columns: 12,
    rowHeight: 40,
    gap: 10,
  };

  // Format compatible with React Grid Layout.
  const layout = [
    { x: 0, y: 0, w: 3, h: 3, i: 'a' },
    { x: 3, y: 0, w: 6, h: 3, i: 'b' },
    { x: 3, y: 3, w: 3, h: 2, i: 'c' },
  ];

  return (
    <div>
      <h1>Fast Grid Layout (React)</h1>
      <GridLayout config={config} layout={layout}>
        {layout.map((item) => (
          <div key={item.i} data-key={item.i}>
            {item.i.toUpperCase()}
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
```

## Configuration

```ts
export interface GridLayoutConfig {
  /**
   * Number of columns in the grid.
   *
   * @default 12
   */
  columns?: number;

  /**
   * Height of each row in pixels.
   *
   * @default 30
   */
  rowHeight?: number;

  /**
   * Default gap between grid cells (applies to both rows and columns if no overrides are given).
   *
   * @default 0
   */
  gap?: number;

  /**
   * Horizontal gap between grid columns in pixels.
   * Overrides `gap` if specified.
   *
   * @default gap
   */
  columnGap?: number;

  /**
   * Vertical gap between grid rows in pixels.
   * Overrides `gap` if specified.
   *
   * @default gap
   */
  rowGap?: number;

  /**
   * Callback triggered when the layout changes
   * (e.g. after drag/resize or external update).
   */
  onLayoutChange?: (layout: GridLayoutItem[]) => void;

  /**
   * Callback triggered when the selection changes
   * (e.g. user clicks or toggles item selection).
   */
  onSelectionChange?: (selection: Set<string>) => void;

  /**
   * Is the layout editable?
   *
   * @default true
   */
  editable?: boolean;
}
```

## TODO

- Placeholders
- Responsive breakpoints
