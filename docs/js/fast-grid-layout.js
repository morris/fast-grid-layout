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
        this.containerWidth = container.offsetWidth;
        this.breakpoints = this.fn.compileBreakpoints(config);
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.container);
        this.addEventListeners();
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
    //
    requestRender() {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => this.render());
        }
    }
    render() {
        var _a, _b;
        this.renderRequested = false;
        const breakpoint = this.getBreakpoint();
        const layout = (_a = this.layouts.get(breakpoint.name)) !== null && _a !== void 0 ? _a : [];
        if (this.dragging) {
            const dragX = this.dragEndX - this.dragStartX;
            const dragY = this.dragEndY - this.dragStartY;
            const columnWidth = this.fn.getColumnWidth(this.containerWidth, breakpoint.columns, breakpoint.columnGap);
            const columnWidthAndGap = columnWidth + breakpoint.columnGap;
            const rowHeightAndGap = breakpoint.rowHeight + breakpoint.rowGap;
            const deltaX = round(dragX / columnWidthAndGap);
            const deltaY = round(dragY / rowHeightAndGap);
            if (deltaX !== this.lastDeltaX || deltaY !== this.lastDeltaY) {
                this.lastDeltaX = deltaX;
                this.lastDeltaY = deltaY;
                if (this.resizeHandle) {
                    this.tempLayout = this.fn.resizeItems(layout, breakpoint.columns, this.selection, deltaX, deltaY, this.resizeHandle);
                }
                else {
                    this.tempLayout = this.fn.moveItems(layout, breakpoint.columns, this.selection, deltaX, deltaY);
                }
                this.layoutFlag = true;
            }
        }
        if (this.layoutFlag) {
            this.fn.renderLayout(this.container, (_b = this.tempLayout) !== null && _b !== void 0 ? _b : layout, breakpoint);
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
        if (this.tempLayout) {
            this.setLayout(this.tempLayout);
            this.tempLayout = undefined;
        }
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
        else if (this.tempLayout) {
            this.setLayout(this.tempLayout);
            this.tempLayout = undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlGQSxNQUFNLE9BQU8sVUFBVTtJQW9DckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBaENsRCxZQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUMsQ0FBQyw2QkFBNkI7UUFFNUUsYUFBUSxHQUFHLEtBQUssQ0FBQztRQUNqQix5QkFBb0IsR0FBeUIsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO1FBQ3RELDRCQUF1QixHQUE0QixHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUM7UUFFNUQsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFJOUIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUViLGFBQVEsR0FBRyxLQUFLLENBQUM7UUFDakIsaUJBQVksR0FBRyxLQUFLLENBQUM7UUFFckIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFJZixvQkFBZSxHQUFHLEtBQUssQ0FBQztRQUN4QixlQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLGtCQUFhLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLGFBQVEsR0FBRyxJQUFJLENBQUM7UUFFaEIsT0FBRSxHQUFHLElBQUksQ0FBQyxXQUFnQyxDQUFDO1FBb2QzQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FB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QUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxTQUFTLEtBQUssQ0FBQyxLQUFhLEVBQUUsR0FBVyxFQUFFLEdBQVc7SUFDcEQsSUFBSSxLQUFLLEdBQUcsR0FBRztRQUFFLE9BQU8sR0FBRyxDQUFDO0lBQzVCLElBQUksS0FBSyxHQUFHLEdBQUc7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUM1QixPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDckIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUV6QixNQUFNLE9BQU8sR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUNsQyxNQUFNLE9BQU8sR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBpbnRlcmZhY2UgR3JpZExheW91dENvbmZpZyB7XG4gIC8qKlxuICAgKiBOdW1iZXIgb2YgY29sdW1ucyBpbiB0aGUgZ3JpZC5cbiAgICpcbiAgICogQGRlZmF1bHQgMTJcbiAgICovXG4gIGNvbHVtbnM/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEhlaWdodCBvZiBlYWNoIHJvdyBpbiBwaXhlbHMuXG4gICAqXG4gICAqIEBkZWZhdWx0IDMwXG4gICAqL1xuICByb3dIZWlnaHQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgZ2FwIGJldHdlZW4gZ3JpZCBjZWxscyAoYXBwbGllcyB0byBib3RoIHJvd3MgYW5kIGNvbHVtbnMgaWYgbm8gb3ZlcnJpZGVzIGFyZSBnaXZlbikuXG4gICAqXG4gICAqIEBkZWZhdWx0IDBcbiAgICovXG4gIGdhcD86IG51bWJlcjtcblxuICAvKipcbiAgICogSG9yaXpvbnRhbCBnYXAgYmV0d2VlbiBncmlkIGNvbHVtbnMgaW4gcGl4ZWxzLlxuICAgKiBPdmVycmlkZXMgYGdhcGAgaWYgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBnYXBcbiAgICovXG4gIGNvbHVtbkdhcD86IG51bWJlcjtcblxuICAvKipcbiAgICogVmVydGljYWwgZ2FwIGJldHdlZW4gZ3JpZCByb3dzIGluIHBpeGVscy5cbiAgICogT3ZlcnJpZGVzIGBnYXBgIGlmIHNwZWNpZmllZC5cbiAgICpcbiAgICogQGRlZmF1bHQgZ2FwXG4gICAqL1xuICByb3dHYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFJlc3BvbnNpdmUgYnJlYWtwb2ludCBjb25maWdzLlxuICAgKi9cbiAgYnJlYWtwb2ludHM/OiB7IFtuYW1lOiBzdHJpbmddOiBHcmlkTGF5b3V0QnJlYWtwb2ludCB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRCcmVha3BvaW50XG4gIGV4dGVuZHMgT21pdDxHcmlkTGF5b3V0Q29uZmlnLCAnYnJlYWtwb2ludHMnPiB7XG4gIC8qKlxuICAgKiBNYXhpbXVtIGNvbnRhaW5lciB3aWR0aCBmb3IgdGhpcyBicmVha3BvaW50LlxuICAgKi9cbiAgbWF4V2lkdGg6IG51bWJlcjtcbn1cblxuZXhwb3J0IHR5cGUgTGF5b3V0Q2hhbmdlQ2FsbGJhY2sgPSAoXG4gIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgYnJlYWtwb2ludDogc3RyaW5nLFxuKSA9PiB2b2lkO1xuXG5leHBvcnQgdHlwZSBTZWxlY3Rpb25DaGFuZ2VDYWxsYmFjayA9IChzZWxlY3Rpb246IFNldDxzdHJpbmc+KSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRJdGVtIHtcbiAgaTogc3RyaW5nO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIG1pblc/OiBudW1iZXI7XG4gIG1pbkg/OiBudW1iZXI7XG4gIG1heFc/OiBudW1iZXI7XG4gIG1heEg/OiBudW1iZXI7XG4gIHN0YXRpYz86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQHByb3RlY3RlZFxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnQge1xuICBuYW1lOiBzdHJpbmc7XG4gIG1heFdpZHRoOiBudW1iZXI7XG4gIGNvbHVtbnM6IG51bWJlcjtcbiAgcm93SGVpZ2h0OiBudW1iZXI7XG4gIGNvbHVtbkdhcDogbnVtYmVyO1xuICByb3dHYXA6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBAcHJvdGVjdGVkXG4gKi9cbmV4cG9ydCB0eXBlIFJlc2l6ZUhhbmRsZSA9ICduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudyc7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByb3RlY3RlZCBjb250YWluZXJXaWR0aDogbnVtYmVyO1xuICBwcm90ZWN0ZWQgYnJlYWtwb2ludHM6IEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnRbXTtcbiAgcHJvdGVjdGVkIGxheW91dHMgPSBuZXcgTWFwPHN0cmluZywgR3JpZExheW91dEl0ZW1bXT4oKTsgLy8gTWFwcGVkIGJ5IGJyZWFrcG9pbnQgbmFtZS5cblxuICBwcm90ZWN0ZWQgZWRpdGFibGUgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGxheW91dENoYW5nZUNhbGxiYWNrOiBMYXlvdXRDaGFuZ2VDYWxsYmFjayA9ICgpID0+IHt9O1xuICBwcm90ZWN0ZWQgc2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2s6IFNlbGVjdGlvbkNoYW5nZUNhbGxiYWNrID0gKCkgPT4ge307XG5cbiAgcHJvdGVjdGVkIHNlbGVjdGlvbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcm90ZWN0ZWQgcmVzaXplSGFuZGxlPzogUmVzaXplSGFuZGxlO1xuICBwcm90ZWN0ZWQgdGVtcExheW91dD86IEdyaWRMYXlvdXRJdGVtW107XG5cbiAgcHJvdGVjdGVkIGRyYWdQb2ludGVySWQgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0VGltZSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0tleT86IHN0cmluZztcbiAgcHJvdGVjdGVkIGRyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBwcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICBwcm90ZWN0ZWQgbGFzdERlbHRhWCA9IDA7XG4gIHByb3RlY3RlZCBsYXN0RGVsdGFZID0gMDtcblxuICBwcm90ZWN0ZWQgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyO1xuXG4gIHByb3RlY3RlZCByZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGxheW91dEZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gIHByb3RlY3RlZCBtZXRhRmxhZyA9IHRydWU7XG5cbiAgcHJvdGVjdGVkIGZuID0gdGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgR3JpZExheW91dDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLmNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLm9mZnNldFdpZHRoO1xuICAgIHRoaXMuYnJlYWtwb2ludHMgPSB0aGlzLmZuLmNvbXBpbGVCcmVha3BvaW50cyhjb25maWcpO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB0aGlzLmhhbmRsZVJlc2l6ZSgpKTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgZ2V0QnJlYWtwb2ludChuYW1lPzogc3RyaW5nKSB7XG4gICAgY29uc3QgYnJlYWtwb2ludHMgPSB0aGlzLmJyZWFrcG9pbnRzO1xuXG4gICAgaWYgKG5hbWUpIHtcbiAgICAgIGNvbnN0IGJyZWFrcG9pbnQgPSBicmVha3BvaW50cy5maW5kKChpdCkgPT4gaXQubmFtZSA9PT0gbmFtZSk7XG5cbiAgICAgIGlmIChicmVha3BvaW50KSByZXR1cm4gYnJlYWtwb2ludDtcbiAgICB9XG5cbiAgICByZXR1cm4gYnJlYWtwb2ludHMuZmluZChcbiAgICAgIChpdCkgPT4gaXQubWF4V2lkdGggPj0gdGhpcy5jb250YWluZXJXaWR0aCxcbiAgICApIGFzIEdyaWRMYXlvdXRDb21waWxlZEJyZWFrcG9pbnQ7XG4gIH1cblxuICBzZXRDb25maWcoY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnKSB7XG4gICAgdGhpcy5icmVha3BvaW50cyA9IHRoaXMuZm4uY29tcGlsZUJyZWFrcG9pbnRzKGNvbmZpZyk7XG5cbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBsYXlvdXRdIG9mIHRoaXMubGF5b3V0cykge1xuICAgICAgY29uc3QgYnJlYWtwb2ludCA9IHRoaXMuZ2V0QnJlYWtwb2ludChuYW1lKTtcbiAgICAgIGNvbnN0IHJlcGFpcmVkID0gdGhpcy5mbi5yZXBhaXJMYXlvdXQobGF5b3V0LCBicmVha3BvaW50LmNvbHVtbnMpO1xuXG4gICAgICBpZiAocmVwYWlyZWQgIT09IGxheW91dCkge1xuICAgICAgICB0aGlzLmxheW91dHMuc2V0KFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgdGhpcy5mbi5yZXBhaXJMYXlvdXQobGF5b3V0LCBicmVha3BvaW50LmNvbHVtbnMpLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmxheW91dENoYW5nZUNhbGxiYWNrKGxheW91dCwgYnJlYWtwb2ludC5uYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRFZGl0YWJsZShlZGl0YWJsZTogYm9vbGVhbikge1xuICAgIHRoaXMuZWRpdGFibGUgPSBlZGl0YWJsZTtcblxuICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBvbkxheW91dENoYW5nZShjYWxsYmFjazogTGF5b3V0Q2hhbmdlQ2FsbGJhY2spIHtcbiAgICB0aGlzLmxheW91dENoYW5nZUNhbGxiYWNrID0gY2FsbGJhY2s7XG4gIH1cblxuICBvblNlbGVjdGlvbkNoYW5nZShjYWxsYmFjazogU2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2spIHtcbiAgICB0aGlzLnNlbGVjdGlvbkNoYW5nZUNhbGxiYWNrID0gY2FsbGJhY2s7XG4gIH1cblxuICBzZXRMYXlvdXQobGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLCBicmVha3BvaW50Pzogc3RyaW5nKSB7XG4gICAgY29uc3QgYiA9IHRoaXMuZ2V0QnJlYWtwb2ludChicmVha3BvaW50KTtcbiAgICBjb25zdCBiZWZvcmUgPSB0aGlzLmxheW91dHMuZ2V0KGIubmFtZSk7XG5cbiAgICBpZiAobGF5b3V0ID09PSBiZWZvcmUpIHJldHVybjtcblxuICAgIHRoaXMubGF5b3V0cy5zZXQoYi5uYW1lLCB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIGIuY29sdW1ucykpO1xuICAgIHRoaXMubGF5b3V0Q2hhbmdlQ2FsbGJhY2sobGF5b3V0LCBiLm5hbWUpO1xuXG4gICAgLy8gQXV0by1nZW5lcmF0ZSBtaXNzaW5nIGxheW91dHMuXG4gICAgZm9yIChjb25zdCBiMiBvZiB0aGlzLmJyZWFrcG9pbnRzKSB7XG4gICAgICBpZiAoIXRoaXMubGF5b3V0cy5oYXMoYjIubmFtZSkpIHtcbiAgICAgICAgdGhpcy5sYXlvdXRzLnNldChiMi5uYW1lLCB0aGlzLmZuLnJlcGFpckxheW91dChsYXlvdXQsIGIyLmNvbHVtbnMpKTtcbiAgICAgICAgdGhpcy5sYXlvdXRDaGFuZ2VDYWxsYmFjayhsYXlvdXQsIGIyLm5hbWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRTZWxlY3Rpb24oc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikge1xuICAgIGlmIChzZXRzQXJlRXF1YWwoc2VsZWN0aW9uLCB0aGlzLnNlbGVjdGlvbikpIHJldHVybjtcblxuICAgIHRoaXMuc2VsZWN0aW9uID0gc2VsZWN0aW9uO1xuICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sodGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHRvZ2dsZVNlbGVjdGlvbihrZXk6IHN0cmluZywgZXhjbHVzaXZlID0gZmFsc2UpIHtcbiAgICBpZiAodGhpcy5zZWxlY3Rpb24uaGFzKGtleSkpIHtcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmRlbGV0ZShrZXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZXhjbHVzaXZlKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0aW9uLmNsZWFyKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2VsZWN0aW9uLmFkZChrZXkpO1xuICAgIH1cblxuICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sodGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uQ2hhbmdlQ2FsbGJhY2sodGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICByZXF1ZXN0UmVuZGVyKCkge1xuICAgIGlmICghdGhpcy5yZW5kZXJSZXF1ZXN0ZWQpIHtcbiAgICAgIHRoaXMucmVuZGVyUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB0aGlzLnJlbmRlcigpKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIGNvbnN0IGJyZWFrcG9pbnQgPSB0aGlzLmdldEJyZWFrcG9pbnQoKTtcbiAgICBjb25zdCBsYXlvdXQgPSB0aGlzLmxheW91dHMuZ2V0KGJyZWFrcG9pbnQubmFtZSkgPz8gW107XG5cbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgY29uc3QgZHJhZ1ggPSB0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYO1xuICAgICAgY29uc3QgZHJhZ1kgPSB0aGlzLmRyYWdFbmRZIC0gdGhpcy5kcmFnU3RhcnRZO1xuXG4gICAgICBjb25zdCBjb2x1bW5XaWR0aCA9IHRoaXMuZm4uZ2V0Q29sdW1uV2lkdGgoXG4gICAgICAgIHRoaXMuY29udGFpbmVyV2lkdGgsXG4gICAgICAgIGJyZWFrcG9pbnQuY29sdW1ucyxcbiAgICAgICAgYnJlYWtwb2ludC5jb2x1bW5HYXAsXG4gICAgICApO1xuICAgICAgY29uc3QgY29sdW1uV2lkdGhBbmRHYXAgPSBjb2x1bW5XaWR0aCArIGJyZWFrcG9pbnQuY29sdW1uR2FwO1xuICAgICAgY29uc3Qgcm93SGVpZ2h0QW5kR2FwID0gYnJlYWtwb2ludC5yb3dIZWlnaHQgKyBicmVha3BvaW50LnJvd0dhcDtcblxuICAgICAgY29uc3QgZGVsdGFYID0gcm91bmQoZHJhZ1ggLyBjb2x1bW5XaWR0aEFuZEdhcCk7XG4gICAgICBjb25zdCBkZWx0YVkgPSByb3VuZChkcmFnWSAvIHJvd0hlaWdodEFuZEdhcCk7XG5cbiAgICAgIGlmIChkZWx0YVggIT09IHRoaXMubGFzdERlbHRhWCB8fCBkZWx0YVkgIT09IHRoaXMubGFzdERlbHRhWSkge1xuICAgICAgICB0aGlzLmxhc3REZWx0YVggPSBkZWx0YVg7XG4gICAgICAgIHRoaXMubGFzdERlbHRhWSA9IGRlbHRhWTtcblxuICAgICAgICBpZiAodGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPSB0aGlzLmZuLnJlc2l6ZUl0ZW1zKFxuICAgICAgICAgICAgbGF5b3V0LFxuICAgICAgICAgICAgYnJlYWtwb2ludC5jb2x1bW5zLFxuICAgICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgICBkZWx0YVgsXG4gICAgICAgICAgICBkZWx0YVksXG4gICAgICAgICAgICB0aGlzLnJlc2l6ZUhhbmRsZSxcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4ubW92ZUl0ZW1zKFxuICAgICAgICAgICAgbGF5b3V0LFxuICAgICAgICAgICAgYnJlYWtwb2ludC5jb2x1bW5zLFxuICAgICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgICBkZWx0YVgsXG4gICAgICAgICAgICBkZWx0YVksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubGF5b3V0RmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJMYXlvdXQoXG4gICAgICAgIHRoaXMuY29udGFpbmVyLFxuICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPz8gbGF5b3V0LFxuICAgICAgICBicmVha3BvaW50LFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0RmxhZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlbGVjdGlvbkZsYWcpIHtcbiAgICAgIHRoaXMucmVuZGVyU2VsZWN0aW9uKCk7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tZXRhRmxhZykge1xuICAgICAgdGhpcy5yZW5kZXJNZXRhKCk7XG4gICAgICB0aGlzLm1ldGFGbGFnID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJlbmRlclNlbGVjdGlvbigpIHtcbiAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuY29udGFpbmVyLmNoaWxkcmVuO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBjaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgdGhpcy5zZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkgYXMgc3RyaW5nKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyTWV0YSgpIHtcbiAgICBjb25zdCB7IGNvbnRhaW5lciwgZWRpdGFibGUsIGRyYWdnaW5nLCByZXNpemVIYW5kbGUgfSA9IHRoaXM7XG5cbiAgICBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnLWVkaXRhYmxlJywgZWRpdGFibGUpO1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctbW92aW5nJywgZHJhZ2dpbmcgJiYgIXJlc2l6ZUhhbmRsZSk7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1yZXNpemluZycsIGRyYWdnaW5nICYmICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IHJvb3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19oaWRlLXNlbGVjdGlvbicsIGRyYWdnaW5nKTtcbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19mb3JjZS1jdXJzb3InLCAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmZuLmdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGUpO1xuXG4gICAgaWYgKHJvb3Quc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1mb3JjZS1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZvcmNlLWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBwcm90ZWN0ZWQgaGFuZGxlUmVzaXplKCkge1xuICAgIHRoaXMuY29udGFpbmVyV2lkdGggPSB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aDtcblxuICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlTW91c2VEb3duKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnIHx8IGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSk7XG4gICAgICB0aGlzLmRyYWdLZXkgPSBlbGVtZW50LmRhdGFzZXQua2V5O1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZU1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuXG4gICAgaWYgKCF0aGlzLmRyYWdLZXkpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gZWxlbWVudFxuICAgICAgICA/IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSlcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIXRoaXMuZHJhZ2dpbmcgJiZcbiAgICAgIHRoaXMuZHJhZ0tleSAmJlxuICAgICAgKGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA+IHRoaXMuZm4uRFJBR19USFJFU0hPTEQgfHxcbiAgICAgICAgYWJzKHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFkpID4gdGhpcy5mbi5EUkFHX1RIUkVTSE9MRClcbiAgICApIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuXG4gICAgICBpZiAoIXRoaXMuc2VsZWN0aW9uLmhhcyh0aGlzLmRyYWdLZXkpIHx8IHRoaXMucmVzaXplSGFuZGxlKSB7XG4gICAgICAgIHRoaXMuc2V0U2VsZWN0aW9uKG5ldyBTZXQodGhpcy5kcmFnS2V5KSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlVXAoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIGlmICh0aGlzLnRlbXBMYXlvdXQpIHtcbiAgICAgIHRoaXMuc2V0TGF5b3V0KHRoaXMudGVtcExheW91dCk7XG4gICAgICB0aGlzLnRlbXBMYXlvdXQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdGhpcy5yZXNldERyYWcoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmICh0aGlzLmRyYWdQb2ludGVySWQpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ1BvaW50ZXJJZCA9IGUucG9pbnRlcklkO1xuICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5kcmFnU3RhcnRYID0gdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnU3RhcnRZID0gdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5ICYmIHRoaXMuc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5KSkge1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSk7XG5cbiAgICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJJZCAhPT0gdGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcblxuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJJZCAhPT0gdGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICBpZiAoXG4gICAgICB0aGlzLmRyYWdTdGFydFRpbWUgPiBEYXRlLm5vdygpIC0gdGhpcy5mbi5UQVBfREVMQVkgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA8IHRoaXMuZm4uVEFQX1RIUkVTSE9MRCAmJlxuICAgICAgYWJzKHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFkpIDwgdGhpcy5mbi5UQVBfVEhSRVNIT0xEXG4gICAgKSB7XG4gICAgICAvLyBJdCdzIGEgdGFwLlxuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXksIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy50ZW1wTGF5b3V0KSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBMYXlvdXQpO1xuICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMucHJldmVudENsaWNrKSB7XG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IGZhbHNlO1xuXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIWUuY3RybEtleSAmJiAhZS5tZXRhS2V5KSB7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVLZXlVcChlOiBLZXlib2FyZEV2ZW50KSB7XG4gICAgaWYgKHRoaXMuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKGUua2V5KSB7XG4gICAgICBjYXNlICdFc2NhcGUnOlxuICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5yZXNldERyYWcoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJlc2V0RHJhZygpIHtcbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VsZWN0aW9uID0gKGRvY3VtZW50LmRlZmF1bHRWaWV3IHx8IHdpbmRvdykuZ2V0U2VsZWN0aW9uKCk7XG5cbiAgICAgICAgaWYgKHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24udHlwZSAhPT0gJ0NhcmV0Jykge1xuICAgICAgICAgIHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIGlnbm9yZVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5kcmFnUG9pbnRlcklkID0gMDtcbiAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kcmFnS2V5ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucmVzaXplSGFuZGxlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMubGFzdERlbHRhWCA9IDA7XG4gICAgdGhpcy5sYXN0RGVsdGFZID0gMDtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXRUYXJnZXRFbGVtZW50KGU6IEV2ZW50KSB7XG4gICAgaWYgKGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgY29uc3QgaXRlbSA9IGUudGFyZ2V0LmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCcuZmFzdC1ncmlkLWxheW91dCA+IC5pdGVtJyk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXN0YXRpYycpKSByZXR1cm47XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXNlbGVjdGVkJykpIHJldHVybiBpdGVtO1xuXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBlLnRhcmdldC5jbG9zZXN0PEhUTUxFbGVtZW50PihcbiAgICAgICAgICAnLmZhc3QtZ3JpZC1sYXlvdXQgLmNvbnRlbnQsIGJ1dHRvbiwgaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghY29udGVudCkgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudDogSFRNTEVsZW1lbnQsIGV2ZW50OiBQb2ludGVyRXZlbnQpIHtcbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzLmZuLmNoZWNrUmVzaXplSGFuZGxlKFxuICAgICAgZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgIGV2ZW50LmNsaWVudFgsXG4gICAgICBldmVudC5jbGllbnRZLFxuICAgICAgdGhpcy5mbi5SRVNJWkVfVEhSRVNIT0xELFxuICAgICk7XG5cbiAgICBzd2l0Y2ggKGhhbmRsZSkge1xuICAgICAgY2FzZSAnbic6XG4gICAgICBjYXNlICduZSc6XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIC8vIERpc2FibGUgbm9ydGggaGFuZGxlcyBmb3Igbm93LCBhcyBpdCBmZWVscyB1bm5hdHVyYWwuXG4gICAgICAgIC8vIFRPRE8gbWFrZSBjb25maWd1cmFibGU/XG4gICAgICAgIHJldHVybjtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBkaXNjb25uZWN0KCkge1xuICAgIHRoaXMuc2VsZWN0aW9uID0gbmV3IFNldCgpO1xuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgdGhpcy5yZW5kZXJTZWxlY3Rpb24oKTtcbiAgICB0aGlzLnJlbmRlck1ldGEoKTtcblxuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIudW5vYnNlcnZlKHRoaXMuY29udGFpbmVyKTtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlRG93biA9IHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VNb3ZlID0gdGhpcy5oYW5kbGVNb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZVVwID0gdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyRG93biA9IHRoaXMuaGFuZGxlUG9pbnRlckRvd24uYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyTW92ZSA9IHRoaXMuaGFuZGxlUG9pbnRlck1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyVXAgPSB0aGlzLmhhbmRsZVBvaW50ZXJVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlQ2xpY2sgPSB0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlS2V5VXAgPSB0aGlzLmhhbmRsZUtleVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCBDQVBUVVJFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVNb3VzZURvd24pO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZU1vdXNlTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZVBvaW50ZXJEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVQb2ludGVyTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5faGFuZGxlQ2xpY2ssIENBUFRVUkUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuX2hhbmRsZUtleVVwKTtcbiAgfVxuXG4gIC8vXG5cbiAgc3RhdGljIFJFU0laRV9USFJFU0hPTEQgPSAxMDtcbiAgc3RhdGljIFRBUF9ERUxBWSA9IDI1MDtcbiAgc3RhdGljIFRBUF9USFJFU0hPTEQgPSAxMDtcbiAgc3RhdGljIERSQUdfVEhSRVNIT0xEID0gNztcblxuICBzdGF0aWMgY29tcGlsZUJyZWFrcG9pbnRzKFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgKTogR3JpZExheW91dENvbXBpbGVkQnJlYWtwb2ludFtdIHtcbiAgICBjb25zdCBkZWZhdWx0Q29sdW1ucyA9IDEyO1xuICAgIGNvbnN0IGRlZmF1bHRSb3dIZWlnaHQgPSAzMDtcblxuICAgIGNvbnN0IGJyZWFrcG9pbnRzID0gT2JqZWN0LmVudHJpZXMoY29uZmlnLmJyZWFrcG9pbnRzID8/IHt9KVxuICAgICAgLm1hcCgoW25hbWUsIGJdKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICBtYXhXaWR0aDogYi5tYXhXaWR0aCxcbiAgICAgICAgICBjb2x1bW5zOiBiLmNvbHVtbnMgPz8gY29uZmlnLmNvbHVtbnMgPz8gZGVmYXVsdENvbHVtbnMsXG4gICAgICAgICAgcm93SGVpZ2h0OiBiLnJvd0hlaWdodCA/PyBjb25maWcucm93SGVpZ2h0ID8/IGRlZmF1bHRSb3dIZWlnaHQsXG4gICAgICAgICAgcm93R2FwOiBiLnJvd0dhcCA/PyBiLmdhcCA/PyBjb25maWcucm93R2FwID8/IGNvbmZpZy5nYXAgPz8gMCxcbiAgICAgICAgICBjb2x1bW5HYXA6XG4gICAgICAgICAgICBiLmNvbHVtbkdhcCA/PyBiLmdhcCA/PyBjb25maWcuY29sdW1uR2FwID8/IGNvbmZpZy5nYXAgPz8gMCxcbiAgICAgICAgfTtcbiAgICAgIH0pXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5tYXhXaWR0aCAtIGIubWF4V2lkdGgpO1xuXG4gICAgYnJlYWtwb2ludHMucHVzaCh7XG4gICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICBtYXhXaWR0aDogSW5maW5pdHksXG4gICAgICBjb2x1bW5zOiBjb25maWcuY29sdW1ucyA/PyBkZWZhdWx0Q29sdW1ucyxcbiAgICAgIHJvd0hlaWdodDogY29uZmlnLnJvd0hlaWdodCA/PyBkZWZhdWx0Um93SGVpZ2h0LFxuICAgICAgcm93R2FwOiBjb25maWcucm93R2FwID8/IGNvbmZpZy5nYXAgPz8gMCxcbiAgICAgIGNvbHVtbkdhcDogY29uZmlnLmNvbHVtbkdhcCA/PyBjb25maWcuZ2FwID8/IDAsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYnJlYWtwb2ludHM7XG4gIH1cblxuICBzdGF0aWMgcmVuZGVyTGF5b3V0KFxuICAgIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbXBpbGVkQnJlYWtwb2ludCxcbiAgKSB7XG4gICAgY29uc3QgeyBjb2x1bW5zLCBjb2x1bW5HYXAsIHJvd0dhcCwgcm93SGVpZ2h0IH0gPSBjb25maWc7XG5cbiAgICBjb25zdCBjb250YWluZXJXaWR0aCA9IGNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICBjb25zdCBjb2x1bW5XaWR0aCA9IHRoaXMuZ2V0Q29sdW1uV2lkdGgoY29udGFpbmVyV2lkdGgsIGNvbHVtbnMsIGNvbHVtbkdhcCk7XG4gICAgY29uc3QgY29sdW1uV2lkdGhBbmRHYXAgPSBjb2x1bW5XaWR0aCArIGNvbHVtbkdhcDtcbiAgICBjb25zdCByb3dIZWlnaHRBbmRHYXAgPSByb3dIZWlnaHQgKyByb3dHYXA7XG5cbiAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZmFzdC1ncmlkLWxheW91dCcpO1xuXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtPigpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuICAgICAgbWFwLnNldChpdGVtLmksIGl0ZW0pO1xuICAgIH1cblxuICAgIGxldCBoTWF4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnQuZGF0YXNldC5rZXkpIHtcbiAgICAgICAgZWxlbWVudC5kYXRhc2V0LmtleSA9IGkudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5kYXRhc2V0LmtleTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtYXAuZ2V0KGtleSk7XG5cbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2l0ZW0nKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnLWR5bmFtaWMnLCAhaXRlbS5zdGF0aWMpO1xuICAgICAgZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCctc3RhdGljJywgISFpdGVtLnN0YXRpYyk7XG5cbiAgICAgIGNvbnN0IGggPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGlmIChoID4gaE1heCkge1xuICAgICAgICBoTWF4ID0gaDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2lkdGggPSByb3VuZChpdGVtLncgKiBjb2x1bW5XaWR0aEFuZEdhcCAtIGNvbHVtbkdhcCkgKyAncHgnO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gcm91bmQoaXRlbS5oICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG4gICAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlKCcgK1xuICAgICAgICByb3VuZChpdGVtLnggKiBjb2x1bW5XaWR0aEFuZEdhcCkgK1xuICAgICAgICAncHgsICcgK1xuICAgICAgICByb3VuZChpdGVtLnkgKiByb3dIZWlnaHRBbmRHYXApICtcbiAgICAgICAgJ3B4KSc7XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLndpZHRoICE9PSB3aWR0aCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gIT09IHRyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSByb3VuZChoTWF4ICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG5cbiAgICBpZiAoY29udGFpbmVyLnN0eWxlLmhlaWdodCAhPT0gY29udGFpbmVySGVpZ2h0KSB7XG4gICAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBnZXRDb2x1bW5XaWR0aChcbiAgICBjb250YWluZXJXaWR0aDogbnVtYmVyLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBjb2x1bW5HYXA6IG51bWJlcixcbiAgKSB7XG4gICAgcmV0dXJuIChjb250YWluZXJXaWR0aCAtIChjb2x1bW5zIC0gMSkgKiBjb2x1bW5HYXApIC8gY29sdW1ucztcbiAgfVxuXG4gIHN0YXRpYyBjaGVja1Jlc2l6ZUhhbmRsZShcbiAgICBjbGllbnRSZWN0OiBET01SZWN0LFxuICAgIGNsaWVudFg6IG51bWJlcixcbiAgICBjbGllbnRZOiBudW1iZXIsXG4gICAgdGhyZXNob2xkOiBudW1iZXIsXG4gICk6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbiA9IGNsaWVudFkgLSBjbGllbnRSZWN0LnRvcCA8IHRocmVzaG9sZDtcbiAgICBjb25zdCBlID0gY2xpZW50UmVjdC5yaWdodCAtIGNsaWVudFggPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgcyA9IGNsaWVudFJlY3QuYm90dG9tIC0gY2xpZW50WSA8IHRocmVzaG9sZDtcbiAgICBjb25zdCB3ID0gY2xpZW50WCAtIGNsaWVudFJlY3QubGVmdCA8IHRocmVzaG9sZDtcblxuICAgIGlmIChzKSB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gJ3NlJztcbiAgICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgICByZXR1cm4gJ3N3JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAncyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlKSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ25lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3KSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ253JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAndyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuKSB7XG4gICAgICByZXR1cm4gJ24nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBnZXRSZXNpemVDdXJzb3IocmVzaXplSGFuZGxlOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQpIHtcbiAgICBzd2l0Y2ggKHJlc2l6ZUhhbmRsZSkge1xuICAgICAgY2FzZSAnbic6XG4gICAgICBjYXNlICdzJzpcbiAgICAgICAgcmV0dXJuICducy1yZXNpemUnO1xuICAgICAgY2FzZSAnZSc6XG4gICAgICBjYXNlICd3JzpcbiAgICAgICAgcmV0dXJuICdldy1yZXNpemUnO1xuICAgICAgY2FzZSAnbmUnOlxuICAgICAgY2FzZSAnc3cnOlxuICAgICAgICByZXR1cm4gJ25lc3ctcmVzaXplJztcbiAgICAgIGNhc2UgJ3NlJzpcbiAgICAgIGNhc2UgJ253JzpcbiAgICAgICAgcmV0dXJuICdud3NlLXJlc2l6ZSc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1vdmVzIHRoZSBzcGVjaWZpZWQgaXRlbXMgKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyBtb3ZlSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGRlbHRhWDogbnVtYmVyLFxuICAgIGRlbHRhWTogbnVtYmVyLFxuICApIHtcbiAgICBpZiAoKGRlbHRhWCA9PT0gMCAmJiBkZWx0YVkgPT09IDApIHx8IHNlbGVjdGlvbi5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeCA9IGl0ZW0ueCArIGRlbHRhWDtcbiAgICAgICAgY29uc3QgeSA9IGl0ZW0ueSArIGRlbHRhWTtcblxuICAgICAgICBpZiAoaXRlbS54ICE9PSB4IHx8IGl0ZW0ueSAhPT0geSkge1xuICAgICAgICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgICAgICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICAgICAgICAgIG91dCA9IGxheW91dC5zbGljZSgwKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvdXRbaV0gPSB7IC4uLml0ZW0sIHgsIHkgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvdXQgPT09IGxheW91dCkgcmV0dXJuIGxheW91dDtcblxuICAgIHJldHVybiB0aGlzLnJlcGFpckxheW91dChvdXQsIGNvbHVtbnMsIHNlbGVjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogUmVzaXplcyB0aGUgc3BlY2lmaWVkIGl0ZW0gKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyByZXNpemVJdGVtcyhcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29sdW1uczogbnVtYmVyLFxuICAgIHNlbGVjdGlvbjogU2V0PHN0cmluZz4sXG4gICAgZGVsdGFYOiBudW1iZXIsXG4gICAgZGVsdGFZOiBudW1iZXIsXG4gICAgaGFuZGxlOiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGlmICgoZGVsdGFYID09PSAwICYmIGRlbHRhWSA9PT0gMCkgfHwgc2VsZWN0aW9uLnNpemUgPT09IDApIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgbGV0IG91dCA9IGxheW91dDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcblxuICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoaXRlbS5pKSkge1xuICAgICAgICBjb25zdCB7IG1heFcgPSBjb2x1bW5zLCBtYXhIID0gSW5maW5pdHkgfSA9IGl0ZW07XG4gICAgICAgIGxldCB7IHgsIHksIHcsIGggfSA9IGl0ZW07XG4gICAgICAgIGNvbnN0IHh3ID0geCArIHc7XG4gICAgICAgIGNvbnN0IHloID0geSArIGg7XG4gICAgICAgIGNvbnN0IGN4ID0gY29sdW1ucyAtIHg7XG5cbiAgICAgICAgc3dpdGNoIChoYW5kbGUpIHtcbiAgICAgICAgICBjYXNlICduJzpcbiAgICAgICAgICAgIGggPSBjbGFtcChoIC0gZGVsdGFZLCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZGVsdGFZLCAwLCB5aCAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGRlbHRhWCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzJzpcbiAgICAgICAgICAgIGggPSBjbGFtcChoICsgZGVsdGFZLCAxLCBtYXhIKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3cnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkZWx0YVgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICAgICAgeCA9IGNsYW1wKHggKyBkZWx0YVgsIDAsIHh3IC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICduZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGRlbHRhWCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGRlbHRhWSwgMSwgbWF4SCk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGRlbHRhWSwgMCwgeWggLSAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3NlJzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3ICsgZGVsdGFYLCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoICsgZGVsdGFZLCAxLCBtYXhIKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3N3JzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3IC0gZGVsdGFYLCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoICsgZGVsdGFZLCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZGVsdGFYLCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbncnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkZWx0YVgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICAgICAgaCA9IGNsYW1wKGggLSBkZWx0YVksIDEsIG1heEgpO1xuICAgICAgICAgICAgeCA9IGNsYW1wKHggKyBkZWx0YVgsIDAsIHh3IC0gMSk7XG4gICAgICAgICAgICB5ID0gY2xhbXAoeSArIGRlbHRhWSwgMCwgeWggLSAxKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ueCAhPT0geCB8fCBpdGVtLnkgIT09IHkgfHwgaXRlbS53ICE9PSB3IHx8IGl0ZW0uaCAhPT0gaCkge1xuICAgICAgICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgICAgICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICAgICAgICAgIG91dCA9IGxheW91dC5zbGljZSgwKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvdXRbaV0gPSB7IC4uLml0ZW0sIHgsIHksIHcsIGggfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvdXQgPT09IGxheW91dCkgcmV0dXJuIGxheW91dDtcblxuICAgIHJldHVybiB0aGlzLnJlcGFpckxheW91dChvdXQsIGNvbHVtbnMsIHNlbGVjdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogRml4ZXMgb3ZlcmxhcHMsIGdhcHMsIGFuZCBsYXlvdXQgb3V0IG9mIGJvdW5kcy5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgdGhlcmUgd2FzIGFueXRoaW5nIHRvIHJlcGFpci5cbiAgICovXG4gIHN0YXRpYyByZXBhaXJMYXlvdXQoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb24/OiBTZXQ8c3RyaW5nPixcbiAgKSB7XG4gICAgLy8gU29ydCBieSByb3cgZmlyc3QsIHNlbGVjdGlvbiBzZWNvbmQgKGlmIGFueSksIGNvbHVtbiB0aGlyZC5cbiAgICAvLyBUT0RPIENvbnNpZGVyaW5nIG92ZXJsYXAgd2hlbiBzZWxlY3RlZCBtaWdodCB5aWVsZCBldmVuIGJldHRlciBiZWhhdmlvcj9cbiAgICBjb25zdCBzb3J0ZWRJdGVtcyA9IGxheW91dC5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBpZiAoYS55IDwgYi55KSByZXR1cm4gLTE7XG4gICAgICBpZiAoYS55ID4gYi55KSByZXR1cm4gMTtcblxuICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICBpZiAoc2VsZWN0aW9uLmhhcyhhLmkpKSB7XG4gICAgICAgICAgaWYgKCFzZWxlY3Rpb24uaGFzKGIuaSkpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0aW9uLmhhcyhiLmkpKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGEueCA8IGIueCkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEueCA+IGIueCkgcmV0dXJuIDE7XG5cbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RhdGljSXRlbXMgPSBzb3J0ZWRJdGVtcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uc3RhdGljKTtcbiAgICBjb25zdCBudW1TdGF0aWNzID0gc3RhdGljSXRlbXMubGVuZ3RoO1xuICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuICAgIGxldCBzdGF0aWNPZmZzZXQgPSAwO1xuXG4gICAgLy8gXCJSaXNpbmcgdGlkZVwiLCBpLmUuIG51bWJlciBvZiBibG9ja2VkIGNlbGxzIHBlciBjb2x1bW4uXG4gICAgY29uc3QgdGlkZTogbnVtYmVyW10gPSBBcnJheShjb2x1bW5zKTtcblxuICAgIGZvciAobGV0IHggPSAwOyB4IDwgY29sdW1uczsgKyt4KSB7XG4gICAgICB0aWRlW3hdID0gMDtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHNvcnRlZEl0ZW1zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgLy8gTm90ZSB0aGF0IHdlIGFsbG93IGl0ZW1zIHRvIGJlIG91dCBvZiBib3VuZHMgZHVyaW5nIHNvcnRpbmcsXG4gICAgICAvLyB3aGljaCAoZm9yIGV4YW1wbGUpIGFsbG93cyBtb3ZpbmcgaXRlbXMgXCJiZWZvcmVcIiB0aGUgZmlyc3QgaXRlbS5cbiAgICAgIC8vIFdlIGZpeCBhbnkgb3V0IG9mIGJvdW5kIGlzc3VlcyBoZXJlLlxuICAgICAgbGV0IGl0ZW0gPSB0aGlzLnJlcGFpckl0ZW0oc29ydGVkSXRlbXNbaV0sIGNvbHVtbnMpO1xuICAgICAgY29uc3QgeDIgPSBpdGVtLnggKyBpdGVtLnc7XG5cbiAgICAgIGlmIChpdGVtLnN0YXRpYykge1xuICAgICAgICAvLyBUaGlzIHN0YXRpYyBpdGVtIHdpbGwgYmUgcGFydCBvZiB0aGUgdGlkZVxuICAgICAgICAvLyBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBjb25zaWRlcmVkIGZvciBjb2xsaXNpb24gYW55bW9yZS5cbiAgICAgICAgLy8gU2luY2Ugc3RhdGljIGl0ZW0gd2lsbCBiZSB2aXNpdGVkIGluIHRoZSBzYW1lIG9yZGVyXG4gICAgICAgIC8vIGFzIHRoZSBzdGF0aWNJdGVtcyBhcnJheSwgd2UgY2FuIGp1c3QgaW5jcmVtZW50IHRoZSBvZmZzZXQgaGVyZS5cbiAgICAgICAgKytzdGF0aWNPZmZzZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBEZXRlY3Qgc21hbGxlc3QgZ2FwL2xhcmdlc3Qgb3ZlcmxhcCB3aXRoIHRpZGUuXG4gICAgICAgIGxldCBtaW5HYXAgPSBJbmZpbml0eTtcblxuICAgICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICAgIGNvbnN0IGdhcCA9IGl0ZW0ueSAtIHRpZGVbeF07XG5cbiAgICAgICAgICBpZiAoZ2FwIDwgbWluR2FwKSB7XG4gICAgICAgICAgICBtaW5HYXAgPSBnYXA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRml4IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAuXG4gICAgICAgIGxldCB5TmV4dCA9IGl0ZW0ueSAtIG1pbkdhcDtcblxuICAgICAgICAvLyBIYW5kbGUgY29sbGlzaW9uIHdpdGggc3RhdGljIGl0ZW1zLlxuICAgICAgICBmb3IgKGxldCBqID0gc3RhdGljT2Zmc2V0OyBqIDwgbnVtU3RhdGljczsgKytqKSB7XG4gICAgICAgICAgY29uc3Qgc3RhdGljSXRlbSA9IHN0YXRpY0l0ZW1zW2pdO1xuXG4gICAgICAgICAgaWYgKHN0YXRpY0l0ZW0ueSA+PSB5TmV4dCArIGl0ZW0uaCkge1xuICAgICAgICAgICAgLy8gRm9sbG93aW5nIHN0YXRpYyBpdGVtcyBjYW5ub3QgY29sbGlkZSBiZWNhdXNlIG9mIHNvcnRpbmc7IHN0b3AuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAvL3N0YXRpY0l0ZW0ueSA8IHlOZXh0ICsgaXRlbS5oICYmIC8vIFRoaXMgaXMgaW1wbGllZCBhYm92ZS5cbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaCA+IHlOZXh0ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggPCBpdGVtLnggKyBpdGVtLncgJiZcbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueCArIHN0YXRpY0l0ZW0udyA+IGl0ZW0ueFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gQ29sbGlzaW9uIGRldGVjdGVkOyBtb3ZlIGN1cnJlbnQgaXRlbSBiZWxvdyBzdGF0aWMgaXRlbS5cbiAgICAgICAgICAgIHlOZXh0ID0gc3RhdGljSXRlbS55ICsgc3RhdGljSXRlbS5oO1xuXG4gICAgICAgICAgICAvLyBDdXJyZW50IGl0ZW0gd2FzIG1vdmVkO1xuICAgICAgICAgICAgLy8gbmVlZCB0byByZWNoZWNrIGNvbGxpc2lvbiB3aXRoIG90aGVyIHN0YXRpYyBpdGVtcy5cbiAgICAgICAgICAgIGogPSBzdGF0aWNPZmZzZXQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ueSAhPT0geU5leHQpIHtcbiAgICAgICAgICBpdGVtID0geyAuLi5pdGVtLCB5OiB5TmV4dCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0gIT09IHNvcnRlZEl0ZW1zW2ldKSB7XG4gICAgICAgICAgc29ydGVkSXRlbXNbaV0gPSBpdGVtO1xuICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGlkZS5cbiAgICAgIGNvbnN0IHQgPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGZvciAobGV0IHggPSBpdGVtLng7IHggPCB4MjsgKyt4KSB7XG4gICAgICAgIGlmICh0aWRlW3hdIDwgdCkge1xuICAgICAgICAgIHRpZGVbeF0gPSB0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkID8gc29ydGVkSXRlbXMgOiBsYXlvdXQ7XG4gIH1cblxuICAvKipcbiAgICogUmVwYWlyIGJvdW5kcyBvZiB0aGUgZ2l2ZW4gaXRlbSB0byBmaXQgdGhlIGdpdmVuIGNvbmZpZy5cbiAgICogUmV0dXJucyBhIG5ldyBpdGVtIGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlySXRlbShpdGVtOiBHcmlkTGF5b3V0SXRlbSwgY29sdW1uczogbnVtYmVyKSB7XG4gICAgY29uc3QgeyBtaW5XID0gMSwgbWF4VyA9IGNvbHVtbnMsIG1pbkggPSAxLCBtYXhIID0gSW5maW5pdHkgfSA9IGl0ZW07XG4gICAgbGV0IHsgeCwgeSwgdywgaCB9ID0gaXRlbTtcblxuICAgIHcgPSBjbGFtcCh3LCBtaW5XLCBtaW4obWF4VywgY29sdW1ucykpO1xuICAgIGggPSBjbGFtcChoLCBtaW5ILCBtYXhIKTtcbiAgICB4ID0gY2xhbXAoeCwgMCwgY29sdW1ucyAtIHcpO1xuICAgIGlmICh5IDwgMCkgeSA9IDA7XG5cbiAgICBpZiAoaXRlbS54ID09PSB4ICYmIGl0ZW0ueSA9PT0geSAmJiBpdGVtLncgPT09IHcgJiYgaXRlbS5oID09PSBoKSB7XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0c0FyZUVxdWFsPFQ+KGE6IFNldDxUPiwgYjogU2V0PFQ+KSB7XG4gIGlmIChhID09PSBiKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGEuc2l6ZSAhPT0gYi5zaXplKSByZXR1cm4gZmFsc2U7XG5cbiAgZm9yIChjb25zdCBhXyBvZiBhKSB7XG4gICAgaWYgKCFiLmhhcyhhXykpIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgaWYgKHZhbHVlIDwgbWluKSByZXR1cm4gbWluO1xuICBpZiAodmFsdWUgPiBtYXgpIHJldHVybiBtYXg7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuY29uc3QgYWJzID0gTWF0aC5hYnM7XG5jb25zdCBtaW4gPSBNYXRoLm1pbjtcbmNvbnN0IHJvdW5kID0gTWF0aC5yb3VuZDtcblxuY29uc3QgQ0FQVFVSRSA9IHsgY2FwdHVyZTogdHJ1ZSB9O1xuY29uc3QgUEFTU0lWRSA9IHsgcGFzc2l2ZTogdHJ1ZSB9O1xuIl19