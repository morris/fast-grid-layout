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
   * Responsive breakpoint configs.
   */
  breakpoints?: { [name: string]: GridLayoutBreakpoint };
}

export interface GridLayoutBreakpoint
  extends Omit<GridLayoutConfig, 'breakpoints'> {
  /**
   * Maximum container width for this breakpoint.
   */
  maxWidth: number;
}

export type LayoutChangeCallback = (
  layout: GridLayoutItem[],
  breakpoint: string,
) => void;

export type SelectionChangeCallback = (selection: Set<string>) => void;

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

/**
 * @protected
 */
export interface GridLayoutCompiledBreakpoint {
  name: string;
  maxWidth: number;
  columns: number;
  rowHeight: number;
  columnGap: number;
  rowGap: number;
}

/**
 * @protected
 */
export type ResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

export class GridLayout {
  protected container: HTMLElement;
  protected containerWidth: number;
  protected breakpoints: GridLayoutCompiledBreakpoint[];
  protected layouts = new Map<string, GridLayoutItem[]>(); // Mapped by breakpoint name.

  protected editable = false;
  protected layoutChangeCallback: LayoutChangeCallback = () => {};
  protected selectionChangeCallback: SelectionChangeCallback = () => {};

  protected selection = new Set<string>();
  protected resizeHandle?: ResizeHandle;
  protected tempLayout?: GridLayoutItem[];

  protected dragPointerId = 0;
  protected dragStartTime = 0;
  protected dragStartX = 0;
  protected dragStartY = 0;
  protected dragEndX = 0;
  protected dragEndY = 0;
  protected dragKey?: string;
  protected dragging = false;
  protected preventClick = false;

  protected lastDeltaX = 0;
  protected lastDeltaY = 0;

  protected resizeObserver: ResizeObserver;

  protected renderRequested = false;
  protected layoutFlag = true;
  protected selectionFlag = true;
  protected metaFlag = true;

  protected fn = this.constructor as typeof GridLayout;

  constructor(container: HTMLElement, config: GridLayoutConfig) {
    this.container = container;
    this.containerWidth = container.offsetWidth;
    this.breakpoints = this.fn.compileBreakpoints(config);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.addEventListeners();
  }

  getBreakpoint(name?: string) {
    const breakpoints = this.breakpoints;

    if (name) {
      const breakpoint = breakpoints.find((it) => it.name === name);

      if (breakpoint) return breakpoint;
    }

    return breakpoints.find(
      (it) => it.maxWidth >= this.containerWidth,
    ) as GridLayoutCompiledBreakpoint;
  }

  setConfig(config: GridLayoutConfig) {
    this.breakpoints = this.fn.compileBreakpoints(config);

    for (const [name, layout] of this.layouts) {
      const breakpoint = this.getBreakpoint(name);
      const repaired = this.fn.repairLayout(layout, breakpoint.columns);

      if (repaired !== layout) {
        this.layouts.set(
          name,
          this.fn.repairLayout(layout, breakpoint.columns),
        );
        this.layoutChangeCallback(layout, breakpoint.name);
      }
    }

    this.layoutFlag = true;
    this.selectionFlag = true;
    this.metaFlag = true;
    this.requestRender();
  }

  setEditable(editable: boolean) {
    this.editable = editable;

    this.selectionFlag = true;
    this.metaFlag = true;
    this.requestRender();
  }

  onLayoutChange(callback: LayoutChangeCallback) {
    this.layoutChangeCallback = callback;
  }

  onSelectionChange(callback: SelectionChangeCallback) {
    this.selectionChangeCallback = callback;
  }

  setLayout(layout: GridLayoutItem[], breakpoint?: string) {
    const b = this.getBreakpoint(breakpoint);
    const before = this.layouts.get(b.name);

    if (layout === before) return;

    this.layouts.set(b.name, this.fn.repairLayout(layout, b.columns));
    this.layoutChangeCallback(layout, b.name);

    // Auto-generate missing layouts.
    for (const b2 of this.breakpoints) {
      if (!this.layouts.has(b2.name)) {
        this.layouts.set(b2.name, this.fn.repairLayout(layout, b2.columns));
        this.layoutChangeCallback(layout, b2.name);
      }
    }

    this.layoutFlag = true;
    this.requestRender();
  }

  setSelection(selection: Set<string>) {
    if (setsAreEqual(selection, this.selection)) return;

    this.selection = selection;
    this.selectionChangeCallback(this.selection);

    this.selectionFlag = true;
    this.requestRender();
  }

  toggleSelection(key: string, exclusive = false) {
    if (this.selection.has(key)) {
      this.selection.delete(key);
    } else {
      if (exclusive) {
        this.selection.clear();
      }

      this.selection.add(key);
    }

    this.selectionChangeCallback(this.selection);

    this.selectionFlag = true;
    this.requestRender();
  }

  clearSelection() {
    if (this.selection.size > 0) {
      this.selection.clear();
      this.selectionChangeCallback(this.selection);

      this.selectionFlag = true;
      this.requestRender();
    }
  }

  //

  requestRender() {
    if (!this.renderRequested) {
      this.renderRequested = true;
      requestAnimationFrame(() => this.render());
    }
  }

  render() {
    this.renderRequested = false;

    const breakpoint = this.getBreakpoint();
    const layout = this.layouts.get(breakpoint.name) ?? [];

    if (this.dragging) {
      const dragX = this.dragEndX - this.dragStartX;
      const dragY = this.dragEndY - this.dragStartY;

      const columnWidth = this.fn.getColumnWidth(
        this.containerWidth,
        breakpoint.columns,
        breakpoint.columnGap,
      );
      const columnWidthAndGap = columnWidth + breakpoint.columnGap;
      const rowHeightAndGap = breakpoint.rowHeight + breakpoint.rowGap;

      const deltaX = round(dragX / columnWidthAndGap);
      const deltaY = round(dragY / rowHeightAndGap);

      if (deltaX !== this.lastDeltaX || deltaY !== this.lastDeltaY) {
        this.lastDeltaX = deltaX;
        this.lastDeltaY = deltaY;

        if (this.resizeHandle) {
          this.tempLayout = this.fn.resizeItems(
            layout,
            breakpoint.columns,
            this.selection,
            deltaX,
            deltaY,
            this.resizeHandle,
          );
        } else {
          this.tempLayout = this.fn.moveItems(
            layout,
            breakpoint.columns,
            this.selection,
            deltaX,
            deltaY,
          );
        }

        this.layoutFlag = true;
      }
    }

    if (this.layoutFlag) {
      this.fn.renderLayout(
        this.container,
        this.tempLayout ?? layout,
        breakpoint,
      );
      this.layoutFlag = false;
    }

    if (this.selectionFlag) {
      this.renderSelection();
      this.selectionFlag = false;
    }

    if (this.metaFlag) {
      this.renderMeta();
      this.metaFlag = false;
    }
  }

  protected renderSelection() {
    const children = this.container.children;

    for (let i = 0, l = children.length; i < l; ++i) {
      const element = children[i];

      if (element instanceof HTMLElement) {
        element.classList.toggle(
          '-selected',
          this.selection.has(element.dataset.key as string),
        );
      }
    }
  }

  protected renderMeta() {
    const { container, editable, dragging, resizeHandle } = this;

    container.classList.toggle('-editable', editable);
    container.classList.toggle('-moving', dragging && !resizeHandle);
    container.classList.toggle('-resizing', dragging && !!resizeHandle);

    const root = container.ownerDocument.documentElement;

    root.classList.toggle('_hide-selection', dragging);
    root.classList.toggle('_force-cursor', !!resizeHandle);

    const cursor = this.fn.getResizeCursor(resizeHandle);

    if (root.style.getPropertyValue('--force-cursor') !== cursor) {
      root.style.setProperty('--force-cursor', cursor);
    }
  }

  //

  protected handleResize() {
    this.containerWidth = this.container.offsetWidth;

    this.layoutFlag = true;
    this.requestRender();
  }

  protected handleMouseDown(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    this.dragStartTime = Date.now();
    this.dragStartX = this.dragEndX = e.pageX;
    this.dragStartY = this.dragEndY = e.pageY;

    const element = this.getTargetElement(e);

    if (element) {
      this.resizeHandle = this.checkResizeHandle(element, e);
      this.dragKey = element.dataset.key;
    }
  }

  protected handleMouseMove(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType !== 'mouse') return;

    this.dragEndX = e.pageX;
    this.dragEndY = e.pageY;
    this.metaFlag = true;
    this.requestRender();

    if (!this.dragKey) {
      const element = this.getTargetElement(e);

      this.resizeHandle = element
        ? this.checkResizeHandle(element, e)
        : undefined;
    }

    if (
      !this.dragging &&
      this.dragKey &&
      (abs(this.dragEndX - this.dragStartX) > this.fn.DRAG_THRESHOLD ||
        abs(this.dragEndY - this.dragStartY) > this.fn.DRAG_THRESHOLD)
    ) {
      this.dragging = true;

      if (!this.selection.has(this.dragKey) || this.resizeHandle) {
        this.setSelection(new Set(this.dragKey));
      }
    }
  }

  protected handleMouseUp(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    if (this.tempLayout) {
      this.setLayout(this.tempLayout);
      this.tempLayout = undefined;
    }

    this.resetDrag();
  }

  protected handlePointerDown(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (this.dragPointerId) return;

    this.dragPointerId = e.pointerId;
    this.dragStartTime = Date.now();
    this.dragStartX = this.dragEndX = e.pageX;
    this.dragStartY = this.dragEndY = e.pageY;

    const element = this.getTargetElement(e);

    if (element?.dataset.key && this.selection.has(element.dataset.key)) {
      this.dragging = true;
      this.resizeHandle = this.checkResizeHandle(element, e);

      this.requestRender();
    }
  }

  protected handlePointerMove(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (e.pointerId !== this.dragPointerId) return;

    this.dragEndX = e.pageX;
    this.dragEndY = e.pageY;
    this.metaFlag = true;

    this.requestRender();
  }

  protected handlePointerUp(e: PointerEvent) {
    if (this.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (e.pointerId !== this.dragPointerId) return;

    if (
      this.dragStartTime > Date.now() - this.fn.TAP_DELAY &&
      abs(this.dragEndX - this.dragStartX) < this.fn.TAP_THRESHOLD &&
      abs(this.dragEndY - this.dragStartY) < this.fn.TAP_THRESHOLD
    ) {
      // It's a tap.
      const element = this.getTargetElement(e);

      if (element?.dataset.key) {
        this.toggleSelection(element.dataset.key, true);
      } else {
        this.clearSelection();
      }
    } else if (this.tempLayout) {
      this.setLayout(this.tempLayout);
      this.tempLayout = undefined;
    }

    this.resetDrag();
  }

  protected handleClick(e: MouseEvent) {
    if (this.editable === false) return;

    if (this.preventClick) {
      this.preventClick = false;

      e.preventDefault();
      e.stopImmediatePropagation();
    } else {
      if (!e.ctrlKey && !e.metaKey) {
        this.clearSelection();
      }

      const element = this.getTargetElement(e);

      if (element?.dataset.key) {
        this.toggleSelection(element.dataset.key);
      }
    }
  }

  protected handleKeyUp(e: KeyboardEvent) {
    if (this.editable === false) return;

    switch (e.key) {
      case 'Escape':
        this.tempLayout = undefined;
        this.layoutFlag = true;
        this.clearSelection();
        this.resetDrag();
        break;
    }
  }

  protected resetDrag() {
    if (this.dragging) {
      try {
        const selection = (document.defaultView || window).getSelection();

        if (selection && selection.type !== 'Caret') {
          selection.removeAllRanges();
        }
      } catch {
        // ignore
      }

      this.preventClick = true;
    }

    this.dragPointerId = 0;
    this.dragging = false;
    this.dragKey = undefined;
    this.resizeHandle = undefined;
    this.lastDeltaX = 0;
    this.lastDeltaY = 0;
    this.metaFlag = true;
    this.requestRender();
  }

  protected getTargetElement(e: Event) {
    if (e.target instanceof Element) {
      const item = e.target.closest<HTMLElement>('.fast-grid-layout > .item');

      if (item) {
        if (item.classList.contains('-static')) return;
        if (item.classList.contains('-selected')) return item;

        const content = e.target.closest<HTMLElement>(
          '.fast-grid-layout .content, button, input, textarea, select',
        );

        if (!content) return item;
      }
    }
  }

  checkResizeHandle(element: HTMLElement, event: PointerEvent) {
    const handle = this.fn.checkResizeHandle(
      element.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      this.fn.RESIZE_THRESHOLD,
    );

    switch (handle) {
      case 'n':
      case 'ne':
      case 'nw':
        // Disable north handles for now, as it feels unnatural.
        // TODO make configurable?
        return;
      default:
        return handle;
    }
  }

  //

  disconnect() {
    this.selection = new Set();
    this.resetDrag();
    this.renderSelection();
    this.renderMeta();

    this.resizeObserver.unobserve(this.container);
    this.removeEventListeners();
  }

  protected _handleMouseDown = this.handleMouseDown.bind(this);
  protected _handleMouseMove = this.handleMouseMove.bind(this);
  protected _handleMouseUp = this.handleMouseUp.bind(this);

  protected _handlePointerDown = this.handlePointerDown.bind(this);
  protected _handlePointerMove = this.handlePointerMove.bind(this);
  protected _handlePointerUp = this.handlePointerUp.bind(this);

  protected _handleClick = this.handleClick.bind(this);
  protected _handleKeyUp = this.handleKeyUp.bind(this);

  protected addEventListeners() {
    this.container.addEventListener('pointerdown', this._handleMouseDown);
    window.addEventListener('pointermove', this._handleMouseMove, PASSIVE);
    window.addEventListener('pointerup', this._handleMouseUp);
    window.addEventListener('pointercancel', this._handleMouseUp);

    this.container.addEventListener('pointerdown', this._handlePointerDown);
    window.addEventListener('pointermove', this._handlePointerMove, PASSIVE);
    window.addEventListener('pointerup', this._handlePointerUp);
    window.addEventListener('pointercancel', this._handlePointerUp);

    window.addEventListener('click', this._handleClick, CAPTURE);
    window.addEventListener('keyup', this._handleKeyUp);
  }

  protected removeEventListeners() {
    this.container.removeEventListener('pointerdown', this._handleMouseDown);
    window.removeEventListener('pointermove', this._handleMouseMove);
    window.removeEventListener('pointerup', this._handleMouseUp);
    window.removeEventListener('pointercancel', this._handleMouseUp);

    this.container.removeEventListener('pointerdown', this._handlePointerDown);
    window.removeEventListener('pointermove', this._handlePointerMove);
    window.removeEventListener('pointerup', this._handlePointerUp);
    window.removeEventListener('pointercancel', this._handlePointerUp);

    window.removeEventListener('click', this._handleClick, CAPTURE);
    window.removeEventListener('keyup', this._handleKeyUp);
  }

  //

  static RESIZE_THRESHOLD = 10;
  static TAP_DELAY = 250;
  static TAP_THRESHOLD = 10;
  static DRAG_THRESHOLD = 7;

  static compileBreakpoints(
    config: GridLayoutConfig,
  ): GridLayoutCompiledBreakpoint[] {
    const defaultColumns = 12;
    const defaultRowHeight = 30;

    const breakpoints = Object.entries(config.breakpoints ?? {})
      .map(([name, b]) => {
        return {
          name,
          maxWidth: b.maxWidth,
          columns: b.columns ?? config.columns ?? defaultColumns,
          rowHeight: b.rowHeight ?? config.rowHeight ?? defaultRowHeight,
          rowGap: b.rowGap ?? b.gap ?? config.rowGap ?? config.gap ?? 0,
          columnGap:
            b.columnGap ?? b.gap ?? config.columnGap ?? config.gap ?? 0,
        };
      })
      .sort((a, b) => a.maxWidth - b.maxWidth);

    breakpoints.push({
      name: 'default',
      maxWidth: Infinity,
      columns: config.columns ?? defaultColumns,
      rowHeight: config.rowHeight ?? defaultRowHeight,
      rowGap: config.rowGap ?? config.gap ?? 0,
      columnGap: config.columnGap ?? config.gap ?? 0,
    });

    return breakpoints;
  }

  static renderLayout(
    container: HTMLElement,
    layout: GridLayoutItem[],
    config: GridLayoutCompiledBreakpoint,
  ) {
    const { columns, columnGap, rowGap, rowHeight } = config;

    const containerWidth = container.offsetWidth;
    const columnWidth = this.getColumnWidth(containerWidth, columns, columnGap);
    const columnWidthAndGap = columnWidth + columnGap;
    const rowHeightAndGap = rowHeight + rowGap;

    container.classList.add('fast-grid-layout');

    const map = new Map<string, GridLayoutItem>();

    for (let i = 0, l = layout.length; i < l; ++i) {
      const item = layout[i];
      map.set(item.i, item);
    }

    let hMax = 0;

    for (let i = 0, l = container.children.length; i < l; ++i) {
      const element = container.children[i];

      if (!(element instanceof HTMLElement)) {
        // TODO warning?
        continue;
      }

      if (!element.dataset.key) {
        element.dataset.key = i.toString();
      }

      const key = element.dataset.key;
      const item = map.get(key);

      if (!item) {
        // TODO warning?
        continue;
      }

      element.classList.add('item');
      element.classList.toggle('-dynamic', !item.static);
      element.classList.toggle('-static', !!item.static);

      const h = item.y + item.h;

      if (h > hMax) {
        hMax = h;
      }

      const width = round(item.w * columnWidthAndGap - columnGap) + 'px';
      const height = round(item.h * rowHeightAndGap - rowGap) + 'px';
      const transform =
        'translate(' +
        round(item.x * columnWidthAndGap) +
        'px, ' +
        round(item.y * rowHeightAndGap) +
        'px)';

      if (element.style.width !== width) {
        element.style.width = width;
      }

      if (element.style.height !== height) {
        element.style.height = height;
      }

      if (element.style.transform !== transform) {
        element.style.transform = transform;
      }
    }

    const containerHeight = round(hMax * rowHeightAndGap - rowGap) + 'px';

    if (container.style.height !== containerHeight) {
      container.style.height = containerHeight;
    }
  }

  static getColumnWidth(
    containerWidth: number,
    columns: number,
    columnGap: number,
  ) {
    return (containerWidth - (columns - 1) * columnGap) / columns;
  }

  static checkResizeHandle(
    clientRect: DOMRect,
    clientX: number,
    clientY: number,
    threshold: number,
  ): ResizeHandle | undefined {
    const n = clientY - clientRect.top < threshold;
    const e = clientRect.right - clientX < threshold;
    const s = clientRect.bottom - clientY < threshold;
    const w = clientX - clientRect.left < threshold;

    if (s) {
      if (e) {
        return 'se';
      } else if (w) {
        return 'sw';
      } else {
        return 's';
      }
    } else if (e) {
      if (n) {
        return 'ne';
      } else {
        return 'e';
      }
    } else if (w) {
      if (n) {
        return 'nw';
      } else {
        return 'w';
      }
    } else if (n) {
      return 'n';
    }
  }

  static getResizeCursor(resizeHandle: ResizeHandle | undefined) {
    switch (resizeHandle) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'se':
      case 'nw':
        return 'nwse-resize';
      default:
        return '';
    }
  }

  /**
   * Moves the specified items (in grid units).
   * Returns a new layout if modified.
   */
  static moveItems(
    layout: GridLayoutItem[],
    columns: number,
    selection: Set<string>,
    deltaX: number,
    deltaY: number,
  ) {
    if ((deltaX === 0 && deltaY === 0) || selection.size === 0) {
      return layout;
    }

    let out = layout;

    for (let i = 0, l = layout.length; i < l; ++i) {
      const item = layout[i];

      if (selection.has(item.i)) {
        const x = item.x + deltaX;
        const y = item.y + deltaY;

        if (item.x !== x || item.y !== y) {
          if (out === layout) {
            // Copy on write.
            out = layout.slice(0);
          }

          out[i] = { ...item, x, y };
        }
      }
    }

    if (out === layout) return layout;

    return this.repairLayout(out, columns, selection);
  }

  /**
   * Resizes the specified item (in grid units).
   * Returns a new layout if modified.
   */
  static resizeItems(
    layout: GridLayoutItem[],
    columns: number,
    selection: Set<string>,
    deltaX: number,
    deltaY: number,
    handle: ResizeHandle,
  ) {
    if ((deltaX === 0 && deltaY === 0) || selection.size === 0) {
      return layout;
    }

    let out = layout;

    for (let i = 0, l = layout.length; i < l; ++i) {
      const item = layout[i];

      if (selection.has(item.i)) {
        const { maxW = columns, maxH = Infinity } = item;
        let { x, y, w, h } = item;
        const xw = x + w;
        const yh = y + h;
        const cx = columns - x;

        switch (handle) {
          case 'n':
            h = clamp(h - deltaY, 1, maxH);
            y = clamp(y + deltaY, 0, yh - 1);
            break;
          case 'e':
            w = clamp(w + deltaX, 1, min(maxW, cx));
            break;
          case 's':
            h = clamp(h + deltaY, 1, maxH);
            break;
          case 'w':
            w = clamp(w - deltaX, 1, min(maxW, xw));
            x = clamp(x + deltaX, 0, xw - 1);
            break;
          case 'ne':
            w = clamp(w + deltaX, 1, min(maxW, cx));
            h = clamp(h - deltaY, 1, maxH);
            y = clamp(y + deltaY, 0, yh - 1);
            break;
          case 'se':
            w = clamp(w + deltaX, 1, min(maxW, cx));
            h = clamp(h + deltaY, 1, maxH);
            break;
          case 'sw':
            w = clamp(w - deltaX, 1, min(maxW, xw));
            h = clamp(h + deltaY, 1, maxH);
            x = clamp(x + deltaX, 0, xw - 1);
            break;
          case 'nw':
            w = clamp(w - deltaX, 1, min(maxW, xw));
            h = clamp(h - deltaY, 1, maxH);
            x = clamp(x + deltaX, 0, xw - 1);
            y = clamp(y + deltaY, 0, yh - 1);
            break;
        }

        if (item.x !== x || item.y !== y || item.w !== w || item.h !== h) {
          if (out === layout) {
            // Copy on write.
            out = layout.slice(0);
          }

          out[i] = { ...item, x, y, w, h };
        }
      }
    }

    if (out === layout) return layout;

    return this.repairLayout(out, columns, selection);
  }

  /**
   * Fixes overlaps, gaps, and layout out of bounds.
   * Returns a new layout if there was anything to repair.
   */
  static repairLayout(
    layout: GridLayoutItem[],
    columns: number,
    selection?: Set<string>,
  ) {
    // Sort by row first, selection second (if any), column third.
    // TODO Considering overlap when selected might yield even better behavior?
    const sortedItems = layout.slice(0).sort((a, b) => {
      if (a.y < b.y) return -1;
      if (a.y > b.y) return 1;

      if (selection) {
        if (selection.has(a.i)) {
          if (!selection.has(b.i)) {
            return -1;
          }
        } else if (selection.has(b.i)) {
          return 1;
        }
      }

      if (a.x < b.x) return -1;
      if (a.x > b.x) return 1;

      return 0;
    });

    const staticItems = sortedItems.filter((item) => item.static);
    const numStatics = staticItems.length;
    let modified = false;
    let staticOffset = 0;

    // "Rising tide", i.e. number of blocked cells per column.
    const tide: number[] = Array(columns);

    for (let x = 0; x < columns; ++x) {
      tide[x] = 0;
    }

    for (let i = 0, l = sortedItems.length; i < l; i++) {
      // Note that we allow items to be out of bounds during sorting,
      // which (for example) allows moving items "before" the first item.
      // We fix any out of bound issues here.
      let item = this.repairItem(sortedItems[i], columns);
      const x2 = item.x + item.w;

      if (item.static) {
        // This static item will be part of the tide
        // and does not need to be considered for collision anymore.
        // Since static item will be visited in the same order
        // as the staticItems array, we can just increment the offset here.
        ++staticOffset;
      } else {
        // Detect smallest gap/largest overlap with tide.
        let minGap = Infinity;

        for (let x = item.x; x < x2; ++x) {
          const gap = item.y - tide[x];

          if (gap < minGap) {
            minGap = gap;
          }
        }

        // Fix smallest gap/largest overlap.
        let yNext = item.y - minGap;

        // Handle collision with static items.
        for (let j = staticOffset; j < numStatics; ++j) {
          const staticItem = staticItems[j];

          if (staticItem.y >= yNext + item.h) {
            // Following static items cannot collide because of sorting; stop.
            break;
          }

          if (
            //staticItem.y < yNext + item.h && // This is implied above.
            staticItem.y + staticItem.h > yNext &&
            staticItem.x < item.x + item.w &&
            staticItem.x + staticItem.w > item.x
          ) {
            // Collision detected; move current item below static item.
            yNext = staticItem.y + staticItem.h;

            // Current item was moved;
            // need to recheck collision with other static items.
            j = staticOffset;
          }
        }

        if (item.y !== yNext) {
          item = { ...item, y: yNext };
        }

        if (item !== sortedItems[i]) {
          sortedItems[i] = item;
          modified = true;
        }
      }

      // Update tide.
      const t = item.y + item.h;

      for (let x = item.x; x < x2; ++x) {
        if (tide[x] < t) {
          tide[x] = t;
        }
      }
    }

    return modified ? sortedItems : layout;
  }

  /**
   * Repair bounds of the given item to fit the given config.
   * Returns a new item if there was anything to repair.
   */
  static repairItem(item: GridLayoutItem, columns: number) {
    const { minW = 1, maxW = columns, minH = 1, maxH = Infinity } = item;
    let { x, y, w, h } = item;

    w = clamp(w, minW, min(maxW, columns));
    h = clamp(h, minH, maxH);
    x = clamp(x, 0, columns - w);
    if (y < 0) y = 0;

    if (item.x === x && item.y === y && item.w === w && item.h === h) {
      return item;
    }

    return { ...item, x, y, w, h };
  }
}

function setsAreEqual<T>(a: Set<T>, b: Set<T>) {
  if (a === b) return true;
  if (a.size !== b.size) return false;

  for (const a_ of a) {
    if (!b.has(a_)) return false;
  }

  return true;
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const abs = Math.abs;
const min = Math.min;
const round = Math.round;

const CAPTURE = { capture: true };
const PASSIVE = { passive: true };
