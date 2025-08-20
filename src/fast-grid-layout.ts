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
   * Set of allowed resize handles.
   * Possible values: `'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'`.
   *
   * @default new Set(['e', 'se', 's', 'sw', 'w'])
   */
  resizeHandles?: Set<ResizeHandle>;

  /**
   * Pixel threshold for detecting a resize action
   * when pointer is near an item's edge.
   *
   * @default 10
   */
  resizeThreshold?: number;

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

export type ResizeHandle = 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

export class GridLayout {
  protected container: HTMLElement;
  protected config: GridLayoutConfig;
  protected layout: GridLayoutItem[] = [];
  protected tempLayout?: GridLayoutItem[];

  protected selection = new Set<string>();
  protected resizeHandle?: ResizeHandle;

  protected dragPointerId = 0;
  protected dragStartTime = 0;
  protected dragStartX = 0;
  protected dragStartY = 0;
  protected dragEndX = 0;
  protected dragEndY = 0;
  protected dragKey?: string;
  protected dragging = false;
  protected dragX = 0;
  protected dragY = 0;
  protected preventClick = false;

  protected resizeObserver: ResizeObserver;

  protected renderRequested = false;
  protected layoutFlag = true;
  protected selectionFlag = true;
  protected metaFlag = true;

  protected fn = this.constructor as typeof GridLayout;

  constructor(container: HTMLElement, config: GridLayoutConfig) {
    this.container = container;
    this.config = config;

    this.resizeObserver = new ResizeObserver(() => {
      this.layoutFlag = true;
      this.requestRender();
    });
    this.resizeObserver.observe(this.container);

    this.addEventListeners();
  }

  setConfig(config: GridLayoutConfig) {
    if (this.config === config) return;

    this.config = config;
    this.layout = this.fn.repairLayout(this.layout, this.config);
    this.layoutFlag = true;
    this.selectionFlag = true;
    this.metaFlag = true;
    this.requestRender();
  }

  setLayout(layout: GridLayoutItem[]) {
    if (this.layout === layout) return;

    this.layout = this.fn.repairLayout(layout, this.config);
    this.config.onLayoutChange?.(this.layout);

    this.layoutFlag = true;
    this.requestRender();
  }

  setSelection(selection: Iterable<string>) {
    if (selection === this.selection) return;

    this.selection = new Set(selection);
    this.config.onSelectionChange?.(this.selection);

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

    this.selectionFlag = true;
    this.requestRender();
  }

  clearSelection() {
    if (this.selection.size > 0) {
      this.selection.clear();
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

    if (this.layoutFlag) {
      this.fn.renderLayout(
        this.container,
        this.tempLayout ?? this.layout,
        this.config,
      );
      this.layoutFlag = false;
    }

    if (this.selectionFlag) {
      this.fn.renderSelection(this.container, this.selection);
      this.selectionFlag = false;
    }

    if (this.metaFlag) {
      this.fn.renderMeta(this.container, this.dragging, this.resizeHandle);

      if (this.dragging) {
        const { dx, dy } = this.fn.calculateDrag(
          this.container,
          this.config,
          this.dragStartX,
          this.dragStartY,
          this.dragEndX,
          this.dragEndY,
        );

        if (dx !== this.dragX || dy !== this.dragY) {
          this.dragX = dx;
          this.dragY = dy;

          this.tempLayout = this.fn.dragItems(
            this.layout,
            this.config,
            this.selection,
            dx,
            dy,
            this.resizeHandle,
          );

          this.layoutFlag = true;
        }
      }

      this.metaFlag = false;
    }
  }

  //

  protected handleMouseDown(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    this.dragStartTime = Date.now();
    this.dragStartX = this.dragEndX = e.pageX;
    this.dragStartY = this.dragEndY = e.pageY;

    const element = this.getTargetElement(e);

    if (element) {
      this.resizeHandle = this.fn.checkResizeHandle(
        element,
        this.config,
        e.clientX,
        e.clientY,
      );

      this.dragKey = element.dataset.key;
    }
  }

  protected handleMouseMove(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType !== 'mouse') return;

    this.dragEndX = e.pageX;
    this.dragEndY = e.pageY;
    this.metaFlag = true;
    this.requestRender();

    if (!this.dragKey) {
      const element = this.getTargetElement(e);

      this.resizeHandle = element
        ? this.fn.checkResizeHandle(element, this.config, e.clientX, e.clientY)
        : undefined;
    }

    if (this.dragKey && !this.dragging) {
      this.dragging = true;

      if (!this.selection.has(this.dragKey) || this.resizeHandle) {
        this.setSelection([this.dragKey]);
      }
    }
  }

  protected handleMouseUp(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;

    if (this.tempLayout) {
      this.setLayout(this.tempLayout);
      this.tempLayout = undefined;
    }

    this.resetDrag();
  }

  protected handlePointerDown(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (this.dragPointerId) return;

    this.dragPointerId = e.pointerId;
    this.dragStartTime = Date.now();
    this.dragStartX = this.dragEndX = e.pageX;
    this.dragStartY = this.dragEndY = e.pageY;

    const element = this.getTargetElement(e);

    if (element?.dataset.key && this.selection.has(element.dataset.key)) {
      this.dragging = true;
      this.resizeHandle = this.fn.checkResizeHandle(
        element,
        this.config,
        e.clientX,
        e.clientY,
      );

      this.requestRender();
    }
  }

  protected handlePointerMove(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (e.pointerId !== this.dragPointerId) return;

    this.dragEndX = e.pageX;
    this.dragEndY = e.pageY;
    this.metaFlag = true;

    this.requestRender();
  }

  protected handlePointerUp(e: PointerEvent) {
    if (this.config.editable === false) return;
    if (e.pointerType === 'mouse') return;
    if (e.pointerId !== this.dragPointerId) return;

    if (
      this.dragStartTime >= Date.now() - 250 &&
      abs(this.dragEndX - this.dragStartX) < 10 &&
      abs(this.dragEndY - this.dragStartY) < 10
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
    if (this.config.editable === false) return;

    switch (e.key) {
      case 'Escape':
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
    this.dragX = 0;
    this.dragY = 0;
    this.metaFlag = true;
    this.requestRender();
  }

  protected getTargetElement(e: Event) {
    if (e.target instanceof Element) {
      return e.target.closest<HTMLElement>('.fast-grid-layout > .item');
    }
  }

  //

  disconnect() {
    this.resetDrag();
    this.fn.renderSelection(this.container, new Set());
    this.fn.renderMeta(this.container, false);

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

  static DEFAULT_COLUMNS = 12;
  static DEFAULT_ROW_HEIGHT = 30;
  static DEFAULT_GAP = 0;
  static DEFAULT_RESIZE_HANDLES = new Set(['e', 'se', 's', 'sw', 'w']);
  static DEFAULT_RESIZE_THRESHOLD = 10;

  static renderLayout(
    container: HTMLElement,
    layout: GridLayoutItem[],
    config: GridLayoutConfig,
  ) {
    const {
      columns = this.DEFAULT_COLUMNS,
      gap = this.DEFAULT_GAP,
      columnGap = gap,
      rowGap = gap,
      rowHeight = this.DEFAULT_ROW_HEIGHT,
    } = config;

    const map = new Map<string, GridLayoutItem>();

    for (let i = 0, l = layout.length; i < l; ++i) {
      const item = layout[i];
      map.set(item.i, item);
    }

    container.classList.add('fast-grid-layout');

    const containerWidth = container.offsetWidth;
    const columnWidth = (containerWidth - (columns - 1) * columnGap) / columns;
    const columnWidthAndGap = columnWidth + columnGap;
    const rowHeightAndGap = rowHeight + rowGap;

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

  static renderSelection(container: HTMLElement, selection: Set<string>) {
    for (let i = 0, l = container.children.length; i < l; ++i) {
      const element = container.children[i];

      if (element instanceof HTMLElement) {
        element.classList.toggle(
          '-selected',
          selection.has(element.dataset.key as string),
        );
      }
    }
  }

  static renderMeta(
    container: HTMLElement,
    dragging: boolean,
    resizeHandle?: ResizeHandle,
  ) {
    container.classList.toggle('-moving', dragging && !resizeHandle);
    container.classList.toggle('-resizing', dragging && !!resizeHandle);

    const root = container.ownerDocument.documentElement;

    root.classList.toggle('_hide-selection', dragging);
    root.classList.toggle('_cursor', !!resizeHandle);

    const cursor = this.getResizeCursor(resizeHandle);

    if (root.style.getPropertyValue('--fast-grid-layout-cursor') !== cursor) {
      root.style.setProperty('--fast-grid-layout-cursor', cursor);
    }
  }

  static calculateDrag(
    container: HTMLElement,
    config: GridLayoutConfig,
    dragStartX: number,
    dragStartY: number,
    dragEndX: number,
    dragEndY: number,
  ) {
    const {
      columns = this.DEFAULT_COLUMNS,
      rowHeight = this.DEFAULT_ROW_HEIGHT,
      gap = this.DEFAULT_GAP,
      columnGap = gap,
      rowGap = gap,
    } = config;

    const containerWidth = container.offsetWidth;
    const columnWidth = (containerWidth - (columns - 1) * columnGap) / columns;
    const dx = round((dragEndX - dragStartX) / (columnWidth + columnGap));
    const dy = round((dragEndY - dragStartY) / (rowHeight + rowGap));

    return { dx, dy };
  }

  static checkResizeHandle(
    element: Element,
    config: GridLayoutConfig,
    clientX: number,
    clientY: number,
  ): ResizeHandle | undefined {
    const {
      resizeHandles = this.DEFAULT_RESIZE_HANDLES,
      resizeThreshold = this.DEFAULT_RESIZE_THRESHOLD,
    } = config;

    const rect = element.getBoundingClientRect();
    const n = clientY - rect.top < resizeThreshold;
    const e = rect.right - clientX < resizeThreshold;
    const s = rect.bottom - clientY < resizeThreshold;
    const w = clientX - rect.left < resizeThreshold;

    let r: ResizeHandle | undefined;

    if (s) {
      if (e) {
        r = 'se';
      } else if (w) {
        r = 'sw';
      } else {
        r = 's';
      }
    } else if (e) {
      if (n) {
        r = 'ne';
      } else {
        r = 'e';
      }
    } else if (w) {
      if (n) {
        r = 'nw';
      } else {
        r = 'w';
      }
    } else if (n) {
      r = 'n';
    }

    if (r && resizeHandles.has(r)) {
      return r;
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
   * Move or resize specified item(s) (in grid units).
   * Returns a new layout if modified.
   */
  static dragItems(
    layout: GridLayoutItem[],
    config: GridLayoutConfig,
    selection: Set<string>,
    dx: number,
    dy: number,
    resizeHandle?: ResizeHandle,
  ) {
    if (resizeHandle) {
      for (const key of selection) {
        return this.resizeItem(layout, config, key, resizeHandle, dx, dy);
      }

      return layout;
    }

    return this.moveItems(layout, config, selection, dx, dy);
  }

  /**
   * Moves the specified layout (in grid units).
   * Returns a new layout if modified.
   */
  static moveItems(
    layout: GridLayoutItem[],
    config: GridLayoutConfig,
    selection: Set<string>,
    dx: number,
    dy: number,
  ) {
    if ((dx === 0 && dy === 0) || selection.size === 0) {
      return layout;
    }

    let out = layout;

    for (let i = 0, l = layout.length; i < l; ++i) {
      const item = layout[i];

      if (selection.has(item.i)) {
        const x = item.x + dx;
        const y = item.y + dy;

        if (item.x !== x || item.y !== y) {
          if (out === layout) {
            // Copy on write.
            out = layout.slice(0);
          }

          out[i] = { ...item, x, y };
        }
      }
    }

    if (out === layout) {
      return layout;
    }

    return this.repairLayout(out, config, this.compareMidpoint);
  }

  /**
   * Resizes the specified item (in grid units).
   * Returns a new layout if modified.
   */
  static resizeItem(
    layout: GridLayoutItem[],
    config: GridLayoutConfig,
    key: string,
    handle: ResizeHandle,
    dx: number,
    dy: number,
  ) {
    if (dx === 0 && dy === 0) {
      return layout;
    }

    const index = layout.findIndex((it) => it.i === key);

    if (index < 0) {
      return layout;
    }

    const item = layout[index];

    const { columns = this.DEFAULT_COLUMNS } = config;
    const { maxW = columns, maxH = Infinity } = item;
    let { x, y, w, h } = item;
    const xw = x + w;
    const yh = y + h;
    const cx = columns - x;

    switch (handle) {
      case 'n':
        h = clamp(h - dy, 1, maxH);
        y = clamp(y + dy, 0, yh - 1);
        break;
      case 'e':
        w = clamp(w + dx, 1, min(maxW, cx));
        break;
      case 's':
        h = clamp(h + dy, 1, maxH);
        break;
      case 'w':
        w = clamp(w - dx, 1, min(maxW, xw));
        x = clamp(x + dx, 0, xw - 1);
        break;
      case 'ne':
        w = clamp(w + dx, 1, min(maxW, cx));
        h = clamp(h - dy, 1, maxH);
        y = clamp(y + dy, 0, yh - 1);
        break;
      case 'se':
        w = clamp(w + dx, 1, min(maxW, cx));
        h = clamp(h + dy, 1, maxH);
        break;
      case 'sw':
        w = clamp(w - dx, 1, min(maxW, xw));
        h = clamp(h + dy, 1, maxH);
        x = clamp(x + dx, 0, xw - 1);
        break;
      case 'nw':
        w = clamp(w - dx, 1, min(maxW, xw));
        h = clamp(h - dy, 1, maxH);
        x = clamp(x + dx, 0, xw - 1);
        y = clamp(y + dy, 0, yh - 1);
        break;
    }

    if (item.x === x && item.y === y && item.w === w && item.h === h) {
      return layout;
    }

    // Copy on write.
    const out = layout.slice(0);
    out[index] = { ...item, x, y, w, h };

    return this.repairLayout(out, config);
  }

  /**
   * Fixes overlaps, gaps, and layout out of bounds.
   * Returns a new layout if there was anything to repair.
   */
  static repairLayout(
    layout: GridLayoutItem[],
    config: GridLayoutConfig,
    compare = this.compareTopLeft,
  ) {
    const { columns = this.DEFAULT_COLUMNS } = config;

    // "Rising tide", i.e. number of blocked cells per column.
    const tide: number[] = Array(columns);

    for (let x = 0; x < columns; ++x) {
      tide[x] = 0;
    }

    const sortedItems = layout.slice(0).sort(compare);
    const staticItems = sortedItems.filter((item) => item.static);
    const numStatics = staticItems.length;
    let modified = false;
    let staticOffset = 0;

    for (let i = 0, l = sortedItems.length; i < l; i++) {
      // Note that we allow layout to be out of bounds during sorting,
      // which (for example) allows moving layout "before" the first item.
      // We fix any out of bound issues here.
      let item = this.repairItem(sortedItems[i], config);
      const x2 = item.x + item.w;

      if (item.static) {
        // This static item will be part of the tide
        // and does not need to be considered for collision anymore.
        // Since static layout will be visited in the same order
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

        // Handle collision with static layout.
        for (let j = staticOffset; j < numStatics; ++j) {
          const staticItem = staticItems[j];

          if (staticItem.y >= yNext + item.h) {
            // Following static layout cannot collide because of sorting; stop.
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
            // need to recheck collision with other static layout.
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
   * Repair bounds of the given grid layout item to fit the given config.
   * Returns a new item if there was anything to repair.
   */
  static repairItem(item: GridLayoutItem, config: GridLayoutConfig) {
    const { columns = this.DEFAULT_COLUMNS } = config;
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

  /**
   * Compare layout by midpoint (row-first).
   */
  static compareMidpoint(a: GridLayoutItem, b: GridLayoutItem) {
    // Compare by midpoint
    const au = a.x + a.w / 2;
    const av = a.y + a.h / 2;
    const bu = b.x + b.w / 2;
    const bv = b.y + b.h / 2;

    if (av < bv) return -1;
    if (av > bv) return 1;
    if (au < bu) return -1;
    if (au > bu) return 1;

    return 0;
  }

  /**
   * Compare by top left corner (row-first).
   */
  static compareTopLeft(a: GridLayoutItem, b: GridLayoutItem) {
    if (a.y < b.y) return -1;
    if (a.y > b.y) return 1;
    if (a.x < b.x) return -1;
    if (a.x > b.x) return 1;

    return 0;
  }
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
