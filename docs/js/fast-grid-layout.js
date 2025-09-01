export class GridLayout {
    constructor(container, config) {
        this.layouts = new Map(); // Mapped by breakpoint name.
        this.editable = false;
        this.layoutChangeCallback = () => { };
        this.selectionChangeCallback = () => { };
        this.selection = new Set();
        this.dragPointerId = 0;
        this.dragStartTime = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragEndX = 0;
        this.dragEndY = 0;
        this.dragging = false;
        this.preventClick = false;
        this.renderRequested = false;
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.manipulationCache = new WeakMap();
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
        this.containerWidth = container.offsetWidth;
        this.breakpoints = this.fn.compileBreakpoints(config);
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
        this.addEventListeners();
    }
    setConfig(config) {
        this.breakpoints = this.fn.compileBreakpoints(config);
        for (const [name, layout] of this.layouts) {
            const breakpoint = this.getBreakpoint(name);
            const repaired = this.fn.repairLayout(layout, breakpoint.columns);
            if (repaired !== layout) {
                this.layouts.set(name, this.fn.repairLayout(layout, breakpoint.columns));
                this.layoutChangeCallback(layout, breakpoint.name);
            }
        }
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.requestRender();
    }
    setLayout(layout, breakpoint) {
        const b = this.getBreakpoint(breakpoint);
        const before = this.layouts.get(b.name);
        if (layout === before)
            return;
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
    setEditable(editable) {
        this.editable = editable;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.requestRender();
    }
    onLayoutChange(callback) {
        this.layoutChangeCallback = callback;
    }
    onSelectionChange(callback) {
        this.selectionChangeCallback = callback;
    }
    setSelection(selection) {
        if (setsAreEqual(selection, this.selection))
            return;
        this.selection = selection;
        this.selectionChangeCallback(this.selection);
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
    getBreakpoint(name) {
        const breakpoints = this.breakpoints;
        if (name) {
            const breakpoint = breakpoints.find((it) => it.name === name);
            if (breakpoint)
                return breakpoint;
        }
        return breakpoints.find((it) => it.maxWidth >= this.containerWidth);
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
        const layoutToRender = this.getNextLayout();
        if (this.layoutFlag || layoutToRender !== this.lastLayoutToRender) {
            this.fn.renderLayout(this.container, layoutToRender, breakpoint);
            this.layoutFlag = false;
            this.lastLayoutToRender = layoutToRender;
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
    renderSelection() {
        const children = this.container.children;
        for (let i = 0, l = children.length; i < l; ++i) {
            const element = children[i];
            if (element instanceof HTMLElement) {
                element.classList.toggle('-selected', this.selection.has(element.dataset.key));
            }
        }
    }
    renderMeta() {
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
    getNextLayout() {
        const breakpoint = this.getBreakpoint();
        const layout = this.layouts.get(breakpoint.name);
        if (!layout)
            return [];
        if (!this.dragging)
            return layout;
        const dragX = this.dragEndX - this.dragStartX;
        const dragY = this.dragEndY - this.dragStartY;
        const columnWidth = this.fn.getColumnWidth(this.containerWidth, breakpoint.columns, breakpoint.columnGap);
        const columnWidthAndGap = columnWidth + breakpoint.columnGap;
        const rowHeightAndGap = breakpoint.rowHeight + breakpoint.rowGap;
        const deltaX = round(dragX / columnWidthAndGap);
        const deltaY = round(dragY / rowHeightAndGap);
        if (deltaX === 0 && deltaY === 0)
            return layout;
        let cacheForLayout = this.manipulationCache.get(layout);
        if (!cacheForLayout) {
            cacheForLayout = new Map();
            this.manipulationCache.set(layout, cacheForLayout);
        }
        const cacheKey = `${Array.from(this.selection).join(',')}@${deltaX},${deltaY}@${this.resizeHandle}`;
        const cached = cacheForLayout.get(cacheKey);
        if (cached)
            return cached;
        const out = this.resizeHandle
            ? this.fn.resizeItems(layout, breakpoint.columns, this.selection, deltaX, deltaY, this.resizeHandle)
            : this.fn.moveItems(layout, breakpoint.columns, this.selection, deltaX, deltaY);
        cacheForLayout.set(cacheKey, out);
        return out;
    }
    //
    handleResize() {
        this.containerWidth = this.container.offsetWidth;
        this.layoutFlag = true;
        this.requestRender();
    }
    handleMouseDown(e) {
        if (this.editable === false)
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
        if (this.editable === false)
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
                this.setSelection(new Set(this.dragKey));
            }
        }
    }
    handleMouseUp(e) {
        if (this.editable === false)
            return;
        if (e.pointerType !== 'mouse' || e.button !== 0)
            return;
        this.setLayout(this.getNextLayout());
        this.resetDrag();
    }
    handlePointerDown(e) {
        if (this.editable === false)
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
        if (this.editable === false)
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
        if (this.editable === false)
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
        else {
            this.setLayout(this.getNextLayout());
        }
        this.resetDrag();
    }
    handleClick(e) {
        if (this.editable === false)
            return;
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
        if (this.editable === false)
            return;
        switch (e.key) {
            case 'Escape':
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
        this.selection = new Set();
        this.resetDrag();
        this.renderSelection();
        this.renderMeta();
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
    static compileBreakpoints(config) {
        var _a, _b, _c, _d, _e, _f, _g;
        const defaultColumns = 12;
        const defaultRowHeight = 30;
        const breakpoints = Object.entries((_a = config.breakpoints) !== null && _a !== void 0 ? _a : {})
            .map(([name, b]) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            return {
                name,
                maxWidth: b.maxWidth,
                columns: (_b = (_a = b.columns) !== null && _a !== void 0 ? _a : config.columns) !== null && _b !== void 0 ? _b : defaultColumns,
                rowHeight: (_d = (_c = b.rowHeight) !== null && _c !== void 0 ? _c : config.rowHeight) !== null && _d !== void 0 ? _d : defaultRowHeight,
                rowGap: (_h = (_g = (_f = (_e = b.rowGap) !== null && _e !== void 0 ? _e : b.gap) !== null && _f !== void 0 ? _f : config.rowGap) !== null && _g !== void 0 ? _g : config.gap) !== null && _h !== void 0 ? _h : 0,
                columnGap: (_m = (_l = (_k = (_j = b.columnGap) !== null && _j !== void 0 ? _j : b.gap) !== null && _k !== void 0 ? _k : config.columnGap) !== null && _l !== void 0 ? _l : config.gap) !== null && _m !== void 0 ? _m : 0,
            };
        })
            .sort((a, b) => a.maxWidth - b.maxWidth);
        breakpoints.push({
            name: 'default',
            maxWidth: Infinity,
            columns: (_b = config.columns) !== null && _b !== void 0 ? _b : defaultColumns,
            rowHeight: (_c = config.rowHeight) !== null && _c !== void 0 ? _c : defaultRowHeight,
            rowGap: (_e = (_d = config.rowGap) !== null && _d !== void 0 ? _d : config.gap) !== null && _e !== void 0 ? _e : 0,
            columnGap: (_g = (_f = config.columnGap) !== null && _f !== void 0 ? _f : config.gap) !== null && _g !== void 0 ? _g : 0,
        });
        return breakpoints;
    }
    static renderLayout(container, layout, config) {
        const { columns, columnGap, rowGap, rowHeight } = config;
        const containerWidth = container.offsetWidth;
        const columnWidth = this.getColumnWidth(containerWidth, columns, columnGap);
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
    static getColumnWidth(containerWidth, columns, columnGap) {
        return (containerWidth - (columns - 1) * columnGap) / columns;
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
    static moveItems(layout, columns, selection, deltaX, deltaY) {
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
                    out[i] = Object.assign(Object.assign({}, item), { x, y });
                }
            }
        }
        if (out === layout)
            return layout;
        return this.repairLayout(out, columns, selection);
    }
    /**
     * Resizes the specified item (in grid units).
     * Returns a new layout if modified.
     */
    static resizeItems(layout, columns, selection, deltaX, deltaY, handle) {
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
                    out[i] = Object.assign(Object.assign({}, item), { x, y, w, h });
                }
            }
        }
        if (out === layout)
            return layout;
        return this.repairLayout(out, columns, selection);
    }
    /**
     * Fixes overlaps, gaps, and layout out of bounds.
     * Returns a new layout if there was anything to repair.
     */
    static repairLayout(layout, columns, selection) {
        // Sort by row first, selection second (if any), column third.
        // TODO Considering overlap when selected might yield even better behavior?
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
GridLayout.RESIZE_THRESHOLD = 10;
GridLayout.TAP_DELAY = 250;
GridLayout.TAP_THRESHOLD = 10;
GridLayout.DRAG_THRESHOLD = 7;
function setsAreEqual(a, b) {
    if (a === b)
        return true;
    if (a.size !== b.size)
        return false;
    for (const a_ of a) {
        if (!b.has(a_))
            return false;
    }
    return true;
}
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW1GQSxNQUFNLE9BQU8sVUFBVTtJQW9DckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBaENsRCxZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUMsQ0FBQyw2QkFBNkI7UUFHNUUsYUFBUSxHQUFHLEtBQUssQ0FBQztRQUNqQix5QkFBb0IsR0FBeUIsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO1FBQ3RELDRCQUF1QixHQUE0QixHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUM7UUFFNUQsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFHOUIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUViLGFBQVEsR0FBRyxLQUFLLENBQUM7UUFDakIsaUJBQVksR0FBRyxLQUFLLENBQUM7UUFFckIsb0JBQWUsR0FBRyxLQUFLLENBQUM7UUFDeEIsZUFBVSxHQUFHLElBQUksQ0FBQztRQUNsQixrQkFBYSxHQUFHLElBQUksQ0FBQztRQUNyQixhQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ2hCLHNCQUFpQixHQUFHLElBQUksT0FBTyxFQUd0QyxDQUFDO1FBR00sT0FBRSxHQUFHLElBQUksQ0FBQyxXQUFnQyxDQUFDO1FBeWQzQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxtQkFB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QVksQ0FBSSxDQUFTLEVBQUUsQ0FBUztJQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDekIsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxJQUFJO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFcEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFBRSxPQUFPLEtBQUssQ0FBQztJQUMvQixDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsU0FBUyxLQUFLLENBQUMsS0FBYSxFQUFFLEdBQVcsRUFBRSxHQUFXO0lBQ3BELElBQUksS0FBSyxHQUFHLEdBQUc7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUM1QixJQUFJLEtBQUssR0FBRyxHQUFHO1FBQUUsT0FBTyxHQUFHLENBQUM7SUFDNUIsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDbEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb25maWcge1xuICAvKipcbiAgICogTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IDEyXG4gICAqL1xuICBjb2x1bW5zPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIZWlnaHQgb2YgZWFjaCByb3cgaW4gcGl4ZWxzLlxuICAgKlxuICAgKiBAZGVmYXVsdCAzMFxuICAgKi9cbiAgcm93SGVpZ2h0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBEZWZhdWx0IGdhcCBiZXR3ZWVuIGdyaWQgY2VsbHMgKGFwcGxpZXMgdG8gYm90aCByb3dzIGFuZCBjb2x1bW5zIGlmIG5vIG92ZXJyaWRlcyBhcmUgZ2l2ZW4pLlxuICAgKlxuICAgKiBAZGVmYXVsdCAwXG4gICAqL1xuICBnYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEhvcml6b250YWwgZ2FwIGJldHdlZW4gZ3JpZCBjb2x1bW5zIGluIHBpeGVscy5cbiAgICogT3ZlcnJpZGVzIGBnYXBgIGlmIHNwZWNpZmllZC5cbiAgICpcbiAgICogQGRlZmF1bHQgZ2FwXG4gICAqL1xuICBjb2x1bW5HYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFZlcnRpY2FsIGdhcCBiZXR3ZWVuIGdyaWQgcm93cyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgcm93R2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBSZXNwb25zaXZlIGJyZWFrcG9pbnQgY29uZmlncy5cbiAgICovXG4gIGJyZWFrcG9pbnRzPzogeyBbbmFtZTogc3RyaW5nXTogR3JpZExheW91dEJyZWFrcG9pbnQgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0QnJlYWtwb2ludFxuICBleHRlbmRzIE9taXQ8R3JpZExheW91dENvbmZpZywgJ2JyZWFrcG9pbnRzJz4ge1xuICAvKipcbiAgICogTWF4aW11bSBjb250YWluZXIgd2lkdGggZm9yIHRoaXMgYnJlYWtwb2ludC5cbiAgICovXG4gIG1heFdpZHRoOiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIExheW91dENoYW5nZUNhbGxiYWNrID0gKFxuICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gIGJyZWFrcG9pbnQ6IHN0cmluZyxcbikgPT4gdm9pZDtcblxuZXhwb3J0IHR5cGUgU2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sgPSAoc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikgPT4gdm9pZDtcblxuZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0SXRlbSB7XG4gIGk6IHN0cmluZztcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHc6IG51bWJlcjtcbiAgaDogbnVtYmVyO1xuICBtaW5XPzogbnVtYmVyO1xuICBtaW5IPzogbnVtYmVyO1xuICBtYXhXPzogbnVtYmVyO1xuICBtYXhIPzogbnVtYmVyO1xuICBzdGF0aWM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnQge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1heFdpZHRoOiBudW1iZXI7XG4gIGNvbHVtbnM6IG51bWJlcjtcbiAgcm93SGVpZ2h0OiBudW1iZXI7XG4gIGNvbHVtbkdhcDogbnVtYmVyO1xuICByb3dHYXA6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgUmVzaXplSGFuZGxlID0gJ24nIHwgJ2UnIHwgJ3MnIHwgJ3cnIHwgJ25lJyB8ICdzZScgfCAnc3cnIHwgJ253JztcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcm90ZWN0ZWQgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcldpZHRoOiBudW1iZXI7XG4gIHByb3RlY3RlZCBicmVha3BvaW50czogR3JpZExheW91dENvbXBpbGVkQnJlYWtwb2ludFtdO1xuICBwcm90ZWN0ZWQgbGF5b3V0cyA9IG5ldyBNYXA8c3RyaW5nLCBHcmlkTGF5b3V0SXRlbVtdPigpOyAvLyBNYXBwZWQgYnkgYnJlYWtwb2ludCBuYW1lLlxuICBwcm90ZWN0ZWQgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyO1xuXG4gIHByb3RlY3RlZCBlZGl0YWJsZSA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgbGF5b3V0Q2hhbmdlQ2FsbGJhY2s6IExheW91dENoYW5nZUNhbGxiYWNrID0gKCkgPT4ge307XG4gIHByb3RlY3RlZCBzZWxlY3Rpb25DaGFuZ2VDYWxsYmFjazogU2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sgPSAoKSA9PiB7fTtcblxuICBwcm90ZWN0ZWQgc2VsZWN0aW9uID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByb3RlY3RlZCByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGU7XG5cbiAgcHJvdGVjdGVkIGRyYWdQb2ludGVySWQgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0VGltZSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0tleT86IHN0cmluZztcbiAgcHJvdGVjdGVkIGRyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBwcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICBwcm90ZWN0ZWQgcmVuZGVyUmVxdWVzdGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBsYXlvdXRGbGFnID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIHNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgbWV0YUZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgbWFuaXB1bGF0aW9uQ2FjaGUgPSBuZXcgV2Vha01hcDxcbiAgICBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtW10+XG4gID4oKTtcbiAgcHJvdGVjdGVkIGxhc3RMYXlvdXRUb1JlbmRlcj86IEdyaWRMYXlvdXRJdGVtW107XG5cbiAgcHJvdGVjdGVkIGZuID0gdGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgR3JpZExheW91dDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLmNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLm9mZnNldFdpZHRoO1xuICAgIHRoaXMuYnJlYWtwb2ludHMgPSB0aGlzLmZuLmNvbXBpbGVCcmVha3BvaW50cyhjb25maWcpO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4gdGhpcy5oYW5kbGVSZXNpemUoKSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci5vYnNlcnZlKHRoaXMuY29udGFpbmVyKTtcblxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIHNldENvbmZpZyhjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICB0aGlzLmJyZWFrcG9pbnRzID0gdGhpcy5mbi5jb21waWxlQnJlYWtwb2ludHMoY29uZmlnKTtcblxuICAgIGZvciAoY29uc3QgW25hbWUsIGxheW91dF0gb2YgdGhpcy5sYXlvdXRzKSB7XG4gICAgICBjb25zdCBicmVha3BvaW50ID0gdGhpcy5nZXRCcmVha3BvaW50KG5hbWUpO1xuICAgICAgY29uc3QgcmVwYWlyZWQgPSB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIGJyZWFrcG9pbnQuY29sdW1ucyk7XG5cbiAgICAgIGlmIChyZXBhaXJlZCAhPT0gbGF5b3V0KSB7XG4gICAgICAgIHRoaXMubGF5b3V0cy5zZXQoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIGJyZWFrcG9pbnQuY29sdW1ucyksXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMubGF5b3V0Q2hhbmdlQ2FsbGJhY2sobGF5b3V0LCBicmVha3BvaW50Lm5hbWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHNldExheW91dChsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sIGJyZWFrcG9pbnQ/OiBzdHJpbmcpIHtcbiAgICBjb25zdCBiID0gdGhpcy5nZXRCcmVha3BvaW50KGJyZWFrcG9pbnQpO1xuICAgIGNvbnN0IGJlZm9yZSA9IHRoaXMubGF5b3V0cy5nZXQoYi5uYW1lKTtcblxuICAgIGlmIChsYXlvdXQgPT09IGJlZm9yZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5sYXlvdXRzLnNldChiLm5hbWUsIHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgYi5jb2x1bW5zKSk7XG4gICAgdGhpcy5sYXlvdXRDaGFuZ2VDYWxsYmFjayhsYXlvdXQsIGIubmFtZSk7XG5cbiAgICAvLyBBdXRvLWdlbmVyYXRlIG1pc3NpbmcgbGF5b3V0cy5cbiAgICBmb3IgKGNvbnN0IGIyIG9mIHRoaXMuYnJlYWtwb2ludHMpIHtcbiAgICAgIGlmICghdGhpcy5sYXlvdXRzLmhhcyhiMi5uYW1lKSkge1xuICAgICAgICB0aGlzLmxheW91dHMuc2V0KGIyLm5hbWUsIHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgYjIuY29sdW1ucykpO1xuICAgICAgICB0aGlzLmxheW91dENoYW5nZUNhbGxiYWNrKGxheW91dCwgYjIubmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHNldEVkaXRhYmxlKGVkaXRhYmxlOiBib29sZWFuKSB7XG4gICAgdGhpcy5lZGl0YWJsZSA9IGVkaXRhYmxlO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIG9uTGF5b3V0Q2hhbmdlKGNhbGxiYWNrOiBMYXlvdXRDaGFuZ2VDYWxsYmFjaykge1xuICAgIHRoaXMubGF5b3V0Q2hhbmdlQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgfVxuXG4gIG9uU2VsZWN0aW9uQ2hhbmdlKGNhbGxiYWNrOiBTZWxlY3Rpb25DaGFuZ2VDYWxsYmFjaykge1xuICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sgPSBjYWxsYmFjaztcbiAgfVxuXG4gIHNldFNlbGVjdGlvbihzZWxlY3Rpb246IFNldDxzdHJpbmc+KSB7XG4gICAgaWYgKHNldHNBcmVFcXVhbChzZWxlY3Rpb24sIHRoaXMuc2VsZWN0aW9uKSkgcmV0dXJuO1xuXG4gICAgdGhpcy5zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG4gICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VDYWxsYmFjayh0aGlzLnNlbGVjdGlvbik7XG5cbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgdG9nZ2xlU2VsZWN0aW9uKGtleTogc3RyaW5nLCBleGNsdXNpdmUgPSBmYWxzZSkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5oYXMoa2V5KSkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVsZXRlKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChleGNsdXNpdmUpIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZWxlY3Rpb24uYWRkKGtleSk7XG4gICAgfVxuXG4gICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VDYWxsYmFjayh0aGlzLnNlbGVjdGlvbik7XG5cbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgY2xlYXJTZWxlY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uLnNpemUgPiAwKSB7XG4gICAgICB0aGlzLnNlbGVjdGlvbi5jbGVhcigpO1xuICAgICAgdGhpcy5zZWxlY3Rpb25DaGFuZ2VDYWxsYmFjayh0aGlzLnNlbGVjdGlvbik7XG5cbiAgICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICBnZXRCcmVha3BvaW50KG5hbWU/OiBzdHJpbmcpIHtcbiAgICBjb25zdCBicmVha3BvaW50cyA9IHRoaXMuYnJlYWtwb2ludHM7XG5cbiAgICBpZiAobmFtZSkge1xuICAgICAgY29uc3QgYnJlYWtwb2ludCA9IGJyZWFrcG9pbnRzLmZpbmQoKGl0KSA9PiBpdC5uYW1lID09PSBuYW1lKTtcblxuICAgICAgaWYgKGJyZWFrcG9pbnQpIHJldHVybiBicmVha3BvaW50O1xuICAgIH1cblxuICAgIHJldHVybiBicmVha3BvaW50cy5maW5kKFxuICAgICAgKGl0KSA9PiBpdC5tYXhXaWR0aCA+PSB0aGlzLmNvbnRhaW5lcldpZHRoLFxuICAgICkgYXMgR3JpZExheW91dENvbXBpbGVkQnJlYWtwb2ludDtcbiAgfVxuXG4gIC8vXG5cbiAgcmVxdWVzdFJlbmRlcigpIHtcbiAgICBpZiAoIXRoaXMucmVuZGVyUmVxdWVzdGVkKSB7XG4gICAgICB0aGlzLnJlbmRlclJlcXVlc3RlZCA9IHRydWU7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gdGhpcy5yZW5kZXIoKSk7XG4gICAgfVxuICB9XG5cbiAgcmVuZGVyKCkge1xuICAgIHRoaXMucmVuZGVyUmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICBjb25zdCBicmVha3BvaW50ID0gdGhpcy5nZXRCcmVha3BvaW50KCk7XG4gICAgY29uc3QgbGF5b3V0VG9SZW5kZXIgPSB0aGlzLmdldE5leHRMYXlvdXQoKTtcblxuICAgIGlmICh0aGlzLmxheW91dEZsYWcgfHwgbGF5b3V0VG9SZW5kZXIgIT09IHRoaXMubGFzdExheW91dFRvUmVuZGVyKSB7XG4gICAgICB0aGlzLmZuLnJlbmRlckxheW91dCh0aGlzLmNvbnRhaW5lciwgbGF5b3V0VG9SZW5kZXIsIGJyZWFrcG9pbnQpO1xuICAgICAgdGhpcy5sYXlvdXRGbGFnID0gZmFsc2U7XG4gICAgICB0aGlzLmxhc3RMYXlvdXRUb1JlbmRlciA9IGxheW91dFRvUmVuZGVyO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlbGVjdGlvbkZsYWcpIHtcbiAgICAgIHRoaXMucmVuZGVyU2VsZWN0aW9uKCk7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tZXRhRmxhZykge1xuICAgICAgdGhpcy5yZW5kZXJNZXRhKCk7XG4gICAgICB0aGlzLm1ldGFGbGFnID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJlbmRlclNlbGVjdGlvbigpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY29udGFpbmVyLmNoaWxkcmVuO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBjaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgdGhpcy5zZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkgYXMgc3RyaW5nKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyTWV0YSgpIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lciwgZWRpdGFibGUsIGRyYWdnaW5nLCByZXNpemVIYW5kbGUgfSA9IHRoaXM7XG5cbiAgICBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnLWVkaXRhYmxlJywgZWRpdGFibGUpO1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctbW92aW5nJywgZHJhZ2dpbmcgJiYgIXJlc2l6ZUhhbmRsZSk7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1yZXNpemluZycsIGRyYWdnaW5nICYmICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IHJvb3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19oaWRlLXNlbGVjdGlvbicsIGRyYWdnaW5nKTtcbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19mb3JjZS1jdXJzb3InLCAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmZuLmdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGUpO1xuXG4gICAgaWYgKHJvb3Quc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1mb3JjZS1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZvcmNlLWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBwcm90ZWN0ZWQgZ2V0TmV4dExheW91dCgpIHtcbiAgICBjb25zdCBicmVha3BvaW50ID0gdGhpcy5nZXRCcmVha3BvaW50KCk7XG4gICAgY29uc3QgbGF5b3V0ID0gdGhpcy5sYXlvdXRzLmdldChicmVha3BvaW50Lm5hbWUpO1xuXG4gICAgaWYgKCFsYXlvdXQpIHJldHVybiBbXTtcbiAgICBpZiAoIXRoaXMuZHJhZ2dpbmcpIHJldHVybiBsYXlvdXQ7XG5cbiAgICBjb25zdCBkcmFnWCA9IHRoaXMuZHJhZ0VuZFggLSB0aGlzLmRyYWdTdGFydFg7XG4gICAgY29uc3QgZHJhZ1kgPSB0aGlzLmRyYWdFbmRZIC0gdGhpcy5kcmFnU3RhcnRZO1xuXG4gICAgY29uc3QgY29sdW1uV2lkdGggPSB0aGlzLmZuLmdldENvbHVtbldpZHRoKFxuICAgICAgdGhpcy5jb250YWluZXJXaWR0aCxcbiAgICAgIGJyZWFrcG9pbnQuY29sdW1ucyxcbiAgICAgIGJyZWFrcG9pbnQuY29sdW1uR2FwLFxuICAgICk7XG4gICAgY29uc3QgY29sdW1uV2lkdGhBbmRHYXAgPSBjb2x1bW5XaWR0aCArIGJyZWFrcG9pbnQuY29sdW1uR2FwO1xuICAgIGNvbnN0IHJvd0hlaWdodEFuZEdhcCA9IGJyZWFrcG9pbnQucm93SGVpZ2h0ICsgYnJlYWtwb2ludC5yb3dHYXA7XG5cbiAgICBjb25zdCBkZWx0YVggPSByb3VuZChkcmFnWCAvIGNvbHVtbldpZHRoQW5kR2FwKTtcbiAgICBjb25zdCBkZWx0YVkgPSByb3VuZChkcmFnWSAvIHJvd0hlaWdodEFuZEdhcCk7XG5cbiAgICBpZiAoZGVsdGFYID09PSAwICYmIGRlbHRhWSA9PT0gMCkgcmV0dXJuIGxheW91dDtcblxuICAgIGxldCBjYWNoZUZvckxheW91dCA9IHRoaXMubWFuaXB1bGF0aW9uQ2FjaGUuZ2V0KGxheW91dCk7XG5cbiAgICBpZiAoIWNhY2hlRm9yTGF5b3V0KSB7XG4gICAgICBjYWNoZUZvckxheW91dCA9IG5ldyBNYXAoKTtcbiAgICAgIHRoaXMubWFuaXB1bGF0aW9uQ2FjaGUuc2V0KGxheW91dCwgY2FjaGVGb3JMYXlvdXQpO1xuICAgIH1cblxuICAgIGNvbnN0IGNhY2hlS2V5ID0gYCR7QXJyYXkuZnJvbSh0aGlzLnNlbGVjdGlvbikuam9pbignLCcpfUAke2RlbHRhWH0sJHtkZWx0YVl9QCR7dGhpcy5yZXNpemVIYW5kbGV9YDtcbiAgICBjb25zdCBjYWNoZWQgPSBjYWNoZUZvckxheW91dC5nZXQoY2FjaGVLZXkpO1xuXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcblxuICAgIGNvbnN0IG91dCA9IHRoaXMucmVzaXplSGFuZGxlXG4gICAgICA/IHRoaXMuZm4ucmVzaXplSXRlbXMoXG4gICAgICAgICAgbGF5b3V0LFxuICAgICAgICAgIGJyZWFrcG9pbnQuY29sdW1ucyxcbiAgICAgICAgICB0aGlzLnNlbGVjdGlvbixcbiAgICAgICAgICBkZWx0YVgsXG4gICAgICAgICAgZGVsdGFZLFxuICAgICAgICAgIHRoaXMucmVzaXplSGFuZGxlLFxuICAgICAgICApXG4gICAgICA6IHRoaXMuZm4ubW92ZUl0ZW1zKFxuICAgICAgICAgIGxheW91dCxcbiAgICAgICAgICBicmVha3BvaW50LmNvbHVtbnMsXG4gICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgZGVsdGFYLFxuICAgICAgICAgIGRlbHRhWSxcbiAgICAgICAgKTtcblxuICAgIGNhY2hlRm9yTGF5b3V0LnNldChjYWNoZUtleSwgb3V0KTtcblxuICAgIHJldHVybiBvdXQ7XG4gIH1cblxuICAvL1xuXG4gIHByb3RlY3RlZCBoYW5kbGVSZXNpemUoKSB7XG4gICAgdGhpcy5jb250YWluZXJXaWR0aCA9IHRoaXMuY29udGFpbmVyLm9mZnNldFdpZHRoO1xuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZURvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5kcmFnU3RhcnRYID0gdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnU3RhcnRZID0gdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gdGhpcy5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCBlKTtcbiAgICAgIHRoaXMuZHJhZ0tleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSAhPT0gJ21vdXNlJykgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG5cbiAgICBpZiAoIXRoaXMuZHJhZ0tleSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSBlbGVtZW50XG4gICAgICAgID8gdGhpcy5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCBlKVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICAhdGhpcy5kcmFnZ2luZyAmJlxuICAgICAgdGhpcy5kcmFnS2V5ICYmXG4gICAgICAoYWJzKHRoaXMuZHJhZ0VuZFggLSB0aGlzLmRyYWdTdGFydFgpID4gdGhpcy5mbi5EUkFHX1RIUkVTSE9MRCB8fFxuICAgICAgICBhYnModGhpcy5kcmFnRW5kWSAtIHRoaXMuZHJhZ1N0YXJ0WSkgPiB0aGlzLmZuLkRSQUdfVEhSRVNIT0xEKVxuICAgICkge1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG5cbiAgICAgIGlmICghdGhpcy5zZWxlY3Rpb24uaGFzKHRoaXMuZHJhZ0tleSkgfHwgdGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgICAgdGhpcy5zZXRTZWxlY3Rpb24obmV3IFNldCh0aGlzLmRyYWdLZXkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlTW91c2VVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSAhPT0gJ21vdXNlJyB8fCBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuXG4gICAgdGhpcy5zZXRMYXlvdXQodGhpcy5nZXROZXh0TGF5b3V0KCkpO1xuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlckRvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAodGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdQb2ludGVySWQgPSBlLnBvaW50ZXJJZDtcbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSAmJiB0aGlzLnNlbGVjdGlvbi5oYXMoZWxlbWVudC5kYXRhc2V0LmtleSkpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSB0aGlzLmNoZWNrUmVzaXplSGFuZGxlKGVsZW1lbnQsIGUpO1xuXG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlck1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG5cbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyVXAoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5kcmFnU3RhcnRUaW1lID4gRGF0ZS5ub3coKSAtIHRoaXMuZm4uVEFQX0RFTEFZICYmXG4gICAgICBhYnModGhpcy5kcmFnRW5kWCAtIHRoaXMuZHJhZ1N0YXJ0WCkgPCB0aGlzLmZuLlRBUF9USFJFU0hPTEQgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRZIC0gdGhpcy5kcmFnU3RhcnRZKSA8IHRoaXMuZm4uVEFQX1RIUkVTSE9MRFxuICAgICkge1xuICAgICAgLy8gSXQncyBhIHRhcC5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5LCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXRMYXlvdXQodGhpcy5nZXROZXh0TGF5b3V0KCkpO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMucHJldmVudENsaWNrKSB7XG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IGZhbHNlO1xuXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIWUuY3RybEtleSAmJiAhZS5tZXRhS2V5KSB7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVLZXlVcChlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKGUua2V5KSB7XG4gICAgICBjYXNlICdFc2NhcGUnOlxuICAgICAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG4gICAgICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCByZXNldERyYWcoKSB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGlvbiA9IChkb2N1bWVudC5kZWZhdWx0VmlldyB8fCB3aW5kb3cpLmdldFNlbGVjdGlvbigpO1xuXG4gICAgICAgIGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLnR5cGUgIT09ICdDYXJldCcpIHtcbiAgICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBpZ25vcmVcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuZHJhZ1BvaW50ZXJJZCA9IDA7XG4gICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhZ0tleSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXRUYXJnZXRFbGVtZW50KGU6IEV2ZW50KSB7XG4gICAgaWYgKGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgY29uc3QgaXRlbSA9IGUudGFyZ2V0LmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCcuZmFzdC1ncmlkLWxheW91dCA+IC5pdGVtJyk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXN0YXRpYycpKSByZXR1cm47XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXNlbGVjdGVkJykpIHJldHVybiBpdGVtO1xuXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBlLnRhcmdldC5jbG9zZXN0PEhUTUxFbGVtZW50PihcbiAgICAgICAgICAnLmZhc3QtZ3JpZC1sYXlvdXQgLmNvbnRlbnQsIGJ1dHRvbiwgaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghY29udGVudCkgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGNoZWNrUmVzaXplSGFuZGxlKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBldmVudDogUG9pbnRlckV2ZW50KSB7XG4gICAgY29uc3QgaGFuZGxlID0gdGhpcy5mbi5jaGVja1Jlc2l6ZUhhbmRsZShcbiAgICAgIGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICBldmVudC5jbGllbnRYLFxuICAgICAgZXZlbnQuY2xpZW50WSxcbiAgICAgIHRoaXMuZm4uUkVTSVpFX1RIUkVTSE9MRCxcbiAgICApO1xuXG4gICAgc3dpdGNoIChoYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgY2FzZSAnbmUnOlxuICAgICAgY2FzZSAnbncnOlxuICAgICAgICAvLyBEaXNhYmxlIG5vcnRoIGhhbmRsZXMgZm9yIG5vdywgYXMgaXQgZmVlbHMgdW5uYXR1cmFsLlxuICAgICAgICAvLyBUT0RPIG1ha2UgY29uZmlndXJhYmxlP1xuICAgICAgICByZXR1cm47XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cbiAgfVxuXG4gIC8vXG5cbiAgZGlzY29ubmVjdCgpIHtcbiAgICB0aGlzLnNlbGVjdGlvbiA9IG5ldyBTZXQoKTtcbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICAgIHRoaXMucmVuZGVyU2VsZWN0aW9uKCk7XG4gICAgdGhpcy5yZW5kZXJNZXRhKCk7XG5cbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLnVub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZURvd24gPSB0aGlzLmhhbmRsZU1vdXNlRG93bi5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlTW92ZSA9IHRoaXMuaGFuZGxlTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VVcCA9IHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlckRvd24gPSB0aGlzLmhhbmRsZVBvaW50ZXJEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlck1vdmUgPSB0aGlzLmhhbmRsZVBvaW50ZXJNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlclVwID0gdGhpcy5oYW5kbGVQb2ludGVyVXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgX2hhbmRsZUNsaWNrID0gdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZUtleVVwID0gdGhpcy5oYW5kbGVLZXlVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZU1vdXNlRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlTW91c2VNb3ZlLCBQQVNTSVZFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcblxuICAgIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlUG9pbnRlckRvd24pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZVBvaW50ZXJNb3ZlLCBQQVNTSVZFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9oYW5kbGVDbGljaywgQ0FQVFVSRSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgcHJvdGVjdGVkIHJlbW92ZUV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCBDQVBUVVJFKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICAvL1xuXG4gIHN0YXRpYyBSRVNJWkVfVEhSRVNIT0xEID0gMTA7XG4gIHN0YXRpYyBUQVBfREVMQVkgPSAyNTA7XG4gIHN0YXRpYyBUQVBfVEhSRVNIT0xEID0gMTA7XG4gIHN0YXRpYyBEUkFHX1RIUkVTSE9MRCA9IDc7XG5cbiAgc3RhdGljIGNvbXBpbGVCcmVha3BvaW50cyhcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICk6IEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnRbXSB7XG4gICAgY29uc3QgZGVmYXVsdENvbHVtbnMgPSAxMjtcbiAgICBjb25zdCBkZWZhdWx0Um93SGVpZ2h0ID0gMzA7XG5cbiAgICBjb25zdCBicmVha3BvaW50cyA9IE9iamVjdC5lbnRyaWVzKGNvbmZpZy5icmVha3BvaW50cyA/PyB7fSlcbiAgICAgIC5tYXAoKFtuYW1lLCBiXSkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgbWF4V2lkdGg6IGIubWF4V2lkdGgsXG4gICAgICAgICAgY29sdW1uczogYi5jb2x1bW5zID8/IGNvbmZpZy5jb2x1bW5zID8/IGRlZmF1bHRDb2x1bW5zLFxuICAgICAgICAgIHJvd0hlaWdodDogYi5yb3dIZWlnaHQgPz8gY29uZmlnLnJvd0hlaWdodCA/PyBkZWZhdWx0Um93SGVpZ2h0LFxuICAgICAgICAgIHJvd0dhcDogYi5yb3dHYXAgPz8gYi5nYXAgPz8gY29uZmlnLnJvd0dhcCA/PyBjb25maWcuZ2FwID8/IDAsXG4gICAgICAgICAgY29sdW1uR2FwOlxuICAgICAgICAgICAgYi5jb2x1bW5HYXAgPz8gYi5nYXAgPz8gY29uZmlnLmNvbHVtbkdhcCA/PyBjb25maWcuZ2FwID8/IDAsXG4gICAgICAgIH07XG4gICAgICB9KVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEubWF4V2lkdGggLSBiLm1heFdpZHRoKTtcblxuICAgIGJyZWFrcG9pbnRzLnB1c2goe1xuICAgICAgbmFtZTogJ2RlZmF1bHQnLFxuICAgICAgbWF4V2lkdGg6IEluZmluaXR5LFxuICAgICAgY29sdW1uczogY29uZmlnLmNvbHVtbnMgPz8gZGVmYXVsdENvbHVtbnMsXG4gICAgICByb3dIZWlnaHQ6IGNvbmZpZy5yb3dIZWlnaHQgPz8gZGVmYXVsdFJvd0hlaWdodCxcbiAgICAgIHJvd0dhcDogY29uZmlnLnJvd0dhcCA/PyBjb25maWcuZ2FwID8/IDAsXG4gICAgICBjb2x1bW5HYXA6IGNvbmZpZy5jb2x1bW5HYXAgPz8gY29uZmlnLmdhcCA/PyAwLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGJyZWFrcG9pbnRzO1xuICB9XG5cbiAgc3RhdGljIHJlbmRlckxheW91dChcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnQsXG4gICkge1xuICAgIGNvbnN0IHsgY29sdW1ucywgY29sdW1uR2FwLCByb3dHYXAsIHJvd0hlaWdodCB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSB0aGlzLmdldENvbHVtbldpZHRoKGNvbnRhaW5lcldpZHRoLCBjb2x1bW5zLCBjb2x1bW5HYXApO1xuICAgIGNvbnN0IGNvbHVtbldpZHRoQW5kR2FwID0gY29sdW1uV2lkdGggKyBjb2x1bW5HYXA7XG4gICAgY29uc3Qgcm93SGVpZ2h0QW5kR2FwID0gcm93SGVpZ2h0ICsgcm93R2FwO1xuXG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2Zhc3QtZ3JpZC1sYXlvdXQnKTtcblxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBHcmlkTGF5b3V0SXRlbT4oKTtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcbiAgICAgIG1hcC5zZXQoaXRlbS5pLCBpdGVtKTtcbiAgICB9XG5cbiAgICBsZXQgaE1heCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBjb250YWluZXIuY2hpbGRyZW5baV07XG5cbiAgICAgIGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgICAgLy8gVE9ETyB3YXJuaW5nP1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFlbGVtZW50LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIGVsZW1lbnQuZGF0YXNldC5rZXkgPSBpLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGtleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgICBjb25zdCBpdGVtID0gbWFwLmdldChrZXkpO1xuXG4gICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgLy8gVE9ETyB3YXJuaW5nP1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpdGVtJyk7XG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJy1keW5hbWljJywgIWl0ZW0uc3RhdGljKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnLXN0YXRpYycsICEhaXRlbS5zdGF0aWMpO1xuXG4gICAgICBjb25zdCBoID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBpZiAoaCA+IGhNYXgpIHtcbiAgICAgICAgaE1heCA9IGg7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHdpZHRoID0gcm91bmQoaXRlbS53ICogY29sdW1uV2lkdGhBbmRHYXAgLSBjb2x1bW5HYXApICsgJ3B4JztcbiAgICAgIGNvbnN0IGhlaWdodCA9IHJvdW5kKGl0ZW0uaCAqIHJvd0hlaWdodEFuZEdhcCAtIHJvd0dhcCkgKyAncHgnO1xuICAgICAgY29uc3QgdHJhbnNmb3JtID1cbiAgICAgICAgJ3RyYW5zbGF0ZSgnICtcbiAgICAgICAgcm91bmQoaXRlbS54ICogY29sdW1uV2lkdGhBbmRHYXApICtcbiAgICAgICAgJ3B4LCAnICtcbiAgICAgICAgcm91bmQoaXRlbS55ICogcm93SGVpZ2h0QW5kR2FwKSArXG4gICAgICAgICdweCknO1xuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS53aWR0aCAhPT0gd2lkdGgpIHtcbiAgICAgICAgZWxlbWVudC5zdHlsZS53aWR0aCA9IHdpZHRoO1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS5oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLmhlaWdodCA9IGhlaWdodDtcbiAgICAgIH1cblxuICAgICAgaWYgKGVsZW1lbnQuc3R5bGUudHJhbnNmb3JtICE9PSB0cmFuc2Zvcm0pIHtcbiAgICAgICAgZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gPSB0cmFuc2Zvcm07XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gcm91bmQoaE1heCAqIHJvd0hlaWdodEFuZEdhcCAtIHJvd0dhcCkgKyAncHgnO1xuXG4gICAgaWYgKGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgIT09IGNvbnRhaW5lckhlaWdodCkge1xuICAgICAgY29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGNvbnRhaW5lckhlaWdodDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgZ2V0Q29sdW1uV2lkdGgoXG4gICAgY29udGFpbmVyV2lkdGg6IG51bWJlcixcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgY29sdW1uR2FwOiBudW1iZXIsXG4gICkge1xuICAgIHJldHVybiAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gIH1cblxuICBzdGF0aWMgY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgY2xpZW50UmVjdDogRE9NUmVjdCxcbiAgICBjbGllbnRYOiBudW1iZXIsXG4gICAgY2xpZW50WTogbnVtYmVyLFxuICAgIHRocmVzaG9sZDogbnVtYmVyLFxuICApOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IG4gPSBjbGllbnRZIC0gY2xpZW50UmVjdC50b3AgPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgZSA9IGNsaWVudFJlY3QucmlnaHQgLSBjbGllbnRYIDwgdGhyZXNob2xkO1xuICAgIGNvbnN0IHMgPSBjbGllbnRSZWN0LmJvdHRvbSAtIGNsaWVudFkgPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgdyA9IGNsaWVudFggLSBjbGllbnRSZWN0LmxlZnQgPCB0aHJlc2hvbGQ7XG5cbiAgICBpZiAocykge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuICdzZSc7XG4gICAgICB9IGVsc2UgaWYgKHcpIHtcbiAgICAgICAgcmV0dXJuICdzdyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3MnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZSkge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgcmV0dXJuICduZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgcmV0dXJuICdudyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3cnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobikge1xuICAgICAgcmV0dXJuICduJztcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgZ2V0UmVzaXplQ3Vyc29yKHJlc2l6ZUhhbmRsZTogUmVzaXplSGFuZGxlIHwgdW5kZWZpbmVkKSB7XG4gICAgc3dpdGNoIChyZXNpemVIYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgY2FzZSAncyc6XG4gICAgICAgIHJldHVybiAnbnMtcmVzaXplJztcbiAgICAgIGNhc2UgJ2UnOlxuICAgICAgY2FzZSAndyc6XG4gICAgICAgIHJldHVybiAnZXctcmVzaXplJztcbiAgICAgIGNhc2UgJ25lJzpcbiAgICAgIGNhc2UgJ3N3JzpcbiAgICAgICAgcmV0dXJuICduZXN3LXJlc2l6ZSc7XG4gICAgICBjYXNlICdzZSc6XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIHJldHVybiAnbndzZS1yZXNpemUnO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlcyB0aGUgc3BlY2lmaWVkIGl0ZW1zIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgbW92ZUl0ZW1zKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPixcbiAgICBkZWx0YVg6IG51bWJlcixcbiAgICBkZWx0YVk6IG51bWJlcixcbiAgKSB7XG4gICAgaWYgKChkZWx0YVggPT09IDAgJiYgZGVsdGFZID09PSAwKSB8fCBzZWxlY3Rpb24uc2l6ZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICBsZXQgb3V0ID0gbGF5b3V0O1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuXG4gICAgICBpZiAoc2VsZWN0aW9uLmhhcyhpdGVtLmkpKSB7XG4gICAgICAgIGNvbnN0IHggPSBpdGVtLnggKyBkZWx0YVg7XG4gICAgICAgIGNvbnN0IHkgPSBpdGVtLnkgKyBkZWx0YVk7XG5cbiAgICAgICAgaWYgKGl0ZW0ueCAhPT0geCB8fCBpdGVtLnkgIT09IHkpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5IH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3V0ID09PSBsYXlvdXQpIHJldHVybiBsYXlvdXQ7XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2l6ZXMgdGhlIHNwZWNpZmllZCBpdGVtIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgcmVzaXplSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGRlbHRhWDogbnVtYmVyLFxuICAgIGRlbHRhWTogbnVtYmVyLFxuICAgIGhhbmRsZTogUmVzaXplSGFuZGxlLFxuICApIHtcbiAgICBpZiAoKGRlbHRhWCA9PT0gMCAmJiBkZWx0YVkgPT09IDApIHx8IHNlbGVjdGlvbi5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeyBtYXhXID0gY29sdW1ucywgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgICAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuICAgICAgICBjb25zdCB4dyA9IHggKyB3O1xuICAgICAgICBjb25zdCB5aCA9IHkgKyBoO1xuICAgICAgICBjb25zdCBjeCA9IGNvbHVtbnMgLSB4O1xuXG4gICAgICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGRlbHRhWSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGRlbHRhWSwgMCwgeWggLSAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2UnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgKyBkZWx0YVgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncyc6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGRlbHRhWSwgMSwgbWF4SCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICd3JzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3IC0gZGVsdGFYLCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZGVsdGFYLCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbmUnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgKyBkZWx0YVgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICAgICAgaCA9IGNsYW1wKGggLSBkZWx0YVksIDEsIG1heEgpO1xuICAgICAgICAgICAgeSA9IGNsYW1wKHkgKyBkZWx0YVksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGRlbHRhWCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGRlbHRhWSwgMSwgbWF4SCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzdyc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyAtIGRlbHRhWCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGRlbHRhWSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB4ID0gY2xhbXAoeCArIGRlbHRhWCwgMCwgeHcgLSAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ253JzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3IC0gZGVsdGFYLCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoIC0gZGVsdGFZLCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZGVsdGFYLCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgeSA9IGNsYW1wKHkgKyBkZWx0YVksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnggIT09IHggfHwgaXRlbS55ICE9PSB5IHx8IGl0ZW0udyAhPT0gdyB8fCBpdGVtLmggIT09IGgpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3V0ID09PSBsYXlvdXQpIHJldHVybiBsYXlvdXQ7XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeGVzIG92ZXJsYXBzLCBnYXBzLCBhbmQgbGF5b3V0IG91dCBvZiBib3VuZHMuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlyTGF5b3V0KFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uPzogU2V0PHN0cmluZz4sXG4gICkge1xuICAgIC8vIFNvcnQgYnkgcm93IGZpcnN0LCBzZWxlY3Rpb24gc2Vjb25kIChpZiBhbnkpLCBjb2x1bW4gdGhpcmQuXG4gICAgLy8gVE9ETyBDb25zaWRlcmluZyBvdmVybGFwIHdoZW4gc2VsZWN0ZWQgbWlnaHQgeWllbGQgZXZlbiBiZXR0ZXIgYmVoYXZpb3I/XG4gICAgY29uc3Qgc29ydGVkSXRlbXMgPSBsYXlvdXQuc2xpY2UoMCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgaWYgKGEueSA8IGIueSkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEueSA+IGIueSkgcmV0dXJuIDE7XG5cbiAgICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoYS5pKSkge1xuICAgICAgICAgIGlmICghc2VsZWN0aW9uLmhhcyhiLmkpKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGlvbi5oYXMoYi5pKSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhLnggPCBiLngpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLnggPiBiLngpIHJldHVybiAxO1xuXG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0YXRpY0l0ZW1zID0gc29ydGVkSXRlbXMuZmlsdGVyKChpdGVtKSA9PiBpdGVtLnN0YXRpYyk7XG4gICAgY29uc3QgbnVtU3RhdGljcyA9IHN0YXRpY0l0ZW1zLmxlbmd0aDtcbiAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcbiAgICBsZXQgc3RhdGljT2Zmc2V0ID0gMDtcblxuICAgIC8vIFwiUmlzaW5nIHRpZGVcIiwgaS5lLiBudW1iZXIgb2YgYmxvY2tlZCBjZWxscyBwZXIgY29sdW1uLlxuICAgIGNvbnN0IHRpZGU6IG51bWJlcltdID0gQXJyYXkoY29sdW1ucyk7XG5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGNvbHVtbnM7ICsreCkge1xuICAgICAgdGlkZVt4XSA9IDA7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBzb3J0ZWRJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBhbGxvdyBpdGVtcyB0byBiZSBvdXQgb2YgYm91bmRzIGR1cmluZyBzb3J0aW5nLFxuICAgICAgLy8gd2hpY2ggKGZvciBleGFtcGxlKSBhbGxvd3MgbW92aW5nIGl0ZW1zIFwiYmVmb3JlXCIgdGhlIGZpcnN0IGl0ZW0uXG4gICAgICAvLyBXZSBmaXggYW55IG91dCBvZiBib3VuZCBpc3N1ZXMgaGVyZS5cbiAgICAgIGxldCBpdGVtID0gdGhpcy5yZXBhaXJJdGVtKHNvcnRlZEl0ZW1zW2ldLCBjb2x1bW5zKTtcbiAgICAgIGNvbnN0IHgyID0gaXRlbS54ICsgaXRlbS53O1xuXG4gICAgICBpZiAoaXRlbS5zdGF0aWMpIHtcbiAgICAgICAgLy8gVGhpcyBzdGF0aWMgaXRlbSB3aWxsIGJlIHBhcnQgb2YgdGhlIHRpZGVcbiAgICAgICAgLy8gYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgY29uc2lkZXJlZCBmb3IgY29sbGlzaW9uIGFueW1vcmUuXG4gICAgICAgIC8vIFNpbmNlIHN0YXRpYyBpdGVtIHdpbGwgYmUgdmlzaXRlZCBpbiB0aGUgc2FtZSBvcmRlclxuICAgICAgICAvLyBhcyB0aGUgc3RhdGljSXRlbXMgYXJyYXksIHdlIGNhbiBqdXN0IGluY3JlbWVudCB0aGUgb2Zmc2V0IGhlcmUuXG4gICAgICAgICsrc3RhdGljT2Zmc2V0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGV0ZWN0IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAgd2l0aCB0aWRlLlxuICAgICAgICBsZXQgbWluR2FwID0gSW5maW5pdHk7XG5cbiAgICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgICBjb25zdCBnYXAgPSBpdGVtLnkgLSB0aWRlW3hdO1xuXG4gICAgICAgICAgaWYgKGdhcCA8IG1pbkdhcCkge1xuICAgICAgICAgICAgbWluR2FwID0gZ2FwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpeCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwLlxuICAgICAgICBsZXQgeU5leHQgPSBpdGVtLnkgLSBtaW5HYXA7XG5cbiAgICAgICAgLy8gSGFuZGxlIGNvbGxpc2lvbiB3aXRoIHN0YXRpYyBpdGVtcy5cbiAgICAgICAgZm9yIChsZXQgaiA9IHN0YXRpY09mZnNldDsgaiA8IG51bVN0YXRpY3M7ICsraikge1xuICAgICAgICAgIGNvbnN0IHN0YXRpY0l0ZW0gPSBzdGF0aWNJdGVtc1tqXTtcblxuICAgICAgICAgIGlmIChzdGF0aWNJdGVtLnkgPj0geU5leHQgKyBpdGVtLmgpIHtcbiAgICAgICAgICAgIC8vIEZvbGxvd2luZyBzdGF0aWMgaXRlbXMgY2Fubm90IGNvbGxpZGUgYmVjYXVzZSBvZiBzb3J0aW5nOyBzdG9wLlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgLy9zdGF0aWNJdGVtLnkgPCB5TmV4dCArIGl0ZW0uaCAmJiAvLyBUaGlzIGlzIGltcGxpZWQgYWJvdmUuXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnkgKyBzdGF0aWNJdGVtLmggPiB5TmV4dCAmJlxuICAgICAgICAgICAgc3RhdGljSXRlbS54IDwgaXRlbS54ICsgaXRlbS53ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggKyBzdGF0aWNJdGVtLncgPiBpdGVtLnhcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIENvbGxpc2lvbiBkZXRlY3RlZDsgbW92ZSBjdXJyZW50IGl0ZW0gYmVsb3cgc3RhdGljIGl0ZW0uXG4gICAgICAgICAgICB5TmV4dCA9IHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaDtcblxuICAgICAgICAgICAgLy8gQ3VycmVudCBpdGVtIHdhcyBtb3ZlZDtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gcmVjaGVjayBjb2xsaXNpb24gd2l0aCBvdGhlciBzdGF0aWMgaXRlbXMuXG4gICAgICAgICAgICBqID0gc3RhdGljT2Zmc2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnkgIT09IHlOZXh0KSB7XG4gICAgICAgICAgaXRlbSA9IHsgLi4uaXRlbSwgeTogeU5leHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtICE9PSBzb3J0ZWRJdGVtc1tpXSkge1xuICAgICAgICAgIHNvcnRlZEl0ZW1zW2ldID0gaXRlbTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRpZGUuXG4gICAgICBjb25zdCB0ID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICBpZiAodGlkZVt4XSA8IHQpIHtcbiAgICAgICAgICB0aWRlW3hdID0gdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZCA/IHNvcnRlZEl0ZW1zIDogbGF5b3V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGFpciBib3VuZHMgb2YgdGhlIGdpdmVuIGl0ZW0gdG8gZml0IHRoZSBnaXZlbiBjb25maWcuXG4gICAqIFJldHVybnMgYSBuZXcgaXRlbSBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckl0ZW0oaXRlbTogR3JpZExheW91dEl0ZW0sIGNvbHVtbnM6IG51bWJlcikge1xuICAgIGNvbnN0IHsgbWluVyA9IDEsIG1heFcgPSBjb2x1bW5zLCBtaW5IID0gMSwgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgIGxldCB7IHgsIHksIHcsIGggfSA9IGl0ZW07XG5cbiAgICB3ID0gY2xhbXAodywgbWluVywgbWluKG1heFcsIGNvbHVtbnMpKTtcbiAgICBoID0gY2xhbXAoaCwgbWluSCwgbWF4SCk7XG4gICAgeCA9IGNsYW1wKHgsIDAsIGNvbHVtbnMgLSB3KTtcbiAgICBpZiAoeSA8IDApIHkgPSAwO1xuXG4gICAgaWYgKGl0ZW0ueCA9PT0geCAmJiBpdGVtLnkgPT09IHkgJiYgaXRlbS53ID09PSB3ICYmIGl0ZW0uaCA9PT0gaCkge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHNldHNBcmVFcXVhbDxUPihhOiBTZXQ8VD4sIGI6IFNldDxUPikge1xuICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gIGlmIChhLnNpemUgIT09IGIuc2l6ZSkgcmV0dXJuIGZhbHNlO1xuXG4gIGZvciAoY29uc3QgYV8gb2YgYSkge1xuICAgIGlmICghYi5oYXMoYV8pKSByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gIGlmICh2YWx1ZSA8IG1pbikgcmV0dXJuIG1pbjtcbiAgaWYgKHZhbHVlID4gbWF4KSByZXR1cm4gbWF4O1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmNvbnN0IGFicyA9IE1hdGguYWJzO1xuY29uc3QgbWluID0gTWF0aC5taW47XG5jb25zdCByb3VuZCA9IE1hdGgucm91bmQ7XG5cbmNvbnN0IENBUFRVUkUgPSB7IGNhcHR1cmU6IHRydWUgfTtcbmNvbnN0IFBBU1NJVkUgPSB7IHBhc3NpdmU6IHRydWUgfTtcbiJdfQ==