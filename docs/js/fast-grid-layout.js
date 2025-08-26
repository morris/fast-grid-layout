export class GridLayout {
    constructor(container, config) {
        var _a;
        this.layout = [];
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
        this.columns = (_a = config.columns) !== null && _a !== void 0 ? _a : 12;
        this.resizeObserver = new ResizeObserver(() => {
            this.layoutFlag = true;
            this.requestRender();
        });
        this.resizeObserver.observe(this.container);
        this.addEventListeners();
    }
    setConfig(config) {
        var _a;
        if (this.config === config)
            return;
        this.config = config;
        this.columns = (_a = config.columns) !== null && _a !== void 0 ? _a : 12;
        this.layout = this.fn.repairLayout(this.layout, this.columns);
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.requestRender();
    }
    setLayout(layout) {
        var _a, _b;
        if (this.layout === layout)
            return;
        this.layout = this.fn.repairLayout(layout, this.columns);
        (_b = (_a = this.config).onLayoutChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.layout);
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
        if (this.layoutFlag) {
            this.fn.renderLayout(this.container, (_a = this.tempLayout) !== null && _a !== void 0 ? _a : this.layout, this.config);
            this.layoutFlag = false;
        }
        if (this.selectionFlag) {
            this.fn.renderSelection(this.container, this.selection);
            this.selectionFlag = false;
        }
        if (this.metaFlag) {
            this.fn.renderMeta(this.container, this.dragging, this.resizeHandle);
            if (this.dragging) {
                const { dx, dy } = this.fn.calculateDrag(this.container, this.config, this.dragStartX, this.dragStartY, this.dragEndX, this.dragEndY);
                if (dx !== this.lastDeltaX || dy !== this.lastDeltaY) {
                    this.lastDeltaX = dx;
                    this.lastDeltaY = dy;
                    if (this.resizeHandle) {
                        this.tempLayout = this.fn.resizeItems(this.layout, this.columns, this.selection, dx, dy, this.resizeHandle);
                    }
                    else {
                        this.tempLayout = this.fn.moveItems(this.layout, this.columns, this.selection, dx, dy);
                    }
                    this.layoutFlag = true;
                }
            }
            this.metaFlag = false;
        }
    }
    //
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlFQSxNQUFNLE9BQU8sVUFBVTtJQWdDckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCOztRQTVCbEQsV0FBTSxHQUFxQixFQUFFLENBQUM7UUFHOUIsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFHOUIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUViLGFBQVEsR0FBRyxLQUFLLENBQUM7UUFDakIsaUJBQVksR0FBRyxLQUFLLENBQUM7UUFFckIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFJZixvQkFBZSxHQUFHLEtBQUssQ0FBQztRQUN4QixlQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLGtCQUFhLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLGFBQVEsR0FBRyxJQUFJLENBQUM7UUFFaEIsT0FBRSxHQUFHLElBQUksQ0FBQyxXQUFnQyxDQUFDO1FBNlczQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxtQkFBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9DLHVCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQs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QUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNO29CQUNSLEtBQUssSUFBSTt3QkFDUCxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE1BQU07b0JBQ1IsS0FBSyxJQUFJO3dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUMzQixNQUFNO29CQUNSLEtBQUssSUFBSTt3QkFD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SSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDbEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb25maWcge1xuICAvKipcbiAgICogTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IDEyXG4gICAqL1xuICBjb2x1bW5zPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIZWlnaHQgb2YgZWFjaCByb3cgaW4gcGl4ZWxzLlxuICAgKlxuICAgKiBAZGVmYXVsdCAzMFxuICAgKi9cbiAgcm93SGVpZ2h0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBEZWZhdWx0IGdhcCBiZXR3ZWVuIGdyaWQgY2VsbHMgKGFwcGxpZXMgdG8gYm90aCByb3dzIGFuZCBjb2x1bW5zIGlmIG5vIG92ZXJyaWRlcyBhcmUgZ2l2ZW4pLlxuICAgKlxuICAgKiBAZGVmYXVsdCAwXG4gICAqL1xuICBnYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEhvcml6b250YWwgZ2FwIGJldHdlZW4gZ3JpZCBjb2x1bW5zIGluIHBpeGVscy5cbiAgICogT3ZlcnJpZGVzIGBnYXBgIGlmIHNwZWNpZmllZC5cbiAgICpcbiAgICogQGRlZmF1bHQgZ2FwXG4gICAqL1xuICBjb2x1bW5HYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFZlcnRpY2FsIGdhcCBiZXR3ZWVuIGdyaWQgcm93cyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgcm93R2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0cmlnZ2VyZWQgd2hlbiB0aGUgbGF5b3V0IGNoYW5nZXNcbiAgICogKGUuZy4gYWZ0ZXIgZHJhZy9yZXNpemUgb3IgZXh0ZXJuYWwgdXBkYXRlKS5cbiAgICovXG4gIG9uTGF5b3V0Q2hhbmdlPzogKGxheW91dDogR3JpZExheW91dEl0ZW1bXSkgPT4gdm9pZDtcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdHJpZ2dlcmVkIHdoZW4gdGhlIHNlbGVjdGlvbiBjaGFuZ2VzXG4gICAqIChlLmcuIHVzZXIgY2xpY2tzIG9yIHRvZ2dsZXMgaXRlbSBzZWxlY3Rpb24pLlxuICAgKi9cbiAgb25TZWxlY3Rpb25DaGFuZ2U/OiAoc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikgPT4gdm9pZDtcblxuICAvKipcbiAgICogSXMgdGhlIGxheW91dCBlZGl0YWJsZT9cbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZWRpdGFibGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRJdGVtIHtcbiAgaTogc3RyaW5nO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIG1pblc/OiBudW1iZXI7XG4gIG1pbkg/OiBudW1iZXI7XG4gIG1heFc/OiBudW1iZXI7XG4gIG1heEg/OiBudW1iZXI7XG4gIHN0YXRpYz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFJlc2l6ZUhhbmRsZSA9ICduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudyc7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByb3RlY3RlZCBjb25maWc6IEdyaWRMYXlvdXRDb25maWc7XG4gIHByb3RlY3RlZCBjb2x1bW5zOiBudW1iZXI7XG4gIHByb3RlY3RlZCBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10gPSBbXTtcbiAgcHJvdGVjdGVkIHRlbXBMYXlvdXQ/OiBHcmlkTGF5b3V0SXRlbVtdO1xuXG4gIHByb3RlY3RlZCBzZWxlY3Rpb24gPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgcHJvdGVjdGVkIHJlc2l6ZUhhbmRsZT86IFJlc2l6ZUhhbmRsZTtcblxuICBwcm90ZWN0ZWQgZHJhZ1BvaW50ZXJJZCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRUaW1lID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0WSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnRW5kWCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnRW5kWSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnS2V5Pzogc3RyaW5nO1xuICBwcm90ZWN0ZWQgZHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIHByZXZlbnRDbGljayA9IGZhbHNlO1xuXG4gIHByb3RlY3RlZCBsYXN0RGVsdGFYID0gMDtcbiAgcHJvdGVjdGVkIGxhc3REZWx0YVkgPSAwO1xuXG4gIHByb3RlY3RlZCByZXNpemVPYnNlcnZlcjogUmVzaXplT2JzZXJ2ZXI7XG5cbiAgcHJvdGVjdGVkIHJlbmRlclJlcXVlc3RlZCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgbGF5b3V0RmxhZyA9IHRydWU7XG4gIHByb3RlY3RlZCBzZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIG1ldGFGbGFnID0gdHJ1ZTtcblxuICBwcm90ZWN0ZWQgZm4gPSB0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBHcmlkTGF5b3V0O1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMuY29sdW1ucyA9IGNvbmZpZy5jb2x1bW5zID8/IDEyO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7XG4gICAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfSk7XG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci5vYnNlcnZlKHRoaXMuY29udGFpbmVyKTtcblxuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIHNldENvbmZpZyhjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICBpZiAodGhpcy5jb25maWcgPT09IGNvbmZpZykgcmV0dXJuO1xuXG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgdGhpcy5jb2x1bW5zID0gY29uZmlnLmNvbHVtbnMgPz8gMTI7XG4gICAgdGhpcy5sYXlvdXQgPSB0aGlzLmZuLnJlcGFpckxheW91dCh0aGlzLmxheW91dCwgdGhpcy5jb2x1bW5zKTtcbiAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRMYXlvdXQobGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdKSB7XG4gICAgaWYgKHRoaXMubGF5b3V0ID09PSBsYXlvdXQpIHJldHVybjtcblxuICAgIHRoaXMubGF5b3V0ID0gdGhpcy5mbi5yZXBhaXJMYXlvdXQobGF5b3V0LCB0aGlzLmNvbHVtbnMpO1xuICAgIHRoaXMuY29uZmlnLm9uTGF5b3V0Q2hhbmdlPy4odGhpcy5sYXlvdXQpO1xuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHNldFNlbGVjdGlvbihzZWxlY3Rpb246IEl0ZXJhYmxlPHN0cmluZz4pIHtcbiAgICBpZiAoc2VsZWN0aW9uID09PSB0aGlzLnNlbGVjdGlvbikgcmV0dXJuO1xuXG4gICAgdGhpcy5zZWxlY3Rpb24gPSBuZXcgU2V0KHNlbGVjdGlvbik7XG4gICAgdGhpcy5jb25maWcub25TZWxlY3Rpb25DaGFuZ2U/Lih0aGlzLnNlbGVjdGlvbik7XG5cbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgdG9nZ2xlU2VsZWN0aW9uKGtleTogc3RyaW5nLCBleGNsdXNpdmUgPSBmYWxzZSkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5oYXMoa2V5KSkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVsZXRlKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChleGNsdXNpdmUpIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZWxlY3Rpb24uYWRkKGtleSk7XG4gICAgfVxuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHJlcXVlc3RSZW5kZXIoKSB7XG4gICAgaWYgKCF0aGlzLnJlbmRlclJlcXVlc3RlZCkge1xuICAgICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHRoaXMucmVuZGVyKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcigpIHtcbiAgICB0aGlzLnJlbmRlclJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMubGF5b3V0RmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJMYXlvdXQoXG4gICAgICAgIHRoaXMuY29udGFpbmVyLFxuICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPz8gdGhpcy5sYXlvdXQsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0RmxhZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlbGVjdGlvbkZsYWcpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCB0aGlzLnNlbGVjdGlvbik7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tZXRhRmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJNZXRhKHRoaXMuY29udGFpbmVyLCB0aGlzLmRyYWdnaW5nLCB0aGlzLnJlc2l6ZUhhbmRsZSk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgZHgsIGR5IH0gPSB0aGlzLmZuLmNhbGN1bGF0ZURyYWcoXG4gICAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgICAgdGhpcy5jb25maWcsXG4gICAgICAgICAgdGhpcy5kcmFnU3RhcnRYLFxuICAgICAgICAgIHRoaXMuZHJhZ1N0YXJ0WSxcbiAgICAgICAgICB0aGlzLmRyYWdFbmRYLFxuICAgICAgICAgIHRoaXMuZHJhZ0VuZFksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKGR4ICE9PSB0aGlzLmxhc3REZWx0YVggfHwgZHkgIT09IHRoaXMubGFzdERlbHRhWSkge1xuICAgICAgICAgIHRoaXMubGFzdERlbHRhWCA9IGR4O1xuICAgICAgICAgIHRoaXMubGFzdERlbHRhWSA9IGR5O1xuXG4gICAgICAgICAgaWYgKHRoaXMucmVzaXplSGFuZGxlKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPSB0aGlzLmZuLnJlc2l6ZUl0ZW1zKFxuICAgICAgICAgICAgICB0aGlzLmxheW91dCxcbiAgICAgICAgICAgICAgdGhpcy5jb2x1bW5zLFxuICAgICAgICAgICAgICB0aGlzLnNlbGVjdGlvbixcbiAgICAgICAgICAgICAgZHgsXG4gICAgICAgICAgICAgIGR5LFxuICAgICAgICAgICAgICB0aGlzLnJlc2l6ZUhhbmRsZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4ubW92ZUl0ZW1zKFxuICAgICAgICAgICAgICB0aGlzLmxheW91dCxcbiAgICAgICAgICAgICAgdGhpcy5jb2x1bW5zLFxuICAgICAgICAgICAgICB0aGlzLnNlbGVjdGlvbixcbiAgICAgICAgICAgICAgZHgsXG4gICAgICAgICAgICAgIGR5LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWV0YUZsYWcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZURvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnIHx8IGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSk7XG4gICAgICB0aGlzLmRyYWdLZXkgPSBlbGVtZW50LmRhdGFzZXQua2V5O1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZU1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcblxuICAgIGlmICghdGhpcy5kcmFnS2V5KSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IGVsZW1lbnRcbiAgICAgICAgPyB0aGlzLmNoZWNrUmVzaXplSGFuZGxlKGVsZW1lbnQsIGUpXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgICF0aGlzLmRyYWdnaW5nICYmXG4gICAgICB0aGlzLmRyYWdLZXkgJiZcbiAgICAgIChhYnModGhpcy5kcmFnRW5kWCAtIHRoaXMuZHJhZ1N0YXJ0WCkgPiB0aGlzLmZuLkRSQUdfVEhSRVNIT0xEIHx8XG4gICAgICAgIGFicyh0aGlzLmRyYWdFbmRZIC0gdGhpcy5kcmFnU3RhcnRZKSA+IHRoaXMuZm4uRFJBR19USFJFU0hPTEQpXG4gICAgKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgICAgaWYgKCF0aGlzLnNlbGVjdGlvbi5oYXModGhpcy5kcmFnS2V5KSB8fCB0aGlzLnJlc2l6ZUhhbmRsZSkge1xuICAgICAgICB0aGlzLnNldFNlbGVjdGlvbihbdGhpcy5kcmFnS2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlVXAoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnIHx8IGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy50ZW1wTGF5b3V0KSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBMYXlvdXQpO1xuICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlckRvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSByZXR1cm47XG4gICAgaWYgKHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnUG9pbnRlcklkID0gZS5wb2ludGVySWQ7XG4gICAgdGhpcy5kcmFnU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLmRyYWdTdGFydFggPSB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdTdGFydFkgPSB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcblxuICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICBpZiAoZWxlbWVudD8uZGF0YXNldC5rZXkgJiYgdGhpcy5zZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkpKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gdGhpcy5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCBlKTtcblxuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJNb3ZlKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJJZCAhPT0gdGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcblxuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5kcmFnU3RhcnRUaW1lID4gRGF0ZS5ub3coKSAtIHRoaXMuZm4uVEFQX0RFTEFZICYmXG4gICAgICBhYnModGhpcy5kcmFnRW5kWCAtIHRoaXMuZHJhZ1N0YXJ0WCkgPCB0aGlzLmZuLlRBUF9USFJFU0hPTEQgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRZIC0gdGhpcy5kcmFnU3RhcnRZKSA8IHRoaXMuZm4uVEFQX1RIUkVTSE9MRFxuICAgICkge1xuICAgICAgLy8gSXQncyBhIHRhcC5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5LCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMudGVtcExheW91dCkge1xuICAgICAgdGhpcy5zZXRMYXlvdXQodGhpcy50ZW1wTGF5b3V0KTtcbiAgICAgIHRoaXMudGVtcExheW91dCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZUNsaWNrKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBpZiAodGhpcy5wcmV2ZW50Q2xpY2spIHtcbiAgICAgIHRoaXMucHJldmVudENsaWNrID0gZmFsc2U7XG5cbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghZS5jdHJsS2V5ICYmICFlLm1ldGFLZXkpIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgICBpZiAoZWxlbWVudD8uZGF0YXNldC5rZXkpIHtcbiAgICAgICAgdGhpcy50b2dnbGVTZWxlY3Rpb24oZWxlbWVudC5kYXRhc2V0LmtleSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZUtleVVwKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKGUua2V5KSB7XG4gICAgICBjYXNlICdFc2NhcGUnOlxuICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5yZXNldERyYWcoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJlc2V0RHJhZygpIHtcbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VsZWN0aW9uID0gKGRvY3VtZW50LmRlZmF1bHRWaWV3IHx8IHdpbmRvdykuZ2V0U2VsZWN0aW9uKCk7XG5cbiAgICAgICAgaWYgKHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24udHlwZSAhPT0gJ0NhcmV0Jykge1xuICAgICAgICAgIHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIGlnbm9yZVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5kcmFnUG9pbnRlcklkID0gMDtcbiAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kcmFnS2V5ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucmVzaXplSGFuZGxlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMubGFzdERlbHRhWCA9IDA7XG4gICAgdGhpcy5sYXN0RGVsdGFZID0gMDtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXRUYXJnZXRFbGVtZW50KGU6IEV2ZW50KSB7XG4gICAgaWYgKGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgY29uc3QgaXRlbSA9IGUudGFyZ2V0LmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCcuZmFzdC1ncmlkLWxheW91dCA+IC5pdGVtJyk7XG5cbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXN0YXRpYycpKSByZXR1cm47XG4gICAgICAgIGlmIChpdGVtLmNsYXNzTGlzdC5jb250YWlucygnLXNlbGVjdGVkJykpIHJldHVybiBpdGVtO1xuXG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBlLnRhcmdldC5jbG9zZXN0PEhUTUxFbGVtZW50PihcbiAgICAgICAgICAnLmZhc3QtZ3JpZC1sYXlvdXQgLmNvbnRlbnQsIGJ1dHRvbiwgaW5wdXQsIHRleHRhcmVhLCBzZWxlY3QnLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghY29udGVudCkgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudDogSFRNTEVsZW1lbnQsIGV2ZW50OiBQb2ludGVyRXZlbnQpIHtcbiAgICBjb25zdCBoYW5kbGUgPSB0aGlzLmZuLmNoZWNrUmVzaXplSGFuZGxlKFxuICAgICAgZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgIGV2ZW50LmNsaWVudFgsXG4gICAgICBldmVudC5jbGllbnRZLFxuICAgICAgdGhpcy5mbi5SRVNJWkVfVEhSRVNIT0xELFxuICAgICk7XG5cbiAgICBzd2l0Y2ggKGhhbmRsZSkge1xuICAgICAgY2FzZSAnbic6XG4gICAgICBjYXNlICduZSc6XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIC8vIERpc2FibGUgbm9ydGggaGFuZGxlcyBmb3Igbm93LCBhcyBpdCBmZWVscyB1bm5hdHVyYWwuXG4gICAgICAgIC8vIFRPRE8gbWFrZSBjb25maWd1cmFibGU/XG4gICAgICAgIHJldHVybjtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBkaXNjb25uZWN0KCkge1xuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgdGhpcy5mbi5yZW5kZXJTZWxlY3Rpb24odGhpcy5jb250YWluZXIsIG5ldyBTZXQoKSk7XG4gICAgdGhpcy5mbi5yZW5kZXJNZXRhKHRoaXMuY29udGFpbmVyLCBmYWxzZSk7XG5cbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLnVub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZURvd24gPSB0aGlzLmhhbmRsZU1vdXNlRG93bi5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlTW92ZSA9IHRoaXMuaGFuZGxlTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VVcCA9IHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlckRvd24gPSB0aGlzLmhhbmRsZVBvaW50ZXJEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlck1vdmUgPSB0aGlzLmhhbmRsZVBvaW50ZXJNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlclVwID0gdGhpcy5oYW5kbGVQb2ludGVyVXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgX2hhbmRsZUNsaWNrID0gdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZUtleVVwID0gdGhpcy5oYW5kbGVLZXlVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZU1vdXNlRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlTW91c2VNb3ZlLCBQQVNTSVZFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcblxuICAgIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlUG9pbnRlckRvd24pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZVBvaW50ZXJNb3ZlLCBQQVNTSVZFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9oYW5kbGVDbGljaywgQ0FQVFVSRSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgcHJvdGVjdGVkIHJlbW92ZUV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCBDQVBUVVJFKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICAvL1xuXG4gIHN0YXRpYyBERUZBVUxUX0NPTFVNTlMgPSAxMjtcbiAgc3RhdGljIERFRkFVTFRfUk9XX0hFSUdIVCA9IDMwO1xuICBzdGF0aWMgREVGQVVMVF9HQVAgPSAwO1xuXG4gIHN0YXRpYyBSRVNJWkVfVEhSRVNIT0xEID0gMTA7XG4gIHN0YXRpYyBUQVBfREVMQVkgPSAyNTA7XG4gIHN0YXRpYyBUQVBfVEhSRVNIT0xEID0gMTA7XG4gIHN0YXRpYyBEUkFHX1RIUkVTSE9MRCA9IDc7XG5cbiAgc3RhdGljIHJlbmRlckxheW91dChcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIGdhcCA9IHRoaXMuREVGQVVMVF9HQVAsXG4gICAgICBjb2x1bW5HYXAgPSBnYXAsXG4gICAgICByb3dHYXAgPSBnYXAsXG4gICAgICByb3dIZWlnaHQgPSB0aGlzLkRFRkFVTFRfUk9XX0hFSUdIVCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgY29sdW1uV2lkdGhBbmRHYXAgPSBjb2x1bW5XaWR0aCArIGNvbHVtbkdhcDtcbiAgICBjb25zdCByb3dIZWlnaHRBbmRHYXAgPSByb3dIZWlnaHQgKyByb3dHYXA7XG5cbiAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZmFzdC1ncmlkLWxheW91dCcpO1xuXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtPigpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuICAgICAgbWFwLnNldChpdGVtLmksIGl0ZW0pO1xuICAgIH1cblxuICAgIGxldCBoTWF4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnQuZGF0YXNldC5rZXkpIHtcbiAgICAgICAgZWxlbWVudC5kYXRhc2V0LmtleSA9IGkudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5kYXRhc2V0LmtleTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtYXAuZ2V0KGtleSk7XG5cbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2l0ZW0nKTtcbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnLWR5bmFtaWMnLCAhaXRlbS5zdGF0aWMpO1xuICAgICAgZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCctc3RhdGljJywgISFpdGVtLnN0YXRpYyk7XG5cbiAgICAgIGNvbnN0IGggPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGlmIChoID4gaE1heCkge1xuICAgICAgICBoTWF4ID0gaDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2lkdGggPSByb3VuZChpdGVtLncgKiBjb2x1bW5XaWR0aEFuZEdhcCAtIGNvbHVtbkdhcCkgKyAncHgnO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gcm91bmQoaXRlbS5oICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG4gICAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlKCcgK1xuICAgICAgICByb3VuZChpdGVtLnggKiBjb2x1bW5XaWR0aEFuZEdhcCkgK1xuICAgICAgICAncHgsICcgK1xuICAgICAgICByb3VuZChpdGVtLnkgKiByb3dIZWlnaHRBbmRHYXApICtcbiAgICAgICAgJ3B4KSc7XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLndpZHRoICE9PSB3aWR0aCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gIT09IHRyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSByb3VuZChoTWF4ICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG5cbiAgICBpZiAoY29udGFpbmVyLnN0eWxlLmhlaWdodCAhPT0gY29udGFpbmVySGVpZ2h0KSB7XG4gICAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJTZWxlY3Rpb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5IGFzIHN0cmluZyksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHJlbmRlck1ldGEoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBkcmFnZ2luZzogYm9vbGVhbixcbiAgICByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctbW92aW5nJywgZHJhZ2dpbmcgJiYgIXJlc2l6ZUhhbmRsZSk7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1yZXNpemluZycsIGRyYWdnaW5nICYmICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IHJvb3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19oaWRlLXNlbGVjdGlvbicsIGRyYWdnaW5nKTtcbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19mb3JjZS1jdXJzb3InLCAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGUpO1xuXG4gICAgaWYgKHJvb3Quc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1mb3JjZS1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZvcmNlLWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNhbGN1bGF0ZURyYWcoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgZHJhZ1N0YXJ0WDogbnVtYmVyLFxuICAgIGRyYWdTdGFydFk6IG51bWJlcixcbiAgICBkcmFnRW5kWDogbnVtYmVyLFxuICAgIGRyYWdFbmRZOiBudW1iZXIsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIHJvd0hlaWdodCA9IHRoaXMuREVGQVVMVF9ST1dfSEVJR0hULFxuICAgICAgZ2FwID0gdGhpcy5ERUZBVUxUX0dBUCxcbiAgICAgIGNvbHVtbkdhcCA9IGdhcCxcbiAgICAgIHJvd0dhcCA9IGdhcCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgZHggPSByb3VuZCgoZHJhZ0VuZFggLSBkcmFnU3RhcnRYKSAvIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkpO1xuICAgIGNvbnN0IGR5ID0gcm91bmQoKGRyYWdFbmRZIC0gZHJhZ1N0YXJ0WSkgLyAocm93SGVpZ2h0ICsgcm93R2FwKSk7XG5cbiAgICByZXR1cm4geyBkeCwgZHkgfTtcbiAgfVxuXG4gIHN0YXRpYyBjaGVja1Jlc2l6ZUhhbmRsZShcbiAgICBjbGllbnRSZWN0OiBET01SZWN0LFxuICAgIGNsaWVudFg6IG51bWJlcixcbiAgICBjbGllbnRZOiBudW1iZXIsXG4gICAgdGhyZXNob2xkOiBudW1iZXIsXG4gICk6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbiA9IGNsaWVudFkgLSBjbGllbnRSZWN0LnRvcCA8IHRocmVzaG9sZDtcbiAgICBjb25zdCBlID0gY2xpZW50UmVjdC5yaWdodCAtIGNsaWVudFggPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgcyA9IGNsaWVudFJlY3QuYm90dG9tIC0gY2xpZW50WSA8IHRocmVzaG9sZDtcbiAgICBjb25zdCB3ID0gY2xpZW50WCAtIGNsaWVudFJlY3QubGVmdCA8IHRocmVzaG9sZDtcblxuICAgIGlmIChzKSB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gJ3NlJztcbiAgICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgICByZXR1cm4gJ3N3JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAncyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlKSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ25lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3KSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ253JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAndyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuKSB7XG4gICAgICByZXR1cm4gJ24nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBnZXRSZXNpemVDdXJzb3IocmVzaXplSGFuZGxlOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQpIHtcbiAgICBzd2l0Y2ggKHJlc2l6ZUhhbmRsZSkge1xuICAgICAgY2FzZSAnbic6XG4gICAgICBjYXNlICdzJzpcbiAgICAgICAgcmV0dXJuICducy1yZXNpemUnO1xuICAgICAgY2FzZSAnZSc6XG4gICAgICBjYXNlICd3JzpcbiAgICAgICAgcmV0dXJuICdldy1yZXNpemUnO1xuICAgICAgY2FzZSAnbmUnOlxuICAgICAgY2FzZSAnc3cnOlxuICAgICAgICByZXR1cm4gJ25lc3ctcmVzaXplJztcbiAgICAgIGNhc2UgJ3NlJzpcbiAgICAgIGNhc2UgJ253JzpcbiAgICAgICAgcmV0dXJuICdud3NlLXJlc2l6ZSc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1vdmVzIHRoZSBzcGVjaWZpZWQgaXRlbXMgKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyBtb3ZlSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgKSB7XG4gICAgaWYgKChkeCA9PT0gMCAmJiBkeSA9PT0gMCkgfHwgc2VsZWN0aW9uLnNpemUgPT09IDApIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgbGV0IG91dCA9IGxheW91dDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcblxuICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoaXRlbS5pKSkge1xuICAgICAgICBjb25zdCB4ID0gaXRlbS54ICsgZHg7XG4gICAgICAgIGNvbnN0IHkgPSBpdGVtLnkgKyBkeTtcblxuICAgICAgICBpZiAoaXRlbS54ICE9PSB4IHx8IGl0ZW0ueSAhPT0geSkge1xuICAgICAgICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgICAgICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICAgICAgICAgIG91dCA9IGxheW91dC5zbGljZSgwKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvdXRbaV0gPSB7IC4uLml0ZW0sIHgsIHkgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2l6ZXMgdGhlIHNwZWNpZmllZCBpdGVtIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgcmVzaXplSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgICBoYW5kbGU6IFJlc2l6ZUhhbmRsZSxcbiAgKSB7XG4gICAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeyBtYXhXID0gY29sdW1ucywgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgICAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuICAgICAgICBjb25zdCB4dyA9IHggKyB3O1xuICAgICAgICBjb25zdCB5aCA9IHkgKyBoO1xuICAgICAgICBjb25zdCBjeCA9IGNvbHVtbnMgLSB4O1xuXG4gICAgICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdlJzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncyc6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3cnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICB4ID0gY2xhbXAoeCArIGR4LCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbmUnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgKyBkeCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoICsgZHksIDEsIG1heEgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc3cnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdudyc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoIC0gZHksIDEsIG1heEgpO1xuICAgICAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnggIT09IHggfHwgaXRlbS55ICE9PSB5IHx8IGl0ZW0udyAhPT0gdyB8fCBpdGVtLmggIT09IGgpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeGVzIG92ZXJsYXBzLCBnYXBzLCBhbmQgbGF5b3V0IG91dCBvZiBib3VuZHMuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlyTGF5b3V0KFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uPzogU2V0PHN0cmluZz4sXG4gICkge1xuICAgIC8vIFNvcnQgYnkgcm93IGZpcnN0LCBzZWxlY3Rpb24gc2Vjb25kIChpZiBhbnkpLCBjb2x1bW4gdGhpcmQuXG4gICAgY29uc3Qgc29ydGVkSXRlbXMgPSBsYXlvdXQuc2xpY2UoMCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgaWYgKGEueSA8IGIueSkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEueSA+IGIueSkgcmV0dXJuIDE7XG5cbiAgICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoYS5pKSkge1xuICAgICAgICAgIGlmICghc2VsZWN0aW9uLmhhcyhiLmkpKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGlvbi5oYXMoYi5pKSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhLnggPCBiLngpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLnggPiBiLngpIHJldHVybiAxO1xuXG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0YXRpY0l0ZW1zID0gc29ydGVkSXRlbXMuZmlsdGVyKChpdGVtKSA9PiBpdGVtLnN0YXRpYyk7XG4gICAgY29uc3QgbnVtU3RhdGljcyA9IHN0YXRpY0l0ZW1zLmxlbmd0aDtcbiAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcbiAgICBsZXQgc3RhdGljT2Zmc2V0ID0gMDtcblxuICAgIC8vIFwiUmlzaW5nIHRpZGVcIiwgaS5lLiBudW1iZXIgb2YgYmxvY2tlZCBjZWxscyBwZXIgY29sdW1uLlxuICAgIGNvbnN0IHRpZGU6IG51bWJlcltdID0gQXJyYXkoY29sdW1ucyk7XG5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGNvbHVtbnM7ICsreCkge1xuICAgICAgdGlkZVt4XSA9IDA7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBzb3J0ZWRJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBhbGxvdyBpdGVtcyB0byBiZSBvdXQgb2YgYm91bmRzIGR1cmluZyBzb3J0aW5nLFxuICAgICAgLy8gd2hpY2ggKGZvciBleGFtcGxlKSBhbGxvd3MgbW92aW5nIGl0ZW1zIFwiYmVmb3JlXCIgdGhlIGZpcnN0IGl0ZW0uXG4gICAgICAvLyBXZSBmaXggYW55IG91dCBvZiBib3VuZCBpc3N1ZXMgaGVyZS5cbiAgICAgIGxldCBpdGVtID0gdGhpcy5yZXBhaXJJdGVtKHNvcnRlZEl0ZW1zW2ldLCBjb2x1bW5zKTtcbiAgICAgIGNvbnN0IHgyID0gaXRlbS54ICsgaXRlbS53O1xuXG4gICAgICBpZiAoaXRlbS5zdGF0aWMpIHtcbiAgICAgICAgLy8gVGhpcyBzdGF0aWMgaXRlbSB3aWxsIGJlIHBhcnQgb2YgdGhlIHRpZGVcbiAgICAgICAgLy8gYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgY29uc2lkZXJlZCBmb3IgY29sbGlzaW9uIGFueW1vcmUuXG4gICAgICAgIC8vIFNpbmNlIHN0YXRpYyBpdGVtIHdpbGwgYmUgdmlzaXRlZCBpbiB0aGUgc2FtZSBvcmRlclxuICAgICAgICAvLyBhcyB0aGUgc3RhdGljSXRlbXMgYXJyYXksIHdlIGNhbiBqdXN0IGluY3JlbWVudCB0aGUgb2Zmc2V0IGhlcmUuXG4gICAgICAgICsrc3RhdGljT2Zmc2V0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGV0ZWN0IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAgd2l0aCB0aWRlLlxuICAgICAgICBsZXQgbWluR2FwID0gSW5maW5pdHk7XG5cbiAgICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgICBjb25zdCBnYXAgPSBpdGVtLnkgLSB0aWRlW3hdO1xuXG4gICAgICAgICAgaWYgKGdhcCA8IG1pbkdhcCkge1xuICAgICAgICAgICAgbWluR2FwID0gZ2FwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpeCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwLlxuICAgICAgICBsZXQgeU5leHQgPSBpdGVtLnkgLSBtaW5HYXA7XG5cbiAgICAgICAgLy8gSGFuZGxlIGNvbGxpc2lvbiB3aXRoIHN0YXRpYyBpdGVtcy5cbiAgICAgICAgZm9yIChsZXQgaiA9IHN0YXRpY09mZnNldDsgaiA8IG51bVN0YXRpY3M7ICsraikge1xuICAgICAgICAgIGNvbnN0IHN0YXRpY0l0ZW0gPSBzdGF0aWNJdGVtc1tqXTtcblxuICAgICAgICAgIGlmIChzdGF0aWNJdGVtLnkgPj0geU5leHQgKyBpdGVtLmgpIHtcbiAgICAgICAgICAgIC8vIEZvbGxvd2luZyBzdGF0aWMgaXRlbXMgY2Fubm90IGNvbGxpZGUgYmVjYXVzZSBvZiBzb3J0aW5nOyBzdG9wLlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgLy9zdGF0aWNJdGVtLnkgPCB5TmV4dCArIGl0ZW0uaCAmJiAvLyBUaGlzIGlzIGltcGxpZWQgYWJvdmUuXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnkgKyBzdGF0aWNJdGVtLmggPiB5TmV4dCAmJlxuICAgICAgICAgICAgc3RhdGljSXRlbS54IDwgaXRlbS54ICsgaXRlbS53ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggKyBzdGF0aWNJdGVtLncgPiBpdGVtLnhcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIENvbGxpc2lvbiBkZXRlY3RlZDsgbW92ZSBjdXJyZW50IGl0ZW0gYmVsb3cgc3RhdGljIGl0ZW0uXG4gICAgICAgICAgICB5TmV4dCA9IHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaDtcblxuICAgICAgICAgICAgLy8gQ3VycmVudCBpdGVtIHdhcyBtb3ZlZDtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gcmVjaGVjayBjb2xsaXNpb24gd2l0aCBvdGhlciBzdGF0aWMgaXRlbXMuXG4gICAgICAgICAgICBqID0gc3RhdGljT2Zmc2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnkgIT09IHlOZXh0KSB7XG4gICAgICAgICAgaXRlbSA9IHsgLi4uaXRlbSwgeTogeU5leHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtICE9PSBzb3J0ZWRJdGVtc1tpXSkge1xuICAgICAgICAgIHNvcnRlZEl0ZW1zW2ldID0gaXRlbTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRpZGUuXG4gICAgICBjb25zdCB0ID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICBpZiAodGlkZVt4XSA8IHQpIHtcbiAgICAgICAgICB0aWRlW3hdID0gdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZCA/IHNvcnRlZEl0ZW1zIDogbGF5b3V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGFpciBib3VuZHMgb2YgdGhlIGdpdmVuIGl0ZW0gdG8gZml0IHRoZSBnaXZlbiBjb25maWcuXG4gICAqIFJldHVybnMgYSBuZXcgaXRlbSBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckl0ZW0oaXRlbTogR3JpZExheW91dEl0ZW0sIGNvbHVtbnM6IG51bWJlcikge1xuICAgIGNvbnN0IHsgbWluVyA9IDEsIG1heFcgPSBjb2x1bW5zLCBtaW5IID0gMSwgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgIGxldCB7IHgsIHksIHcsIGggfSA9IGl0ZW07XG5cbiAgICB3ID0gY2xhbXAodywgbWluVywgbWluKG1heFcsIGNvbHVtbnMpKTtcbiAgICBoID0gY2xhbXAoaCwgbWluSCwgbWF4SCk7XG4gICAgeCA9IGNsYW1wKHgsIDAsIGNvbHVtbnMgLSB3KTtcbiAgICBpZiAoeSA8IDApIHkgPSAwO1xuXG4gICAgaWYgKGl0ZW0ueCA9PT0geCAmJiBpdGVtLnkgPT09IHkgJiYgaXRlbS53ID09PSB3ICYmIGl0ZW0uaCA9PT0gaCkge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsYW1wKHZhbHVlOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICBpZiAodmFsdWUgPCBtaW4pIHJldHVybiBtaW47XG4gIGlmICh2YWx1ZSA+IG1heCkgcmV0dXJuIG1heDtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5jb25zdCBhYnMgPSBNYXRoLmFicztcbmNvbnN0IG1pbiA9IE1hdGgubWluO1xuY29uc3Qgcm91bmQgPSBNYXRoLnJvdW5kO1xuXG5jb25zdCBDQVBUVVJFID0geyBjYXB0dXJlOiB0cnVlIH07XG5jb25zdCBQQVNTSVZFID0geyBwYXNzaXZlOiB0cnVlIH07XG4iXX0=