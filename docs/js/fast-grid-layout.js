export class GridLayout {
    constructor(container, config) {
        this.layouts = new Map(); // Mapped by breakpoint key.
        this.breakpoint = { key: '', minWidth: 0 };
        this.selection = new Set();
        this.dragPointerId = 0;
        this.dragStartTime = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragEndX = 0;
        this.dragEndY = 0;
        this.dragging = false;
        this.preventClick = false;
        this.lastDeltaX = 0;
        this.lastDeltaY = 0;
        this.renderRequested = false;
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.fn = this.constructor;
        this._handleMouseDown = this.handleMouseDown.bind(this);
        this._handleMouseMove = this.handleMouseMove.bind(this);
        this._handleMouseUp = this.handleMouseUp.bind(this);
        this._handlePointerDown = this.handlePointerDown.bind(this);
        this._handlePointerMove = this.handlePointerMove.bind(this);
        this._handlePointerUp = this.handlePointerUp.bind(this);
        this._handleClick = this.handleClick.bind(this);
        this._handleKeyUp = this.handleKeyUp.bind(this);
        this.container = container;
        this.config = config;
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
        this.addEventListeners();
    }
    getColumns(breakpoint) {
        var _a, _b;
        return (_b = (_a = this.getBreakpoint(breakpoint).columns) !== null && _a !== void 0 ? _a : this.config.columns) !== null && _b !== void 0 ? _b : 12;
    }
    getLayout(breakpoint) {
        var _a;
        return (_a = this.layouts.get(this.getBreakpoint(breakpoint).key)) !== null && _a !== void 0 ? _a : [];
    }
    getBreakpoint(breakpoint) {
        var _a;
        if (breakpoint) {
            const b = (_a = this.config.breakpoints) === null || _a === void 0 ? void 0 : _a.find((b) => b.key === breakpoint);
            if (b)
                return b;
        }
        return this.breakpoint;
    }
    setConfig(config) {
        if (this.config === config)
            return;
        this.config = config;
        for (const [key, layout] of this.layouts) {
            this.layouts.set(key, this.fn.repairLayout(layout, this.getColumns()));
        }
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.requestRender();
    }
    setLayout(layout, breakpoint) {
        var _a, _b, _c, _d;
        const key = breakpoint !== null && breakpoint !== void 0 ? breakpoint : this.breakpoint.key;
        const before = this.layouts.get(key);
        if (layout === before)
            return;
        this.layouts.set(key, this.fn.repairLayout(layout, this.getColumns(key)));
        (_b = (_a = this.config).onLayoutChange) === null || _b === void 0 ? void 0 : _b.call(_a, layout, key);
        const breakpoints = this.config.breakpoints;
        if (breakpoints) {
            for (const breakpoint of breakpoints) {
                if (!this.layouts.has(breakpoint.key)) {
                    this.layouts.set(breakpoint.key, this.fn.repairLayout(layout, this.getColumns(breakpoint.key)));
                    (_d = (_c = this.config).onLayoutChange) === null || _d === void 0 ? void 0 : _d.call(_c, layout, breakpoint.key);
                }
            }
        }
        this.layoutFlag = true;
        this.requestRender();
    }
    setSelection(selection) {
        var _a, _b;
        if (selection === this.selection)
            return;
        this.selection = new Set(selection);
        (_b = (_a = this.config).onSelectionChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.selection);
        this.selectionFlag = true;
        this.requestRender();
    }
    toggleSelection(key, exclusive = false) {
        if (this.selection.has(key)) {
            this.selection.delete(key);
        }
        else {
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
        var _a;
        this.renderRequested = false;
        const dimensions = Object.assign(Object.assign({}, this.config), this.breakpoint);
        if (this.layoutFlag) {
            this.fn.renderLayout(this.container, (_a = this.tempLayout) !== null && _a !== void 0 ? _a : this.getLayout(), dimensions);
            this.layoutFlag = false;
        }
        if (this.selectionFlag) {
            this.fn.renderSelection(this.container, this.selection);
            this.selectionFlag = false;
        }
        if (this.metaFlag) {
            this.fn.renderMeta(this.container, this.dragging, this.resizeHandle);
            if (this.dragging) {
                const { dx, dy } = this.fn.calculateDrag(this.container, dimensions, this.dragStartX, this.dragStartY, this.dragEndX, this.dragEndY);
                if (dx !== this.lastDeltaX || dy !== this.lastDeltaY) {
                    this.lastDeltaX = dx;
                    this.lastDeltaY = dy;
                    if (this.resizeHandle) {
                        this.tempLayout = this.fn.resizeItems(this.getLayout(), this.getColumns(), this.selection, dx, dy, this.resizeHandle);
                    }
                    else {
                        this.tempLayout = this.fn.moveItems(this.getLayout(), this.getColumns(), this.selection, dx, dy);
                    }
                    this.layoutFlag = true;
                }
            }
            this.metaFlag = false;
        }
    }
    //
    handleResize() {
        const breakpoints = this.config.breakpoints;
        if (breakpoints && breakpoints.length > 0) {
            const containerWidth = this.container.offsetWidth;
            let next;
            for (const candidate of breakpoints) {
                if (!next ||
                    (candidate.minWidth <= containerWidth &&
                        candidate.minWidth > next.minWidth)) {
                    next = candidate;
                }
            }
            this.breakpoint = next;
        }
        console.log(this.breakpoint);
        this.layoutFlag = true;
        this.requestRender();
    }
    handleMouseDown(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType !== 'mouse' || e.button !== 0)
            return;
        this.dragStartTime = Date.now();
        this.dragStartX = this.dragEndX = e.pageX;
        this.dragStartY = this.dragEndY = e.pageY;
        const element = this.getTargetElement(e);
        if (element) {
            this.resizeHandle = this.checkResizeHandle(element, e);
            this.dragKey = element.dataset.key;
        }
    }
    handleMouseMove(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType !== 'mouse')
            return;
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
        if (!this.dragging &&
            this.dragKey &&
            (abs(this.dragEndX - this.dragStartX) > this.fn.DRAG_THRESHOLD ||
                abs(this.dragEndY - this.dragStartY) > this.fn.DRAG_THRESHOLD)) {
            this.dragging = true;
            if (!this.selection.has(this.dragKey) || this.resizeHandle) {
                this.setSelection([this.dragKey]);
            }
        }
    }
    handleMouseUp(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType !== 'mouse' || e.button !== 0)
            return;
        if (this.tempLayout) {
            this.setLayout(this.tempLayout);
            this.tempLayout = undefined;
        }
        this.resetDrag();
    }
    handlePointerDown(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType === 'mouse')
            return;
        if (this.dragPointerId)
            return;
        this.dragPointerId = e.pointerId;
        this.dragStartTime = Date.now();
        this.dragStartX = this.dragEndX = e.pageX;
        this.dragStartY = this.dragEndY = e.pageY;
        const element = this.getTargetElement(e);
        if ((element === null || element === void 0 ? void 0 : element.dataset.key) && this.selection.has(element.dataset.key)) {
            this.dragging = true;
            this.resizeHandle = this.checkResizeHandle(element, e);
            this.requestRender();
        }
    }
    handlePointerMove(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType === 'mouse')
            return;
        if (e.pointerId !== this.dragPointerId)
            return;
        this.dragEndX = e.pageX;
        this.dragEndY = e.pageY;
        this.metaFlag = true;
        this.requestRender();
    }
    handlePointerUp(e) {
        if (this.config.editable === false)
            return;
        if (e.pointerType === 'mouse')
            return;
        if (e.pointerId !== this.dragPointerId)
            return;
        if (this.dragStartTime > Date.now() - this.fn.TAP_DELAY &&
            abs(this.dragEndX - this.dragStartX) < this.fn.TAP_THRESHOLD &&
            abs(this.dragEndY - this.dragStartY) < this.fn.TAP_THRESHOLD) {
            // It's a tap.
            const element = this.getTargetElement(e);
            if (element === null || element === void 0 ? void 0 : element.dataset.key) {
                this.toggleSelection(element.dataset.key, true);
            }
            else {
                this.clearSelection();
            }
        }
        else if (this.tempLayout) {
            this.setLayout(this.tempLayout);
            this.tempLayout = undefined;
        }
        this.resetDrag();
    }
    handleClick(e) {
        if (this.preventClick) {
            this.preventClick = false;
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        else {
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection();
            }
            const element = this.getTargetElement(e);
            if (element === null || element === void 0 ? void 0 : element.dataset.key) {
                this.toggleSelection(element.dataset.key);
            }
        }
    }
    handleKeyUp(e) {
        if (this.config.editable === false)
            return;
        switch (e.key) {
            case 'Escape':
                this.tempLayout = undefined;
                this.layoutFlag = true;
                this.clearSelection();
                this.resetDrag();
                break;
        }
    }
    resetDrag() {
        if (this.dragging) {
            try {
                const selection = (document.defaultView || window).getSelection();
                if (selection && selection.type !== 'Caret') {
                    selection.removeAllRanges();
                }
            }
            catch (_a) {
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
    getTargetElement(e) {
        if (e.target instanceof Element) {
            const item = e.target.closest('.fast-grid-layout > .item');
            if (item) {
                if (item.classList.contains('-static'))
                    return;
                if (item.classList.contains('-selected'))
                    return item;
                const content = e.target.closest('.fast-grid-layout .content, button, input, textarea, select');
                if (!content)
                    return item;
            }
        }
    }
    checkResizeHandle(element, event) {
        const handle = this.fn.checkResizeHandle(element.getBoundingClientRect(), event.clientX, event.clientY, this.fn.RESIZE_THRESHOLD);
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
        this.resetDrag();
        this.fn.renderSelection(this.container, new Set());
        this.fn.renderMeta(this.container, false);
        this.resizeObserver.unobserve(this.container);
        this.removeEventListeners();
    }
    addEventListeners() {
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
    removeEventListeners() {
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
    static renderLayout(container, layout, config) {
        const { columns = this.DEFAULT_COLUMNS, gap = this.DEFAULT_GAP, columnGap = gap, rowGap = gap, rowHeight = this.DEFAULT_ROW_HEIGHT, } = config;
        const containerWidth = container.offsetWidth;
        const columnWidth = (containerWidth - (columns - 1) * columnGap) / columns;
        const columnWidthAndGap = columnWidth + columnGap;
        const rowHeightAndGap = rowHeight + rowGap;
        container.classList.add('fast-grid-layout');
        const map = new Map();
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
            const transform = 'translate(' +
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
    static renderSelection(container, selection) {
        for (let i = 0, l = container.children.length; i < l; ++i) {
            const element = container.children[i];
            if (element instanceof HTMLElement) {
                element.classList.toggle('-selected', selection.has(element.dataset.key));
            }
        }
    }
    static renderMeta(container, dragging, resizeHandle) {
        container.classList.toggle('-moving', dragging && !resizeHandle);
        container.classList.toggle('-resizing', dragging && !!resizeHandle);
        const root = container.ownerDocument.documentElement;
        root.classList.toggle('_hide-selection', dragging);
        root.classList.toggle('_force-cursor', !!resizeHandle);
        const cursor = this.getResizeCursor(resizeHandle);
        if (root.style.getPropertyValue('--force-cursor') !== cursor) {
            root.style.setProperty('--force-cursor', cursor);
        }
    }
    static calculateDrag(container, config, dragStartX, dragStartY, dragEndX, dragEndY) {
        const { columns = this.DEFAULT_COLUMNS, rowHeight = this.DEFAULT_ROW_HEIGHT, gap = this.DEFAULT_GAP, columnGap = gap, rowGap = gap, } = config;
        const containerWidth = container.offsetWidth;
        const columnWidth = (containerWidth - (columns - 1) * columnGap) / columns;
        const dx = round((dragEndX - dragStartX) / (columnWidth + columnGap));
        const dy = round((dragEndY - dragStartY) / (rowHeight + rowGap));
        return { dx, dy };
    }
    static checkResizeHandle(clientRect, clientX, clientY, threshold) {
        const n = clientY - clientRect.top < threshold;
        const e = clientRect.right - clientX < threshold;
        const s = clientRect.bottom - clientY < threshold;
        const w = clientX - clientRect.left < threshold;
        if (s) {
            if (e) {
                return 'se';
            }
            else if (w) {
                return 'sw';
            }
            else {
                return 's';
            }
        }
        else if (e) {
            if (n) {
                return 'ne';
            }
            else {
                return 'e';
            }
        }
        else if (w) {
            if (n) {
                return 'nw';
            }
            else {
                return 'w';
            }
        }
        else if (n) {
            return 'n';
        }
    }
    static getResizeCursor(resizeHandle) {
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
    static moveItems(layout, columns, selection, dx, dy) {
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
                    out[i] = Object.assign(Object.assign({}, item), { x, y });
                }
            }
        }
        if (out === layout) {
            return layout;
        }
        return this.repairLayout(out, columns, selection);
    }
    /**
     * Resizes the specified item (in grid units).
     * Returns a new layout if modified.
     */
    static resizeItems(layout, columns, selection, dx, dy, handle) {
        if (dx === 0 && dy === 0) {
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
                if (item.x !== x || item.y !== y || item.w !== w || item.h !== h) {
                    if (out === layout) {
                        // Copy on write.
                        out = layout.slice(0);
                    }
                    out[i] = Object.assign(Object.assign({}, item), { x, y, w, h });
                }
            }
        }
        return this.repairLayout(out, columns, selection);
    }
    /**
     * Fixes overlaps, gaps, and layout out of bounds.
     * Returns a new layout if there was anything to repair.
     */
    static repairLayout(layout, columns, selection) {
        // Sort by row first, selection second (if any), column third.
        const sortedItems = layout.slice(0).sort((a, b) => {
            if (a.y < b.y)
                return -1;
            if (a.y > b.y)
                return 1;
            if (selection) {
                if (selection.has(a.i)) {
                    if (!selection.has(b.i)) {
                        return -1;
                    }
                }
                else if (selection.has(b.i)) {
                    return 1;
                }
            }
            if (a.x < b.x)
                return -1;
            if (a.x > b.x)
                return 1;
            return 0;
        });
        const staticItems = sortedItems.filter((item) => item.static);
        const numStatics = staticItems.length;
        let modified = false;
        let staticOffset = 0;
        // "Rising tide", i.e. number of blocked cells per column.
        const tide = Array(columns);
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
            }
            else {
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
                        staticItem.x + staticItem.w > item.x) {
                        // Collision detected; move current item below static item.
                        yNext = staticItem.y + staticItem.h;
                        // Current item was moved;
                        // need to recheck collision with other static items.
                        j = staticOffset;
                    }
                }
                if (item.y !== yNext) {
                    item = Object.assign(Object.assign({}, item), { y: yNext });
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
    static repairItem(item, columns) {
        const { minW = 1, maxW = columns, minH = 1, maxH = Infinity } = item;
        let { x, y, w, h } = item;
        w = clamp(w, minW, min(maxW, columns));
        h = clamp(h, minH, maxH);
        x = clamp(x, 0, columns - w);
        if (y < 0)
            y = 0;
        if (item.x === x && item.y === y && item.w === w && item.h === h) {
            return item;
        }
        return Object.assign(Object.assign({}, item), { x, y, w, h });
    }
}
//
GridLayout.DEFAULT_COLUMNS = 12;
GridLayout.DEFAULT_ROW_HEIGHT = 30;
GridLayout.DEFAULT_GAP = 0;
GridLayout.RESIZE_THRESHOLD = 10;
GridLayout.TAP_DELAY = 250;
GridLayout.TAP_THRESHOLD = 10;
GridLayout.DRAG_THRESHOLD = 7;
function clamp(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
const abs = Math.abs;
const min = Math.min;
const round = Math.round;
const CAPTURE = { capture: true };
const PASSIVE = { passive: true };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTRGQSxNQUFNLE9BQU8sVUFBVTtJQWdDckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBN0JsRCxZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUMsQ0FBQyw0QkFBNEI7UUFDM0UsZUFBVSxHQUF5QixFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBRTVELGNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBSTlCLGtCQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLGtCQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUNiLGFBQVEsR0FBRyxDQUFDLENBQUM7UUFFYixhQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ2pCLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBRXJCLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBSWYsb0JBQWUsR0FBRyxLQUFLLENBQUM7UUFDeEIsZUFBVSxHQUFHLElBQUksQ0FBQztRQUNsQixrQkFBYSxHQUFHLElBQUksQ0FBQztRQUNyQixhQUFRLEdBQUcsSUFBSSxDQUFDO1FBRWhCLE9BQUUsR0FBRyxJQUFJLENBQUMsV0FBZ0MsQ0FBQztRQThhM0MscUJBQWdCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkQscUJBQWdCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkQsbUJBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvQyx1QkFBa0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELHVCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQscUJBQWdCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFbkQsaUJBQVksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyxpQkFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBcGJuRCxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUMzQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUVyQixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU1QyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRUQsVUFBVSxDQUFDLFVBQW1COztRQUM1QixPQUFPLE1BQUEsTUFBQSxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sbUNBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLG1DQUFJLEVBQUUsQ0FBQztJQUM3RSxDQUFDO0lBRUQsU0FBUyxDQUFDLFVBQW1COztRQUMzQixPQUFPLE1BQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsbUNBQUksRUFBRSxDQUFDO0lBQ3BFLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBbUI7O1FBQy9CLElBQUksVUFBVSxFQUFFLENBQUM7WUFDZixNQUFNLENBQUMsR0FBRyxNQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVywwQ0FBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssVUFBVSxDQUFDLENBQUM7WUFFckUsSUFBSSxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUVELFNBQVMsQ0FBQyxNQUF3QjtRQUNoQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssTUFBTTtZQUFFLE9BQU87UUFFbkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1FBQzFCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRUQsU0FBUyxDQUFDLE1BQXdCLEVBQUUsVUFBbUI7O1FBQ3JELE1BQU0sR0FBRyxHQUFHLFVBQVUsYUFBVixVQUFVLGNBQVYsVUFBVSxHQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQzlDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLElBQUksTUFBTSxLQUFLLE1BQU07WUFBRSxPQUFPO1FBRTlCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUUsTUFBQSxNQUFBLElBQUksQ0FBQyxNQUFNLEVBQUMsY0FBYyxtREFBRyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFMUMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7UUFFNUMsSUFBSSxXQUFXLEVBQUUsQ0FBQztZQUNoQixLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3RDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUNkLFVBQVUsQ0FBQyxHQUFHLEVBQ2QsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQzlELENBQUM7b0JBQ0YsTUFBQSxNQUFBLElBQUksQ0FBQyxNQUFNLEVBQUMsY0FBYyxtREFBRyxNQUFNLEVBQUUsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztRQUN2QixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVELFlBQVksQ0FBQyxTQUEyQjs7UUFDdEMsSUFBSSxTQUFTLEtBQUssSUFBSSxDQUFDLFNBQVM7WUFBRSxPQUFPO1FBRXpDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEMsTUFBQSxNQUFBLElBQUksQ0FBQyxNQUFNLEVBQUMsaUJBQWlCLG1EQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVoRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVELGVBQWUsQ0FBQyxHQUFXLEVBQUUsU0FBUyxHQUFHLEtBQUs7UUFDNUMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3pCLENBQUM7WUFFRCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQixDQUFDO1FBRUQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7UUFDMUIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxjQUFjO1FBQ1osSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1lBQzFCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN2QixDQUFDO0lBQ0gsQ0FBQztJQUVELEVBQUU7SUFFRixhQUFhO1FBQ1gsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztZQUM1QixxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU07O1FBQ0osSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFLLENBQUM7UUFFN0IsTUFBTSxVQUFVLG1DQUNYLElBQUksQ0FBQyxNQUFNLEdBQ1gsSUFBSSxDQUFDLFVBQVUsQ0FDbkIsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUNsQixJQUFJLENBQUMsU0FBUyxFQUNkLE1BQUEsSUFBSSxDQUFDLFVBQVUsbUNBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUNuQyxVQUFVLENBQ1gsQ0FBQztZQUNGLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQzFCLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztRQUM3QixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVyRSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGFBQWEsQ0FDdEMsSUFBSSxDQUFDLFNBQVMsRUFDZCxVQUFVLEVBQ1YsSUFBSSxDQUFDLFVBQVUsRUFDZixJQUFJLENBQUMsVUFBVSxFQUNmLElBQUksQ0FBQyxRQUFRLEVBQ2IsSUFBSSxDQUFDLFFBQVEsQ0FDZCxDQUFDO2dCQUVGLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxVQUFVLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDckQsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7b0JBQ3JCLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDO29CQUVyQixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQzt3QkFDdEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FDbkMsSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUNoQixJQUFJLENBQUMsVUFBVSxFQUFFLEVBQ2pCLElBQUksQ0FBQyxTQUFTLEVBQ2QsRUFBRSxFQUNGLEVBQUUsRUFDRixJQUFJLENBQUMsWUFBWSxDQUNsQixDQUFDO29CQUNKLENBQUM7eUJBQU0sQ0FBQzt3QkFDTixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUNqQyxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQ2hCLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFDakIsSUFBSSxDQUFDLFNBQVMsRUFDZCxFQUFFLEVBQ0YsRUFBRSxDQUNILENBQUM7b0JBQ0osQ0FBQztvQkFFRCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDekIsQ0FBQztZQUNILENBQUM7WUFFRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUN4QixDQUFDO0lBQ0gsQ0FBQztJQUVELEVBQUU7SUFFUSxZQUFZO1FBQ3BCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1FBRTVDLElBQUksV0FBVyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDMUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7WUFDbEQsSUFBSSxJQUFzQyxDQUFDO1lBRTNDLEtBQUssTUFBTSxTQUFTLElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ3BDLElBQ0UsQ0FBQyxJQUFJO29CQUNMLENBQUMsU0FBUyxDQUFDLFFBQVEsSUFBSSxjQUFjO3dCQUNuQyxTQUFTLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsRUFDckMsQ0FBQztvQkFDRCxJQUFJLEdBQUcsU0FBUyxDQUFDO2dCQUNuQixDQUFDO1lBQ0gsQ0FBQztZQUVELElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBNEIsQ0FBQztRQUNqRCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFN0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7UUFDdkIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFUyxlQUFlLENBQUMsQ0FBZTtRQUN2QyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFLLEtBQUs7WUFBRSxPQUFPO1FBQzNDLElBQUksQ0FBQyxDQUFDLFdBQVcsS0FBSyxPQUFPLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTztRQUV4RCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUMxQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUUxQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFekMsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN2RCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQ3JDLENBQUM7SUFDSCxDQUFDO0lBRVMsZUFBZSxDQUFDLENBQWU7UUFDdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxLQUFLO1lBQUUsT0FBTztRQUMzQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssT0FBTztZQUFFLE9BQU87UUFFdEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFckIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekMsSUFBSSxDQUFDLFlBQVksR0FBRyxPQUFPO2dCQUN6QixDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDaEIsQ0FBQztRQUVELElBQ0UsQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUNkLElBQUksQ0FBQyxPQUFPO1lBQ1osQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjO2dCQUM1RCxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsRUFDaEUsQ0FBQztZQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1lBRXJCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUMzRCxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDcEMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVMsYUFBYSxDQUFDLENBQWU7UUFDckMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxLQUFLO1lBQUUsT0FBTztRQUMzQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssT0FBTyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU87UUFFeEQsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDaEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDOUIsQ0FBQztRQUVELElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNuQixDQUFDO0lBRVMsaUJBQWlCLENBQUMsQ0FBZTtRQUN6QyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxLQUFLLEtBQUs7WUFBRSxPQUFPO1FBQzNDLElBQUksQ0FBQyxDQUFDLFdBQVcsS0FBSyxPQUFPO1lBQUUsT0FBTztRQUN0QyxJQUFJLElBQUksQ0FBQyxhQUFhO1lBQUUsT0FBTztRQUUvQixJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDakMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDMUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFMUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXpDLElBQUksQ0FBQSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsT0FBTyxDQUFDLEdBQUcsS0FBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDcEUsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDckIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRXZELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN2QixDQUFDO0lBQ0gsQ0FBQztJQUVTLGlCQUFpQixDQUFDLENBQWU7UUFDekMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxLQUFLO1lBQUUsT0FBTztRQUMzQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssT0FBTztZQUFFLE9BQU87UUFDdEMsSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxhQUFhO1lBQUUsT0FBTztRQUUvQyxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBRXJCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRVMsZUFBZSxDQUFDLENBQWU7UUFDdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsS0FBSyxLQUFLO1lBQUUsT0FBTztRQUMzQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssT0FBTztZQUFFLE9BQU87UUFDdEMsSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxhQUFhO1lBQUUsT0FBTztRQUUvQyxJQUNFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUztZQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxhQUFhO1lBQzVELEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFDNUQsQ0FBQztZQUNELGNBQWM7WUFDZCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELENBQUM7aUJBQU0sQ0FBQztnQkFDTixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDeEIsQ0FBQztRQUNILENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUM5QixDQUFDO1FBRUQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ25CLENBQUM7SUFFUyxXQUFXLENBQUMsQ0FBYTtRQUNqQyxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN0QixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztZQUUxQixDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDbkIsQ0FBQyxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDL0IsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3hCLENBQUM7WUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekMsSUFBSSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRVMsV0FBVyxDQUFDLENBQWdCO1FBQ3BDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEtBQUssS0FBSztZQUFFLE9BQU87UUFFM0MsUUFBUSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDZCxLQUFLLFFBQVE7Z0JBQ1gsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO2dCQUN2QixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDakIsTUFBTTtRQUNWLENBQUM7SUFDSCxDQUFDO0lBRVMsU0FBUztRQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0gsTUFBTSxTQUFTLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUVsRSxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO29CQUM1QyxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQzlCLENBQUM7WUFDSCxDQUFDO1lBQUMsV0FBTSxDQUFDO2dCQUNQLFNBQVM7WUFDWCxDQUFDO1lBRUQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7UUFDM0IsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDO1FBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRVMsZ0JBQWdCLENBQUMsQ0FBUTtRQUNqQyxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksT0FBTyxFQUFFLENBQUM7WUFDaEMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQWMsMkJBQTJCLENBQUMsQ0FBQztZQUV4RSxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNULElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO29CQUFFLE9BQU87Z0JBQy9DLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO29CQUFFLE9BQU8sSUFBSSxDQUFDO2dCQUV0RCxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FDOUIsNkRBQTZELENBQzlELENBQUM7Z0JBRUYsSUFBSSxDQUFDLE9BQU87b0JBQUUsT0FBTyxJQUFJLENBQUM7WUFDNUIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQsaUJBQWlCLENBQUMsT0FBb0IsRUFBRSxLQUFtQjtRQUN6RCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUN0QyxPQUFPLENBQUMscUJBQXFCLEVBQUUsRUFDL0IsS0FBSyxDQUFDLE9BQU8sRUFDYixLQUFLLENBQUMsT0FBTyxFQUNiLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQ3pCLENBQUM7UUFFRixRQUFRLE1BQU0sRUFBRSxDQUFDO1lBQ2YsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLElBQUksQ0FBQztZQUNWLEtBQUssSUFBSTtnQkFDUCx3REFBd0Q7Z0JBQ3hELDBCQUEwQjtnQkFDMUIsT0FBTztZQUNUO2dCQUNFLE9BQU8sTUFBTSxDQUFDO1FBQ2xCLENBQUM7SUFDSCxDQUFDO0lBRUQsRUFBRTtJQUVGLFVBQVU7UUFDUixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDakIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUxQyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFDOUIsQ0FBQztJQWFTLGlCQUFpQjtRQUN6QixJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN0RSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2RSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUU5RCxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN4RSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzVELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFaEUsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzdELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFUyxvQkFBb0I7UUFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDekUsTUFBTSxDQUFDLG1CQUFtQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNqRSxNQUFNLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM3RCxNQUFNLENBQUMsbUJBQW1CLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVqRSxJQUFJLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUMzRSxNQUFNLENBQUMsbUJBQW1CLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ25FLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDL0QsTUFBTSxDQUFDLG1CQUFtQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUVuRSxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDaEUsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQWFELE1BQU0sQ0FBQyxZQUFZLENBQ2pCLFNBQXNCLEVBQ3RCLE1BQXdCLEVBQ3hCLE1BQTRCO1FBRTVCLE1BQU0sRUFDSixPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFDOUIsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQ3RCLFNBQVMsR0FBRyxHQUFHLEVBQ2YsTUFBTSxHQUFHLEdBQUcsRUFDWixTQUFTLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixHQUNwQyxHQUFHLE1BQU0sQ0FBQztRQUVYLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDN0MsTUFBTSxXQUFXLEdBQUcsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDO1FBQzNFLE1BQU0saUJBQWlCLEdBQUcsV0FBVyxHQUFHLFNBQVMsQ0FBQztRQUNsRCxNQUFNLGVBQWUsR0FBRyxTQUFTLEdBQUcsTUFBTSxDQUFDO1FBRTNDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFNUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQTBCLENBQUM7UUFFOUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzlDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEIsQ0FBQztRQUVELElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztRQUViLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDMUQsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV0QyxJQUFJLENBQUMsQ0FBQyxPQUFPLFlBQVksV0FBVyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsZ0JBQWdCO2dCQUNoQixTQUFTO1lBQ1gsQ0FBQztZQUVELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUN6QixPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDckMsQ0FBQztZQUVELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFMUIsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLGdCQUFnQjtnQkFDaEIsU0FBUztZQUNYLENBQUM7WUFFRCxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM5QixPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkQsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFbkQsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRTFCLElBQUksQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDO2dCQUNiLElBQUksR0FBRyxDQUFDLENBQUM7WUFDWCxDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsaUJBQWlCLEdBQUcsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQ25FLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLGVBQWUsR0FBRyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDL0QsTUFBTSxTQUFTLEdBQ2IsWUFBWTtnQkFDWixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxpQkFBaUIsQ0FBQztnQkFDakMsTUFBTTtnQkFDTixLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUM7Z0JBQy9CLEtBQUssQ0FBQztZQUVSLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUM5QixDQUFDO1lBRUQsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ2hDLENBQUM7WUFFRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUMxQyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7WUFDdEMsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsSUFBSSxHQUFHLGVBQWUsR0FBRyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7UUFFdEUsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxlQUFlLEVBQUUsQ0FBQztZQUMvQyxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxlQUFlLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsZUFBZSxDQUFDLFNBQXNCLEVBQUUsU0FBc0I7UUFDbkUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUMxRCxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXRDLElBQUksT0FBTyxZQUFZLFdBQVcsRUFBRSxDQUFDO2dCQUNuQyxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FDdEIsV0FBVyxFQUNYLFNBQVMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFhLENBQUMsQ0FDN0MsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sQ0FBQyxVQUFVLENBQ2YsU0FBc0IsRUFDdEIsUUFBaUIsRUFDakIsWUFBMkI7UUFFM0IsU0FBUyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLFFBQVEsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ2pFLFNBQVMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxRQUFRLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXBFLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDO1FBRXJELElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFdkQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVsRCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUM3RCxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sQ0FBQyxhQUFhLENBQ2xCLFNBQXNCLEVBQ3RCLE1BQTRCLEVBQzVCLFVBQWtCLEVBQ2xCLFVBQWtCLEVBQ2xCLFFBQWdCLEVBQ2hCLFFBQWdCO1FBRWhCLE1BQU0sRUFDSixPQUFPLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFDOUIsU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFDbkMsR0FBRyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQ3RCLFNBQVMsR0FBRyxHQUFHLEVBQ2YsTUFBTSxHQUFHLEdBQUcsR0FDYixHQUFHLE1BQU0sQ0FBQztRQUVYLE1BQU0sY0FBYyxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDN0MsTUFBTSxXQUFXLEdBQUcsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDO1FBQzNFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRWpFLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELE1BQU0sQ0FBQyxpQkFBaUIsQ0FDdEIsVUFBbUIsRUFDbkIsT0FBZSxFQUNmLE9BQWUsRUFDZixTQUFpQjtRQUVqQixNQUFNLENBQUMsR0FBRyxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsR0FBRyxTQUFTLENBQUM7UUFDL0MsTUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssR0FBRyxPQUFPLEdBQUcsU0FBUyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsT0FBTyxHQUFHLFNBQVMsQ0FBQztRQUNsRCxNQUFNLENBQUMsR0FBRyxPQUFPLEdBQUcsVUFBVSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7UUFFaEQsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNOLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ04sT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO2lCQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2IsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sT0FBTyxHQUFHLENBQUM7WUFDYixDQUFDO1FBQ0gsQ0FBQzthQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDYixJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNOLE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE9BQU8sR0FBRyxDQUFDO1lBQ2IsQ0FBQztRQUNILENBQUM7YUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2IsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDTixPQUFPLElBQUksQ0FBQztZQUNkLENBQUM7aUJBQU0sQ0FBQztnQkFDTixPQUFPLEdBQUcsQ0FBQztZQUNiLENBQUM7UUFDSCxDQUFDO2FBQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNiLE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsZUFBZSxDQUFDLFlBQXNDO1FBQzNELFFBQVEsWUFBWSxFQUFFLENBQUM7WUFDckIsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxXQUFXLENBQUM7WUFDckIsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxXQUFXLENBQUM7WUFDckIsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUk7Z0JBQ1AsT0FBTyxhQUFhLENBQUM7WUFDdkIsS0FBSyxJQUFJLENBQUM7WUFDVixLQUFLLElBQUk7Z0JBQ1AsT0FBTyxhQUFhLENBQUM7WUFDdkI7Z0JBQ0UsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxTQUFTLENBQ2QsTUFBd0IsRUFDeEIsT0FBZSxFQUNmLFNBQXNCLEVBQ3RCLEVBQVUsRUFDVixFQUFVO1FBRVYsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbkQsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQztRQUVqQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDOUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXZCLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDMUIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUV0QixJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ2pDLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRSxDQUFDO3dCQUNuQixpQkFBaUI7d0JBQ2pCLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN4QixDQUFDO29CQUVELEdBQUcsQ0FBQyxDQUFDLENBQUMsbUNBQVEsSUFBSSxLQUFFLENBQUMsRUFBRSxDQUFDLEdBQUUsQ0FBQztnQkFDN0IsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDbkIsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsV0FBVyxDQUNoQixNQUF3QixFQUN4QixPQUFlLEVBQ2YsU0FBc0IsRUFDdEIsRUFBVSxFQUNWLEVBQVUsRUFDVixNQUFvQjtRQUVwQixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUM7UUFFakIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQzlDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV2QixJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzFCLE1BQU0sRUFBRSxJQUFJLEdBQUcsT0FBTyxFQUFFLElBQUksR0FBRyxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUM7Z0JBQ2pELElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUM7Z0JBQzFCLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2pCLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2pCLE1BQU0sRUFBRSxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7Z0JBRXZCLFFBQVEsTUFBTSxFQUFFLENBQUM7b0JBQ2YsS0FBSyxHQUFHO3dCQUNOLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBQzNCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNO29CQUNSLEtBQUssR0FBRzt3QkFDTixDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNO29CQUNSLEtBQUssSUFBSTt3QkFDUCxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE1BQU07b0JBQ1IsS0FBSyxJQUFJO3dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxF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NUIsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDbEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb25maWdCYXNlIHtcbiAgLyoqXG4gICAqIE51bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMlxuICAgKi9cbiAgY29sdW1ucz86IG51bWJlcjtcblxuICAvKipcbiAgICogSGVpZ2h0IG9mIGVhY2ggcm93IGluIHBpeGVscy5cbiAgICpcbiAgICogQGRlZmF1bHQgMzBcbiAgICovXG4gIHJvd0hlaWdodD86IG51bWJlcjtcblxuICAvKipcbiAgICogRGVmYXVsdCBnYXAgYmV0d2VlbiBncmlkIGNlbGxzIChhcHBsaWVzIHRvIGJvdGggcm93cyBhbmQgY29sdW1ucyBpZiBubyBvdmVycmlkZXMgYXJlIGdpdmVuKS5cbiAgICpcbiAgICogQGRlZmF1bHQgMFxuICAgKi9cbiAgZ2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIb3Jpem9udGFsIGdhcCBiZXR3ZWVuIGdyaWQgY29sdW1ucyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgY29sdW1uR2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBWZXJ0aWNhbCBnYXAgYmV0d2VlbiBncmlkIHJvd3MgaW4gcGl4ZWxzLlxuICAgKiBPdmVycmlkZXMgYGdhcGAgaWYgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBnYXBcbiAgICovXG4gIHJvd0dhcD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0Q29uZmlnIGV4dGVuZHMgR3JpZExheW91dENvbmZpZ0Jhc2Uge1xuICAvKipcbiAgICogQ2FsbGJhY2sgdHJpZ2dlcmVkIHdoZW4gdGhlIGxheW91dCBjaGFuZ2VzXG4gICAqIChlLmcuIGFmdGVyIGRyYWcvcmVzaXplIG9yIGV4dGVybmFsIHVwZGF0ZSkuXG4gICAqL1xuICBvbkxheW91dENoYW5nZT86IChsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sIGJyZWFrcG9pbnQ/OiBzdHJpbmcpID0+IHZvaWQ7XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHRyaWdnZXJlZCB3aGVuIHRoZSBzZWxlY3Rpb24gY2hhbmdlc1xuICAgKiAoZS5nLiB1c2VyIGNsaWNrcyBvciB0b2dnbGVzIGl0ZW0gc2VsZWN0aW9uKS5cbiAgICovXG4gIG9uU2VsZWN0aW9uQ2hhbmdlPzogKHNlbGVjdGlvbjogU2V0PHN0cmluZz4pID0+IHZvaWQ7XG5cbiAgLyoqXG4gICAqIElzIHRoZSBsYXlvdXQgZWRpdGFibGU/XG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVkaXRhYmxlPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogUmVzcG9uc2l2ZSBicmVha3BvaW50IGNvbmZpZ3MuXG4gICAqL1xuICBicmVha3BvaW50cz86IEdyaWRMYXlvdXRCcmVha3BvaW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3JpZExheW91dEJyZWFrcG9pbnQgZXh0ZW5kcyBHcmlkTGF5b3V0Q29uZmlnQmFzZSB7XG4gIC8qKlxuICAgKiBCcmVha3BvaW50IGtleSBmb3IgcmVmZXJlbmNlIGluIGNhbGxiYWNrcyBldGMuXG4gICAqL1xuICBrZXk6IHN0cmluZztcblxuICAvKipcbiAgICogQ29udGFpbmVyIHdpZHRoIGZyb20gd2hpY2ggdGhpcyBicmVhayBwb2ludCBzaG91bGQgYXBwbHkuXG4gICAqL1xuICBtaW5XaWR0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRJdGVtIHtcbiAgaTogc3RyaW5nO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIG1pblc/OiBudW1iZXI7XG4gIG1pbkg/OiBudW1iZXI7XG4gIG1heFc/OiBudW1iZXI7XG4gIG1heEg/OiBudW1iZXI7XG4gIHN0YXRpYz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFJlc2l6ZUhhbmRsZSA9ICduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudyc7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByb3RlY3RlZCBjb25maWc6IEdyaWRMYXlvdXRDb25maWc7XG4gIHByb3RlY3RlZCBsYXlvdXRzID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtW10+KCk7IC8vIE1hcHBlZCBieSBicmVha3BvaW50IGtleS5cbiAgcHJvdGVjdGVkIGJyZWFrcG9pbnQ6IEdyaWRMYXlvdXRCcmVha3BvaW50ID0geyBrZXk6ICcnLCBtaW5XaWR0aDogMCB9O1xuXG4gIHByb3RlY3RlZCBzZWxlY3Rpb24gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJvdGVjdGVkIHJlc2l6ZUhhbmRsZT86IFJlc2l6ZUhhbmRsZTtcbiAgcHJvdGVjdGVkIHRlbXBMYXlvdXQ/OiBHcmlkTGF5b3V0SXRlbVtdO1xuXG4gIHByb3RlY3RlZCBkcmFnUG9pbnRlcklkID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFRpbWUgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0WCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRZID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdFbmRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdFbmRZID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdLZXk/OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBkcmFnZ2luZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgcHJldmVudENsaWNrID0gZmFsc2U7XG5cbiAgcHJvdGVjdGVkIGxhc3REZWx0YVggPSAwO1xuICBwcm90ZWN0ZWQgbGFzdERlbHRhWSA9IDA7XG5cbiAgcHJvdGVjdGVkIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlcjtcblxuICBwcm90ZWN0ZWQgcmVuZGVyUmVxdWVzdGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBsYXlvdXRGbGFnID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIHNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgbWV0YUZsYWcgPSB0cnVlO1xuXG4gIHByb3RlY3RlZCBmbiA9IHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEdyaWRMYXlvdXQ7XG5cbiAgY29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnKSB7XG4gICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG5cbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHRoaXMuaGFuZGxlUmVzaXplKCkpO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG5cbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cblxuICBnZXRDb2x1bW5zKGJyZWFrcG9pbnQ/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRCcmVha3BvaW50KGJyZWFrcG9pbnQpLmNvbHVtbnMgPz8gdGhpcy5jb25maWcuY29sdW1ucyA/PyAxMjtcbiAgfVxuXG4gIGdldExheW91dChicmVha3BvaW50Pzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMubGF5b3V0cy5nZXQodGhpcy5nZXRCcmVha3BvaW50KGJyZWFrcG9pbnQpLmtleSkgPz8gW107XG4gIH1cblxuICBnZXRCcmVha3BvaW50KGJyZWFrcG9pbnQ/OiBzdHJpbmcpIHtcbiAgICBpZiAoYnJlYWtwb2ludCkge1xuICAgICAgY29uc3QgYiA9IHRoaXMuY29uZmlnLmJyZWFrcG9pbnRzPy5maW5kKChiKSA9PiBiLmtleSA9PT0gYnJlYWtwb2ludCk7XG5cbiAgICAgIGlmIChiKSByZXR1cm4gYjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5icmVha3BvaW50O1xuICB9XG5cbiAgc2V0Q29uZmlnKGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIGlmICh0aGlzLmNvbmZpZyA9PT0gY29uZmlnKSByZXR1cm47XG5cbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcblxuICAgIGZvciAoY29uc3QgW2tleSwgbGF5b3V0XSBvZiB0aGlzLmxheW91dHMpIHtcbiAgICAgIHRoaXMubGF5b3V0cy5zZXQoa2V5LCB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIHRoaXMuZ2V0Q29sdW1ucygpKSk7XG4gICAgfVxuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgc2V0TGF5b3V0KGxheW91dDogR3JpZExheW91dEl0ZW1bXSwgYnJlYWtwb2ludD86IHN0cmluZykge1xuICAgIGNvbnN0IGtleSA9IGJyZWFrcG9pbnQgPz8gdGhpcy5icmVha3BvaW50LmtleTtcbiAgICBjb25zdCBiZWZvcmUgPSB0aGlzLmxheW91dHMuZ2V0KGtleSk7XG5cbiAgICBpZiAobGF5b3V0ID09PSBiZWZvcmUpIHJldHVybjtcblxuICAgIHRoaXMubGF5b3V0cy5zZXQoa2V5LCB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIHRoaXMuZ2V0Q29sdW1ucyhrZXkpKSk7XG4gICAgdGhpcy5jb25maWcub25MYXlvdXRDaGFuZ2U/LihsYXlvdXQsIGtleSk7XG5cbiAgICBjb25zdCBicmVha3BvaW50cyA9IHRoaXMuY29uZmlnLmJyZWFrcG9pbnRzO1xuXG4gICAgaWYgKGJyZWFrcG9pbnRzKSB7XG4gICAgICBmb3IgKGNvbnN0IGJyZWFrcG9pbnQgb2YgYnJlYWtwb2ludHMpIHtcbiAgICAgICAgaWYgKCF0aGlzLmxheW91dHMuaGFzKGJyZWFrcG9pbnQua2V5KSkge1xuICAgICAgICAgIHRoaXMubGF5b3V0cy5zZXQoXG4gICAgICAgICAgICBicmVha3BvaW50LmtleSxcbiAgICAgICAgICAgIHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgdGhpcy5nZXRDb2x1bW5zKGJyZWFrcG9pbnQua2V5KSksXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0aGlzLmNvbmZpZy5vbkxheW91dENoYW5nZT8uKGxheW91dCwgYnJlYWtwb2ludC5rZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHNldFNlbGVjdGlvbihzZWxlY3Rpb246IEl0ZXJhYmxlPHN0cmluZz4pIHtcbiAgICBpZiAoc2VsZWN0aW9uID09PSB0aGlzLnNlbGVjdGlvbikgcmV0dXJuO1xuXG4gICAgdGhpcy5zZWxlY3Rpb24gPSBuZXcgU2V0KHNlbGVjdGlvbik7XG4gICAgdGhpcy5jb25maWcub25TZWxlY3Rpb25DaGFuZ2U/Lih0aGlzLnNlbGVjdGlvbik7XG5cbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgdG9nZ2xlU2VsZWN0aW9uKGtleTogc3RyaW5nLCBleGNsdXNpdmUgPSBmYWxzZSkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5oYXMoa2V5KSkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVsZXRlKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChleGNsdXNpdmUpIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZWxlY3Rpb24uYWRkKGtleSk7XG4gICAgfVxuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHJlcXVlc3RSZW5kZXIoKSB7XG4gICAgaWYgKCF0aGlzLnJlbmRlclJlcXVlc3RlZCkge1xuICAgICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHRoaXMucmVuZGVyKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcigpIHtcbiAgICB0aGlzLnJlbmRlclJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgZGltZW5zaW9ucyA9IHtcbiAgICAgIC4uLnRoaXMuY29uZmlnLFxuICAgICAgLi4udGhpcy5icmVha3BvaW50LFxuICAgIH07XG5cbiAgICBpZiAodGhpcy5sYXlvdXRGbGFnKSB7XG4gICAgICB0aGlzLmZuLnJlbmRlckxheW91dChcbiAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgIHRoaXMudGVtcExheW91dCA/PyB0aGlzLmdldExheW91dCgpLFxuICAgICAgICBkaW1lbnNpb25zLFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0RmxhZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlbGVjdGlvbkZsYWcpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCB0aGlzLnNlbGVjdGlvbik7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tZXRhRmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJNZXRhKHRoaXMuY29udGFpbmVyLCB0aGlzLmRyYWdnaW5nLCB0aGlzLnJlc2l6ZUhhbmRsZSk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgZHgsIGR5IH0gPSB0aGlzLmZuLmNhbGN1bGF0ZURyYWcoXG4gICAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgICAgZGltZW5zaW9ucyxcbiAgICAgICAgICB0aGlzLmRyYWdTdGFydFgsXG4gICAgICAgICAgdGhpcy5kcmFnU3RhcnRZLFxuICAgICAgICAgIHRoaXMuZHJhZ0VuZFgsXG4gICAgICAgICAgdGhpcy5kcmFnRW5kWSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoZHggIT09IHRoaXMubGFzdERlbHRhWCB8fCBkeSAhPT0gdGhpcy5sYXN0RGVsdGFZKSB7XG4gICAgICAgICAgdGhpcy5sYXN0RGVsdGFYID0gZHg7XG4gICAgICAgICAgdGhpcy5sYXN0RGVsdGFZID0gZHk7XG5cbiAgICAgICAgICBpZiAodGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4ucmVzaXplSXRlbXMoXG4gICAgICAgICAgICAgIHRoaXMuZ2V0TGF5b3V0KCksXG4gICAgICAgICAgICAgIHRoaXMuZ2V0Q29sdW1ucygpLFxuICAgICAgICAgICAgICB0aGlzLnNlbGVjdGlvbixcbiAgICAgICAgICAgICAgZHgsXG4gICAgICAgICAgICAgIGR5LFxuICAgICAgICAgICAgICB0aGlzLnJlc2l6ZUhhbmRsZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4ubW92ZUl0ZW1zKFxuICAgICAgICAgICAgICB0aGlzLmdldExheW91dCgpLFxuICAgICAgICAgICAgICB0aGlzLmdldENvbHVtbnMoKSxcbiAgICAgICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgICAgIGR4LFxuICAgICAgICAgICAgICBkeSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLm1ldGFGbGFnID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBwcm90ZWN0ZWQgaGFuZGxlUmVzaXplKCkge1xuICAgIGNvbnN0IGJyZWFrcG9pbnRzID0gdGhpcy5jb25maWcuYnJlYWtwb2ludHM7XG5cbiAgICBpZiAoYnJlYWtwb2ludHMgJiYgYnJlYWtwb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgY29udGFpbmVyV2lkdGggPSB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICAgIGxldCBuZXh0OiBHcmlkTGF5b3V0QnJlYWtwb2ludCB8IHVuZGVmaW5lZDtcblxuICAgICAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgYnJlYWtwb2ludHMpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFuZXh0IHx8XG4gICAgICAgICAgKGNhbmRpZGF0ZS5taW5XaWR0aCA8PSBjb250YWluZXJXaWR0aCAmJlxuICAgICAgICAgICAgY2FuZGlkYXRlLm1pbldpZHRoID4gbmV4dC5taW5XaWR0aClcbiAgICAgICAgKSB7XG4gICAgICAgICAgbmV4dCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmJyZWFrcG9pbnQgPSBuZXh0IGFzIEdyaWRMYXlvdXRCcmVha3BvaW50O1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKHRoaXMuYnJlYWtwb2ludCk7XG5cbiAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5kcmFnU3RhcnRYID0gdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnU3RhcnRZID0gdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gdGhpcy5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCBlKTtcbiAgICAgIHRoaXMuZHJhZ0tleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuXG4gICAgaWYgKCF0aGlzLmRyYWdLZXkpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gZWxlbWVudFxuICAgICAgICA/IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSlcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIXRoaXMuZHJhZ2dpbmcgJiZcbiAgICAgIHRoaXMuZHJhZ0tleSAmJlxuICAgICAgKGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA+IHRoaXMuZm4uRFJBR19USFJFU0hPTEQgfHxcbiAgICAgICAgYWJzKHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFkpID4gdGhpcy5mbi5EUkFHX1RIUkVTSE9MRClcbiAgICApIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuXG4gICAgICBpZiAoIXRoaXMuc2VsZWN0aW9uLmhhcyh0aGlzLmRyYWdLZXkpIHx8IHRoaXMucmVzaXplSGFuZGxlKSB7XG4gICAgICAgIHRoaXMuc2V0U2VsZWN0aW9uKFt0aGlzLmRyYWdLZXldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlTW91c2VVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIGlmICh0aGlzLnRlbXBMYXlvdXQpIHtcbiAgICAgIHRoaXMuc2V0TGF5b3V0KHRoaXMudGVtcExheW91dCk7XG4gICAgICB0aGlzLnRlbXBMYXlvdXQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdGhpcy5yZXNldERyYWcoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAodGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdQb2ludGVySWQgPSBlLnBvaW50ZXJJZDtcbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSAmJiB0aGlzLnNlbGVjdGlvbi5oYXMoZWxlbWVudC5kYXRhc2V0LmtleSkpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSB0aGlzLmNoZWNrUmVzaXplSGFuZGxlKGVsZW1lbnQsIGUpO1xuXG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlck1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlcklkICE9PSB0aGlzLmRyYWdQb2ludGVySWQpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuXG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlclVwKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJJZCAhPT0gdGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLmRyYWdTdGFydFRpbWUgPiBEYXRlLm5vdygpIC0gdGhpcy5mbi5UQVBfREVMQVkgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA8IHRoaXMuZm4uVEFQX1RIUkVTSE9MRCAmJlxuICAgICAgYWJzKHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFkpIDwgdGhpcy5mbi5UQVBfVEhSRVNIT0xEXG4gICAgKSB7XG4gICAgICAvLyBJdCdzIGEgdGFwLlxuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXksIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy50ZW1wTGF5b3V0KSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBMYXlvdXQpO1xuICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLnByZXZlbnRDbGljaykge1xuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSkge1xuICAgICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlS2V5VXAoZTogS2V5Ym9hcmRFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIHN3aXRjaCAoZS5rZXkpIHtcbiAgICAgIGNhc2UgJ0VzY2FwZSc6XG4gICAgICAgIHRoaXMudGVtcExheW91dCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgICB0aGlzLnJlc2V0RHJhZygpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVzZXREcmFnKCkge1xuICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzZWxlY3Rpb24gPSAoZG9jdW1lbnQuZGVmYXVsdFZpZXcgfHwgd2luZG93KS5nZXRTZWxlY3Rpb24oKTtcblxuICAgICAgICBpZiAoc2VsZWN0aW9uICYmIHNlbGVjdGlvbi50eXBlICE9PSAnQ2FyZXQnKSB7XG4gICAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gaWdub3JlXG4gICAgICB9XG5cbiAgICAgIHRoaXMucHJldmVudENsaWNrID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmRyYWdQb2ludGVySWQgPSAwO1xuICAgIHRoaXMuZHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmRyYWdLZXkgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5yZXNpemVIYW5kbGUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5sYXN0RGVsdGFYID0gMDtcbiAgICB0aGlzLmxhc3REZWx0YVkgPSAwO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldFRhcmdldEVsZW1lbnQoZTogRXZlbnQpIHtcbiAgICBpZiAoZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICBjb25zdCBpdGVtID0gZS50YXJnZXQuY2xvc2VzdDxIVE1MRWxlbWVudD4oJy5mYXN0LWdyaWQtbGF5b3V0ID4gLml0ZW0nKTtcblxuICAgICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgaWYgKGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKCctc3RhdGljJykpIHJldHVybjtcbiAgICAgICAgaWYgKGl0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKCctc2VsZWN0ZWQnKSkgcmV0dXJuIGl0ZW07XG5cbiAgICAgICAgY29uc3QgY29udGVudCA9IGUudGFyZ2V0LmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KFxuICAgICAgICAgICcuZmFzdC1ncmlkLWxheW91dCAuY29udGVudCwgYnV0dG9uLCBpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcsXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKCFjb250ZW50KSByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50OiBIVE1MRWxlbWVudCwgZXZlbnQ6IFBvaW50ZXJFdmVudCkge1xuICAgIGNvbnN0IGhhbmRsZSA9IHRoaXMuZm4uY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgICBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgZXZlbnQuY2xpZW50WCxcbiAgICAgIGV2ZW50LmNsaWVudFksXG4gICAgICB0aGlzLmZuLlJFU0laRV9USFJFU0hPTEQsXG4gICAgKTtcblxuICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICBjYXNlICduJzpcbiAgICAgIGNhc2UgJ25lJzpcbiAgICAgIGNhc2UgJ253JzpcbiAgICAgICAgLy8gRGlzYWJsZSBub3J0aCBoYW5kbGVzIGZvciBub3csIGFzIGl0IGZlZWxzIHVubmF0dXJhbC5cbiAgICAgICAgLy8gVE9ETyBtYWtlIGNvbmZpZ3VyYWJsZT9cbiAgICAgICAgcmV0dXJuO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgdGhpcy5yZXNldERyYWcoKTtcbiAgICB0aGlzLmZuLnJlbmRlclNlbGVjdGlvbih0aGlzLmNvbnRhaW5lciwgbmV3IFNldCgpKTtcbiAgICB0aGlzLmZuLnJlbmRlck1ldGEodGhpcy5jb250YWluZXIsIGZhbHNlKTtcblxuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIudW5vYnNlcnZlKHRoaXMuY29udGFpbmVyKTtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlRG93biA9IHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VNb3ZlID0gdGhpcy5oYW5kbGVNb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZVVwID0gdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyRG93biA9IHRoaXMuaGFuZGxlUG9pbnRlckRvd24uYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyTW92ZSA9IHRoaXMuaGFuZGxlUG9pbnRlck1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyVXAgPSB0aGlzLmhhbmRsZVBvaW50ZXJVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlQ2xpY2sgPSB0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlS2V5VXAgPSB0aGlzLmhhbmRsZUtleVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCBDQVBUVVJFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVNb3VzZURvd24pO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZU1vdXNlTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZVBvaW50ZXJEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVQb2ludGVyTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5faGFuZGxlQ2xpY2ssIENBUFRVUkUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuX2hhbmRsZUtleVVwKTtcbiAgfVxuXG4gIC8vXG5cbiAgc3RhdGljIERFRkFVTFRfQ09MVU1OUyA9IDEyO1xuICBzdGF0aWMgREVGQVVMVF9ST1dfSEVJR0hUID0gMzA7XG4gIHN0YXRpYyBERUZBVUxUX0dBUCA9IDA7XG5cbiAgc3RhdGljIFJFU0laRV9USFJFU0hPTEQgPSAxMDtcbiAgc3RhdGljIFRBUF9ERUxBWSA9IDI1MDtcbiAgc3RhdGljIFRBUF9USFJFU0hPTEQgPSAxMDtcbiAgc3RhdGljIERSQUdfVEhSRVNIT0xEID0gNztcblxuICBzdGF0aWMgcmVuZGVyTGF5b3V0KFxuICAgIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZ0Jhc2UsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIGdhcCA9IHRoaXMuREVGQVVMVF9HQVAsXG4gICAgICBjb2x1bW5HYXAgPSBnYXAsXG4gICAgICByb3dHYXAgPSBnYXAsXG4gICAgICByb3dIZWlnaHQgPSB0aGlzLkRFRkFVTFRfUk9XX0hFSUdIVCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgY29sdW1uV2lkdGhBbmRHYXAgPSBjb2x1bW5XaWR0aCArIGNvbHVtbkdhcDtcbiAgICBjb25zdCByb3dIZWlnaHRBbmRHYXAgPSByb3dIZWlnaHQgKyByb3dHYXA7XG5cbiAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZmFzdC1ncmlkLWxheW91dCcpO1xuXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtPigpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuICAgICAgbWFwLnNldChpdGVtLmksIGl0ZW0pO1xuICAgIH1cblxuICAgIGxldCBoTWF4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnQuZGF0YXNldC5rZXkpIHtcbiAgICAgICAgZWxlbWVudC5kYXRhc2V0LmtleSA9IGkudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5kYXRhc2V0LmtleTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtYXAuZ2V0KGtleSk7XG5cbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2l0ZW0nKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnLWR5bmFtaWMnLCAhaXRlbS5zdGF0aWMpO1xuICAgICAgZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCctc3RhdGljJywgISFpdGVtLnN0YXRpYyk7XG5cbiAgICAgIGNvbnN0IGggPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGlmIChoID4gaE1heCkge1xuICAgICAgICBoTWF4ID0gaDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2lkdGggPSByb3VuZChpdGVtLncgKiBjb2x1bW5XaWR0aEFuZEdhcCAtIGNvbHVtbkdhcCkgKyAncHgnO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gcm91bmQoaXRlbS5oICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG4gICAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlKCcgK1xuICAgICAgICByb3VuZChpdGVtLnggKiBjb2x1bW5XaWR0aEFuZEdhcCkgK1xuICAgICAgICAncHgsICcgK1xuICAgICAgICByb3VuZChpdGVtLnkgKiByb3dIZWlnaHRBbmRHYXApICtcbiAgICAgICAgJ3B4KSc7XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLndpZHRoICE9PSB3aWR0aCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gIT09IHRyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSByb3VuZChoTWF4ICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG5cbiAgICBpZiAoY29udGFpbmVyLnN0eWxlLmhlaWdodCAhPT0gY29udGFpbmVySGVpZ2h0KSB7XG4gICAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJTZWxlY3Rpb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5IGFzIHN0cmluZyksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHJlbmRlck1ldGEoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBkcmFnZ2luZzogYm9vbGVhbixcbiAgICByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctbW92aW5nJywgZHJhZ2dpbmcgJiYgIXJlc2l6ZUhhbmRsZSk7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1yZXNpemluZycsIGRyYWdnaW5nICYmICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IHJvb3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19oaWRlLXNlbGVjdGlvbicsIGRyYWdnaW5nKTtcbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19mb3JjZS1jdXJzb3InLCAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGUpO1xuXG4gICAgaWYgKHJvb3Quc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1mb3JjZS1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZvcmNlLWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNhbGN1bGF0ZURyYWcoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWdCYXNlLFxuICAgIGRyYWdTdGFydFg6IG51bWJlcixcbiAgICBkcmFnU3RhcnRZOiBudW1iZXIsXG4gICAgZHJhZ0VuZFg6IG51bWJlcixcbiAgICBkcmFnRW5kWTogbnVtYmVyLFxuICApIHtcbiAgICBjb25zdCB7XG4gICAgICBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMsXG4gICAgICByb3dIZWlnaHQgPSB0aGlzLkRFRkFVTFRfUk9XX0hFSUdIVCxcbiAgICAgIGdhcCA9IHRoaXMuREVGQVVMVF9HQVAsXG4gICAgICBjb2x1bW5HYXAgPSBnYXAsXG4gICAgICByb3dHYXAgPSBnYXAsXG4gICAgfSA9IGNvbmZpZztcblxuICAgIGNvbnN0IGNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLm9mZnNldFdpZHRoO1xuICAgIGNvbnN0IGNvbHVtbldpZHRoID0gKGNvbnRhaW5lcldpZHRoIC0gKGNvbHVtbnMgLSAxKSAqIGNvbHVtbkdhcCkgLyBjb2x1bW5zO1xuICAgIGNvbnN0IGR4ID0gcm91bmQoKGRyYWdFbmRYIC0gZHJhZ1N0YXJ0WCkgLyAoY29sdW1uV2lkdGggKyBjb2x1bW5HYXApKTtcbiAgICBjb25zdCBkeSA9IHJvdW5kKChkcmFnRW5kWSAtIGRyYWdTdGFydFkpIC8gKHJvd0hlaWdodCArIHJvd0dhcCkpO1xuXG4gICAgcmV0dXJuIHsgZHgsIGR5IH07XG4gIH1cblxuICBzdGF0aWMgY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgY2xpZW50UmVjdDogRE9NUmVjdCxcbiAgICBjbGllbnRYOiBudW1iZXIsXG4gICAgY2xpZW50WTogbnVtYmVyLFxuICAgIHRocmVzaG9sZDogbnVtYmVyLFxuICApOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IG4gPSBjbGllbnRZIC0gY2xpZW50UmVjdC50b3AgPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgZSA9IGNsaWVudFJlY3QucmlnaHQgLSBjbGllbnRYIDwgdGhyZXNob2xkO1xuICAgIGNvbnN0IHMgPSBjbGllbnRSZWN0LmJvdHRvbSAtIGNsaWVudFkgPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgdyA9IGNsaWVudFggLSBjbGllbnRSZWN0LmxlZnQgPCB0aHJlc2hvbGQ7XG5cbiAgICBpZiAocykge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuICdzZSc7XG4gICAgICB9IGVsc2UgaWYgKHcpIHtcbiAgICAgICAgcmV0dXJuICdzdyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3MnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZSkge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgcmV0dXJuICduZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgcmV0dXJuICdudyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3cnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobikge1xuICAgICAgcmV0dXJuICduJztcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgZ2V0UmVzaXplQ3Vyc29yKHJlc2l6ZUhhbmRsZTogUmVzaXplSGFuZGxlIHwgdW5kZWZpbmVkKSB7XG4gICAgc3dpdGNoIChyZXNpemVIYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgY2FzZSAncyc6XG4gICAgICAgIHJldHVybiAnbnMtcmVzaXplJztcbiAgICAgIGNhc2UgJ2UnOlxuICAgICAgY2FzZSAndyc6XG4gICAgICAgIHJldHVybiAnZXctcmVzaXplJztcbiAgICAgIGNhc2UgJ25lJzpcbiAgICAgIGNhc2UgJ3N3JzpcbiAgICAgICAgcmV0dXJuICduZXN3LXJlc2l6ZSc7XG4gICAgICBjYXNlICdzZSc6XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIHJldHVybiAnbndzZS1yZXNpemUnO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlcyB0aGUgc3BlY2lmaWVkIGl0ZW1zIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgbW92ZUl0ZW1zKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPixcbiAgICBkeDogbnVtYmVyLFxuICAgIGR5OiBudW1iZXIsXG4gICkge1xuICAgIGlmICgoZHggPT09IDAgJiYgZHkgPT09IDApIHx8IHNlbGVjdGlvbi5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeCA9IGl0ZW0ueCArIGR4O1xuICAgICAgICBjb25zdCB5ID0gaXRlbS55ICsgZHk7XG5cbiAgICAgICAgaWYgKGl0ZW0ueCAhPT0geCB8fCBpdGVtLnkgIT09IHkpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5IH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29sdW1ucywgc2VsZWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNpemVzIHRoZSBzcGVjaWZpZWQgaXRlbSAoaW4gZ3JpZCB1bml0cykuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIG1vZGlmaWVkLlxuICAgKi9cbiAgc3RhdGljIHJlc2l6ZUl0ZW1zKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPixcbiAgICBkeDogbnVtYmVyLFxuICAgIGR5OiBudW1iZXIsXG4gICAgaGFuZGxlOiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGlmIChkeCA9PT0gMCAmJiBkeSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICBsZXQgb3V0ID0gbGF5b3V0O1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuXG4gICAgICBpZiAoc2VsZWN0aW9uLmhhcyhpdGVtLmkpKSB7XG4gICAgICAgIGNvbnN0IHsgbWF4VyA9IGNvbHVtbnMsIG1heEggPSBJbmZpbml0eSB9ID0gaXRlbTtcbiAgICAgICAgbGV0IHsgeCwgeSwgdywgaCB9ID0gaXRlbTtcbiAgICAgICAgY29uc3QgeHcgPSB4ICsgdztcbiAgICAgICAgY29uc3QgeWggPSB5ICsgaDtcbiAgICAgICAgY29uc3QgY3ggPSBjb2x1bW5zIC0geDtcblxuICAgICAgICBzd2l0Y2ggKGhhbmRsZSkge1xuICAgICAgICAgIGNhc2UgJ24nOlxuICAgICAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGR5LCAwLCB5aCAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3MnOlxuICAgICAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICd3JzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3IC0gZHgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ25lJzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGR5LCAwLCB5aCAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc2UnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgKyBkeCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3N3JzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3IC0gZHgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB4ID0gY2xhbXAoeCArIGR4LCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbncnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGR5LCAwLCB5aCAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS54ICE9PSB4IHx8IGl0ZW0ueSAhPT0geSB8fCBpdGVtLncgIT09IHcgfHwgaXRlbS5oICE9PSBoKSB7XG4gICAgICAgICAgaWYgKG91dCA9PT0gbGF5b3V0KSB7XG4gICAgICAgICAgICAvLyBDb3B5IG9uIHdyaXRlLlxuICAgICAgICAgICAgb3V0ID0gbGF5b3V0LnNsaWNlKDApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG91dFtpXSA9IHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29sdW1ucywgc2VsZWN0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaXhlcyBvdmVybGFwcywgZ2FwcywgYW5kIGxheW91dCBvdXQgb2YgYm91bmRzLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckxheW91dChcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29sdW1uczogbnVtYmVyLFxuICAgIHNlbGVjdGlvbj86IFNldDxzdHJpbmc+LFxuICApIHtcbiAgICAvLyBTb3J0IGJ5IHJvdyBmaXJzdCwgc2VsZWN0aW9uIHNlY29uZCAoaWYgYW55KSwgY29sdW1uIHRoaXJkLlxuICAgIGNvbnN0IHNvcnRlZEl0ZW1zID0gbGF5b3V0LnNsaWNlKDApLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChhLnkgPCBiLnkpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLnkgPiBiLnkpIHJldHVybiAxO1xuXG4gICAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGEuaSkpIHtcbiAgICAgICAgICBpZiAoIXNlbGVjdGlvbi5oYXMoYi5pKSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3Rpb24uaGFzKGIuaSkpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoYS54IDwgYi54KSByZXR1cm4gLTE7XG4gICAgICBpZiAoYS54ID4gYi54KSByZXR1cm4gMTtcblxuICAgICAgcmV0dXJuIDA7XG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGF0aWNJdGVtcyA9IHNvcnRlZEl0ZW1zLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5zdGF0aWMpO1xuICAgIGNvbnN0IG51bVN0YXRpY3MgPSBzdGF0aWNJdGVtcy5sZW5ndGg7XG4gICAgbGV0IG1vZGlmaWVkID0gZmFsc2U7XG4gICAgbGV0IHN0YXRpY09mZnNldCA9IDA7XG5cbiAgICAvLyBcIlJpc2luZyB0aWRlXCIsIGkuZS4gbnVtYmVyIG9mIGJsb2NrZWQgY2VsbHMgcGVyIGNvbHVtbi5cbiAgICBjb25zdCB0aWRlOiBudW1iZXJbXSA9IEFycmF5KGNvbHVtbnMpO1xuXG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBjb2x1bW5zOyArK3gpIHtcbiAgICAgIHRpZGVbeF0gPSAwO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gc29ydGVkSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAvLyBOb3RlIHRoYXQgd2UgYWxsb3cgaXRlbXMgdG8gYmUgb3V0IG9mIGJvdW5kcyBkdXJpbmcgc29ydGluZyxcbiAgICAgIC8vIHdoaWNoIChmb3IgZXhhbXBsZSkgYWxsb3dzIG1vdmluZyBpdGVtcyBcImJlZm9yZVwiIHRoZSBmaXJzdCBpdGVtLlxuICAgICAgLy8gV2UgZml4IGFueSBvdXQgb2YgYm91bmQgaXNzdWVzIGhlcmUuXG4gICAgICBsZXQgaXRlbSA9IHRoaXMucmVwYWlySXRlbShzb3J0ZWRJdGVtc1tpXSwgY29sdW1ucyk7XG4gICAgICBjb25zdCB4MiA9IGl0ZW0ueCArIGl0ZW0udztcblxuICAgICAgaWYgKGl0ZW0uc3RhdGljKSB7XG4gICAgICAgIC8vIFRoaXMgc3RhdGljIGl0ZW0gd2lsbCBiZSBwYXJ0IG9mIHRoZSB0aWRlXG4gICAgICAgIC8vIGFuZCBkb2VzIG5vdCBuZWVkIHRvIGJlIGNvbnNpZGVyZWQgZm9yIGNvbGxpc2lvbiBhbnltb3JlLlxuICAgICAgICAvLyBTaW5jZSBzdGF0aWMgaXRlbSB3aWxsIGJlIHZpc2l0ZWQgaW4gdGhlIHNhbWUgb3JkZXJcbiAgICAgICAgLy8gYXMgdGhlIHN0YXRpY0l0ZW1zIGFycmF5LCB3ZSBjYW4ganVzdCBpbmNyZW1lbnQgdGhlIG9mZnNldCBoZXJlLlxuICAgICAgICArK3N0YXRpY09mZnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIERldGVjdCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwIHdpdGggdGlkZS5cbiAgICAgICAgbGV0IG1pbkdhcCA9IEluZmluaXR5O1xuXG4gICAgICAgIGZvciAobGV0IHggPSBpdGVtLng7IHggPCB4MjsgKyt4KSB7XG4gICAgICAgICAgY29uc3QgZ2FwID0gaXRlbS55IC0gdGlkZVt4XTtcblxuICAgICAgICAgIGlmIChnYXAgPCBtaW5HYXApIHtcbiAgICAgICAgICAgIG1pbkdhcCA9IGdhcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXggc21hbGxlc3QgZ2FwL2xhcmdlc3Qgb3ZlcmxhcC5cbiAgICAgICAgbGV0IHlOZXh0ID0gaXRlbS55IC0gbWluR2FwO1xuXG4gICAgICAgIC8vIEhhbmRsZSBjb2xsaXNpb24gd2l0aCBzdGF0aWMgaXRlbXMuXG4gICAgICAgIGZvciAobGV0IGogPSBzdGF0aWNPZmZzZXQ7IGogPCBudW1TdGF0aWNzOyArK2opIHtcbiAgICAgICAgICBjb25zdCBzdGF0aWNJdGVtID0gc3RhdGljSXRlbXNbal07XG5cbiAgICAgICAgICBpZiAoc3RhdGljSXRlbS55ID49IHlOZXh0ICsgaXRlbS5oKSB7XG4gICAgICAgICAgICAvLyBGb2xsb3dpbmcgc3RhdGljIGl0ZW1zIGNhbm5vdCBjb2xsaWRlIGJlY2F1c2Ugb2Ygc29ydGluZzsgc3RvcC5cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIC8vc3RhdGljSXRlbS55IDwgeU5leHQgKyBpdGVtLmggJiYgLy8gVGhpcyBpcyBpbXBsaWVkIGFib3ZlLlxuICAgICAgICAgICAgc3RhdGljSXRlbS55ICsgc3RhdGljSXRlbS5oID4geU5leHQgJiZcbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueCA8IGl0ZW0ueCArIGl0ZW0udyAmJlxuICAgICAgICAgICAgc3RhdGljSXRlbS54ICsgc3RhdGljSXRlbS53ID4gaXRlbS54XG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBDb2xsaXNpb24gZGV0ZWN0ZWQ7IG1vdmUgY3VycmVudCBpdGVtIGJlbG93IHN0YXRpYyBpdGVtLlxuICAgICAgICAgICAgeU5leHQgPSBzdGF0aWNJdGVtLnkgKyBzdGF0aWNJdGVtLmg7XG5cbiAgICAgICAgICAgIC8vIEN1cnJlbnQgaXRlbSB3YXMgbW92ZWQ7XG4gICAgICAgICAgICAvLyBuZWVkIHRvIHJlY2hlY2sgY29sbGlzaW9uIHdpdGggb3RoZXIgc3RhdGljIGl0ZW1zLlxuICAgICAgICAgICAgaiA9IHN0YXRpY09mZnNldDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS55ICE9PSB5TmV4dCkge1xuICAgICAgICAgIGl0ZW0gPSB7IC4uLml0ZW0sIHk6IHlOZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbSAhPT0gc29ydGVkSXRlbXNbaV0pIHtcbiAgICAgICAgICBzb3J0ZWRJdGVtc1tpXSA9IGl0ZW07XG4gICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aWRlLlxuICAgICAgY29uc3QgdCA9IGl0ZW0ueSArIGl0ZW0uaDtcblxuICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgaWYgKHRpZGVbeF0gPCB0KSB7XG4gICAgICAgICAgdGlkZVt4XSA9IHQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQgPyBzb3J0ZWRJdGVtcyA6IGxheW91dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBhaXIgYm91bmRzIG9mIHRoZSBnaXZlbiBpdGVtIHRvIGZpdCB0aGUgZ2l2ZW4gY29uZmlnLlxuICAgKiBSZXR1cm5zIGEgbmV3IGl0ZW0gaWYgdGhlcmUgd2FzIGFueXRoaW5nIHRvIHJlcGFpci5cbiAgICovXG4gIHN0YXRpYyByZXBhaXJJdGVtKGl0ZW06IEdyaWRMYXlvdXRJdGVtLCBjb2x1bW5zOiBudW1iZXIpIHtcbiAgICBjb25zdCB7IG1pblcgPSAxLCBtYXhXID0gY29sdW1ucywgbWluSCA9IDEsIG1heEggPSBJbmZpbml0eSB9ID0gaXRlbTtcbiAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuXG4gICAgdyA9IGNsYW1wKHcsIG1pblcsIG1pbihtYXhXLCBjb2x1bW5zKSk7XG4gICAgaCA9IGNsYW1wKGgsIG1pbkgsIG1heEgpO1xuICAgIHggPSBjbGFtcCh4LCAwLCBjb2x1bW5zIC0gdyk7XG4gICAgaWYgKHkgPCAwKSB5ID0gMDtcblxuICAgIGlmIChpdGVtLnggPT09IHggJiYgaXRlbS55ID09PSB5ICYmIGl0ZW0udyA9PT0gdyAmJiBpdGVtLmggPT09IGgpIHtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cblxuICAgIHJldHVybiB7IC4uLml0ZW0sIHgsIHksIHcsIGggfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgaWYgKHZhbHVlIDwgbWluKSByZXR1cm4gbWluO1xuICBpZiAodmFsdWUgPiBtYXgpIHJldHVybiBtYXg7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuY29uc3QgYWJzID0gTWF0aC5hYnM7XG5jb25zdCBtaW4gPSBNYXRoLm1pbjtcbmNvbnN0IHJvdW5kID0gTWF0aC5yb3VuZDtcblxuY29uc3QgQ0FQVFVSRSA9IHsgY2FwdHVyZTogdHJ1ZSB9O1xuY29uc3QgUEFTU0lWRSA9IHsgcGFzc2l2ZTogdHJ1ZSB9O1xuIl19