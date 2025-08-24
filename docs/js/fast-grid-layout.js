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
        this.dragX = 0;
        this.dragY = 0;
        this.preventClick = false;
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
                if (dx !== this.dragX || dy !== this.dragY) {
                    this.dragX = dx;
                    this.dragY = dy;
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
        const element = this.getTargetItem(e);
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
            const element = this.getTargetItem(e);
            this.resizeHandle = element
                ? this.checkResizeHandle(element, e)
                : undefined;
        }
        if (this.dragKey && !this.dragging) {
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
        const element = this.getTargetItem(e);
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
        if (this.dragStartTime >= Date.now() - this.fn.TAP_DELAY &&
            abs(this.dragEndX - this.dragStartX) < this.fn.TAP_THRESHOLD &&
            abs(this.dragEndY - this.dragStartY) < this.fn.TAP_THRESHOLD) {
            // It's a tap.
            const element = this.getTargetItem(e);
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
            const element = this.getTargetItem(e);
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
        this.dragX = 0;
        this.dragY = 0;
        this.metaFlag = true;
        this.requestRender();
    }
    getTargetItem(e) {
        if (e.target instanceof Element) {
            return e.target.closest('.fast-grid-layout > .item');
        }
    }
    checkResizeHandle(element, event) {
        const handle = this.fn.checkResizeHandle(element.getBoundingClientRect(), event.clientX, event.clientY, 10);
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
GridLayout.TAP_DELAY = 250;
GridLayout.TAP_THRESHOLD = 10;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlFQSxNQUFNLE9BQU8sVUFBVTtJQStCckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCOztRQTNCbEQsV0FBTSxHQUFxQixFQUFFLENBQUM7UUFHOUIsY0FBUyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFHOUIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsa0JBQWEsR0FBRyxDQUFDLENBQUM7UUFDbEIsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUViLGFBQVEsR0FBRyxLQUFLLENBQUM7UUFDakIsVUFBSyxHQUFHLENBQUMsQ0FBQztRQUNWLFVBQUssR0FBRyxDQUFDLENBQUM7UUFDVixpQkFBWSxHQUFHLEtBQUssQ0FBQztRQUlyQixvQkFBZSxHQUFHLEtBQUssQ0FBQztRQUN4QixlQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLGtCQUFhLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLGFBQVEsR0FBRyxJQUFJLENBQUM7UUFFaEIsT0FBRSxHQUFHLElBQUksQ0FBQyxXQUFnQyxDQUFDO1FBMlYzQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxtQkFBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9DLHVCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQs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QUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBQzNCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNO29CQUNSLEtBQUssR0FBRzt3QkFDTixDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsTUFBTTtvQkFDUixLQUFLLEdBQUc7d0JBQ04sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixNQUFNO29CQUNSLEtBQUssSUFBSTt3QkFDUCxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE1BQU07b0JBQ1IsS0FBSyxJQUFJO3dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUMzQixNQUFNO29CQUNSLEtBQUssSUFBSTt3QkFDUCxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQzt3QkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQzt3QkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE1BQU07b0JBQ1IsS0FBSyxJQUFJO3dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO3dCQUMzQixDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDN0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7d0JBQzdCLE1BQU07Z0JBQ1YsQ0FBQztnQkFFRCxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFD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SSxLQUFLLEdBQUcsR0FBRztRQUFFLE9BQU8sR0FBRyxDQUFDO0lBQzVCLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDckIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBRXpCLE1BQU0sT0FBTyxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ2xDLE1BQU0sT0FBTyxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0Q29uZmlnIHtcbiAgLyoqXG4gICAqIE51bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMlxuICAgKi9cbiAgY29sdW1ucz86IG51bWJlcjtcblxuICAvKipcbiAgICogSGVpZ2h0IG9mIGVhY2ggcm93IGluIHBpeGVscy5cbiAgICpcbiAgICogQGRlZmF1bHQgMzBcbiAgICovXG4gIHJvd0hlaWdodD86IG51bWJlcjtcblxuICAvKipcbiAgICogRGVmYXVsdCBnYXAgYmV0d2VlbiBncmlkIGNlbGxzIChhcHBsaWVzIHRvIGJvdGggcm93cyBhbmQgY29sdW1ucyBpZiBubyBvdmVycmlkZXMgYXJlIGdpdmVuKS5cbiAgICpcbiAgICogQGRlZmF1bHQgMFxuICAgKi9cbiAgZ2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIb3Jpem9udGFsIGdhcCBiZXR3ZWVuIGdyaWQgY29sdW1ucyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgY29sdW1uR2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBWZXJ0aWNhbCBnYXAgYmV0d2VlbiBncmlkIHJvd3MgaW4gcGl4ZWxzLlxuICAgKiBPdmVycmlkZXMgYGdhcGAgaWYgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBnYXBcbiAgICovXG4gIHJvd0dhcD86IG51bWJlcjtcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdHJpZ2dlcmVkIHdoZW4gdGhlIGxheW91dCBjaGFuZ2VzXG4gICAqIChlLmcuIGFmdGVyIGRyYWcvcmVzaXplIG9yIGV4dGVybmFsIHVwZGF0ZSkuXG4gICAqL1xuICBvbkxheW91dENoYW5nZT86IChsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10pID0+IHZvaWQ7XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHRyaWdnZXJlZCB3aGVuIHRoZSBzZWxlY3Rpb24gY2hhbmdlc1xuICAgKiAoZS5nLiB1c2VyIGNsaWNrcyBvciB0b2dnbGVzIGl0ZW0gc2VsZWN0aW9uKS5cbiAgICovXG4gIG9uU2VsZWN0aW9uQ2hhbmdlPzogKHNlbGVjdGlvbjogU2V0PHN0cmluZz4pID0+IHZvaWQ7XG5cbiAgLyoqXG4gICAqIElzIHRoZSBsYXlvdXQgZWRpdGFibGU/XG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVkaXRhYmxlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0SXRlbSB7XG4gIGk6IHN0cmluZztcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHc6IG51bWJlcjtcbiAgaDogbnVtYmVyO1xuICBtaW5XPzogbnVtYmVyO1xuICBtaW5IPzogbnVtYmVyO1xuICBtYXhXPzogbnVtYmVyO1xuICBtYXhIPzogbnVtYmVyO1xuICBzdGF0aWM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBSZXNpemVIYW5kbGUgPSAnbicgfCAnZScgfCAncycgfCAndycgfCAnbmUnIHwgJ3NlJyB8ICdzdycgfCAnbncnO1xuXG5leHBvcnQgY2xhc3MgR3JpZExheW91dCB7XG4gIHByb3RlY3RlZCBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcm90ZWN0ZWQgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnO1xuICBwcm90ZWN0ZWQgY29sdW1uczogbnVtYmVyO1xuICBwcm90ZWN0ZWQgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdID0gW107XG4gIHByb3RlY3RlZCB0ZW1wTGF5b3V0PzogR3JpZExheW91dEl0ZW1bXTtcblxuICBwcm90ZWN0ZWQgc2VsZWN0aW9uID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByb3RlY3RlZCByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGU7XG5cbiAgcHJvdGVjdGVkIGRyYWdQb2ludGVySWQgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0VGltZSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0tleT86IHN0cmluZztcbiAgcHJvdGVjdGVkIGRyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBkcmFnWCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnWSA9IDA7XG4gIHByb3RlY3RlZCBwcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICBwcm90ZWN0ZWQgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyO1xuXG4gIHByb3RlY3RlZCByZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGxheW91dEZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gIHByb3RlY3RlZCBtZXRhRmxhZyA9IHRydWU7XG5cbiAgcHJvdGVjdGVkIGZuID0gdGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgR3JpZExheW91dDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmNvbHVtbnMgPSBjb25maWcuY29sdW1ucyA/PyAxMjtcblxuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICAgIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG5cbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cblxuICBzZXRDb25maWcoY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnKSB7XG4gICAgaWYgKHRoaXMuY29uZmlnID09PSBjb25maWcpIHJldHVybjtcblxuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMuY29sdW1ucyA9IGNvbmZpZy5jb2x1bW5zID8/IDEyO1xuICAgIHRoaXMubGF5b3V0ID0gdGhpcy5mbi5yZXBhaXJMYXlvdXQodGhpcy5sYXlvdXQsIHRoaXMuY29sdW1ucyk7XG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgc2V0TGF5b3V0KGxheW91dDogR3JpZExheW91dEl0ZW1bXSkge1xuICAgIGlmICh0aGlzLmxheW91dCA9PT0gbGF5b3V0KSByZXR1cm47XG5cbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgdGhpcy5jb2x1bW5zKTtcbiAgICB0aGlzLmNvbmZpZy5vbkxheW91dENoYW5nZT8uKHRoaXMubGF5b3V0KTtcblxuICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRTZWxlY3Rpb24oc2VsZWN0aW9uOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG4gICAgaWYgKHNlbGVjdGlvbiA9PT0gdGhpcy5zZWxlY3Rpb24pIHJldHVybjtcblxuICAgIHRoaXMuc2VsZWN0aW9uID0gbmV3IFNldChzZWxlY3Rpb24pO1xuICAgIHRoaXMuY29uZmlnLm9uU2VsZWN0aW9uQ2hhbmdlPy4odGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHRvZ2dsZVNlbGVjdGlvbihrZXk6IHN0cmluZywgZXhjbHVzaXZlID0gZmFsc2UpIHtcbiAgICBpZiAodGhpcy5zZWxlY3Rpb24uaGFzKGtleSkpIHtcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmRlbGV0ZShrZXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZXhjbHVzaXZlKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0aW9uLmNsZWFyKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2VsZWN0aW9uLmFkZChrZXkpO1xuICAgIH1cblxuICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBjbGVhclNlbGVjdGlvbigpIHtcbiAgICBpZiAodGhpcy5zZWxlY3Rpb24uc2l6ZSA+IDApIHtcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmNsZWFyKCk7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICByZXF1ZXN0UmVuZGVyKCkge1xuICAgIGlmICghdGhpcy5yZW5kZXJSZXF1ZXN0ZWQpIHtcbiAgICAgIHRoaXMucmVuZGVyUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB0aGlzLnJlbmRlcigpKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLmxheW91dEZsYWcpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyTGF5b3V0KFxuICAgICAgICB0aGlzLmNvbnRhaW5lcixcbiAgICAgICAgdGhpcy50ZW1wTGF5b3V0ID8/IHRoaXMubGF5b3V0LFxuICAgICAgICB0aGlzLmNvbmZpZyxcbiAgICAgICk7XG4gICAgICB0aGlzLmxheW91dEZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zZWxlY3Rpb25GbGFnKSB7XG4gICAgICB0aGlzLmZuLnJlbmRlclNlbGVjdGlvbih0aGlzLmNvbnRhaW5lciwgdGhpcy5zZWxlY3Rpb24pO1xuICAgICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubWV0YUZsYWcpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyTWV0YSh0aGlzLmNvbnRhaW5lciwgdGhpcy5kcmFnZ2luZywgdGhpcy5yZXNpemVIYW5kbGUpO1xuXG4gICAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgICBjb25zdCB7IGR4LCBkeSB9ID0gdGhpcy5mbi5jYWxjdWxhdGVEcmFnKFxuICAgICAgICAgIHRoaXMuY29udGFpbmVyLFxuICAgICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgICAgIHRoaXMuZHJhZ1N0YXJ0WCxcbiAgICAgICAgICB0aGlzLmRyYWdTdGFydFksXG4gICAgICAgICAgdGhpcy5kcmFnRW5kWCxcbiAgICAgICAgICB0aGlzLmRyYWdFbmRZLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChkeCAhPT0gdGhpcy5kcmFnWCB8fCBkeSAhPT0gdGhpcy5kcmFnWSkge1xuICAgICAgICAgIHRoaXMuZHJhZ1ggPSBkeDtcbiAgICAgICAgICB0aGlzLmRyYWdZID0gZHk7XG5cbiAgICAgICAgICBpZiAodGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4ucmVzaXplSXRlbXMoXG4gICAgICAgICAgICAgIHRoaXMubGF5b3V0LFxuICAgICAgICAgICAgICB0aGlzLmNvbHVtbnMsXG4gICAgICAgICAgICAgIHRoaXMuc2VsZWN0aW9uLFxuICAgICAgICAgICAgICBkeCxcbiAgICAgICAgICAgICAgZHksXG4gICAgICAgICAgICAgIHRoaXMucmVzaXplSGFuZGxlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdGhpcy5mbi5tb3ZlSXRlbXMoXG4gICAgICAgICAgICAgIHRoaXMubGF5b3V0LFxuICAgICAgICAgICAgICB0aGlzLmNvbHVtbnMsXG4gICAgICAgICAgICAgIHRoaXMuc2VsZWN0aW9uLFxuICAgICAgICAgICAgICBkeCxcbiAgICAgICAgICAgICAgZHksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5tZXRhRmxhZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8vXG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5kcmFnU3RhcnRYID0gdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnU3RhcnRZID0gdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRJdGVtKGUpO1xuXG4gICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gdGhpcy5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCBlKTtcbiAgICAgIHRoaXMuZHJhZ0tleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuXG4gICAgaWYgKCF0aGlzLmRyYWdLZXkpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEl0ZW0oZSk7XG5cbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gZWxlbWVudFxuICAgICAgICA/IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSlcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZHJhZ0tleSAmJiAhdGhpcy5kcmFnZ2luZykge1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG5cbiAgICAgIGlmICghdGhpcy5zZWxlY3Rpb24uaGFzKHRoaXMuZHJhZ0tleSkgfHwgdGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgICAgdGhpcy5zZXRTZWxlY3Rpb24oW3RoaXMuZHJhZ0tleV0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZVVwKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSAhPT0gJ21vdXNlJyB8fCBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMudGVtcExheW91dCkge1xuICAgICAgdGhpcy5zZXRMYXlvdXQodGhpcy50ZW1wTGF5b3V0KTtcbiAgICAgIHRoaXMudGVtcExheW91dCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJEb3duKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmICh0aGlzLmRyYWdQb2ludGVySWQpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ1BvaW50ZXJJZCA9IGUucG9pbnRlcklkO1xuICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5kcmFnU3RhcnRYID0gdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnU3RhcnRZID0gdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG5cbiAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRJdGVtKGUpO1xuXG4gICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5ICYmIHRoaXMuc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5KSkge1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IHRydWU7XG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgZSk7XG5cbiAgICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnRW5kWCA9IGUucGFnZVg7XG4gICAgdGhpcy5kcmFnRW5kWSA9IGUucGFnZVk7XG4gICAgdGhpcy5tZXRhRmxhZyA9IHRydWU7XG5cbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyVXAoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlcklkICE9PSB0aGlzLmRyYWdQb2ludGVySWQpIHJldHVybjtcblxuICAgIGlmIChcbiAgICAgIHRoaXMuZHJhZ1N0YXJ0VGltZSA+PSBEYXRlLm5vdygpIC0gdGhpcy5mbi5UQVBfREVMQVkgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA8IHRoaXMuZm4uVEFQX1RIUkVTSE9MRCAmJlxuICAgICAgYWJzKHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFkpIDwgdGhpcy5mbi5UQVBfVEhSRVNIT0xEXG4gICAgKSB7XG4gICAgICAvLyBJdCdzIGEgdGFwLlxuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0SXRlbShlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXksIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy50ZW1wTGF5b3V0KSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBMYXlvdXQpO1xuICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLnByZXZlbnRDbGljaykge1xuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSkge1xuICAgICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEl0ZW0oZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlS2V5VXAoZTogS2V5Ym9hcmRFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIHN3aXRjaCAoZS5rZXkpIHtcbiAgICAgIGNhc2UgJ0VzY2FwZSc6XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5yZXNldERyYWcoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHJlc2V0RHJhZygpIHtcbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VsZWN0aW9uID0gKGRvY3VtZW50LmRlZmF1bHRWaWV3IHx8IHdpbmRvdykuZ2V0U2VsZWN0aW9uKCk7XG5cbiAgICAgICAgaWYgKHNlbGVjdGlvbiAmJiBzZWxlY3Rpb24udHlwZSAhPT0gJ0NhcmV0Jykge1xuICAgICAgICAgIHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIGlnbm9yZVxuICAgICAgfVxuXG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5kcmFnUG9pbnRlcklkID0gMDtcbiAgICB0aGlzLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgdGhpcy5kcmFnS2V5ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucmVzaXplSGFuZGxlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuZHJhZ1ggPSAwO1xuICAgIHRoaXMuZHJhZ1kgPSAwO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldFRhcmdldEl0ZW0oZTogRXZlbnQpIHtcbiAgICBpZiAoZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgICByZXR1cm4gZS50YXJnZXQuY2xvc2VzdDxIVE1MRWxlbWVudD4oJy5mYXN0LWdyaWQtbGF5b3V0ID4gLml0ZW0nKTtcbiAgICB9XG4gIH1cblxuICBjaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50OiBIVE1MRWxlbWVudCwgZXZlbnQ6IFBvaW50ZXJFdmVudCkge1xuICAgIGNvbnN0IGhhbmRsZSA9IHRoaXMuZm4uY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgICBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgZXZlbnQuY2xpZW50WCxcbiAgICAgIGV2ZW50LmNsaWVudFksXG4gICAgICAxMCwgLy8gVE9ETyBtYWtlIGNvbmZpZ3VyYWJsZT9cbiAgICApO1xuXG4gICAgc3dpdGNoIChoYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgY2FzZSAnbmUnOlxuICAgICAgY2FzZSAnbncnOlxuICAgICAgICAvLyBEaXNhYmxlIG5vcnRoIGhhbmRsZXMgZm9yIG5vdywgYXMgaXQgZmVlbHMgdW5uYXR1cmFsLlxuICAgICAgICAvLyBUT0RPIG1ha2UgY29uZmlndXJhYmxlP1xuICAgICAgICByZXR1cm47XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cbiAgfVxuXG4gIC8vXG5cbiAgZGlzY29ubmVjdCgpIHtcbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCBuZXcgU2V0KCkpO1xuICAgIHRoaXMuZm4ucmVuZGVyTWV0YSh0aGlzLmNvbnRhaW5lciwgZmFsc2UpO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci51bm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VEb3duID0gdGhpcy5oYW5kbGVNb3VzZURvd24uYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZU1vdmUgPSB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlVXAgPSB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgX2hhbmRsZVBvaW50ZXJEb3duID0gdGhpcy5oYW5kbGVQb2ludGVyRG93bi5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZVBvaW50ZXJNb3ZlID0gdGhpcy5oYW5kbGVQb2ludGVyTW92ZS5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZVBvaW50ZXJVcCA9IHRoaXMuaGFuZGxlUG9pbnRlclVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVDbGljayA9IHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVLZXlVcCA9IHRoaXMuaGFuZGxlS2V5VXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVNb3VzZURvd24pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZU1vdXNlTW92ZSwgUEFTU0lWRSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZVBvaW50ZXJEb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVQb2ludGVyTW92ZSwgUEFTU0lWRSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5faGFuZGxlQ2xpY2ssIENBUFRVUkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuX2hhbmRsZUtleVVwKTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZW1vdmVFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZU1vdXNlRG93bik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlTW91c2VNb3ZlKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcblxuICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlUG9pbnRlckRvd24pO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZVBvaW50ZXJNb3ZlKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG5cbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9oYW5kbGVDbGljaywgQ0FQVFVSRSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgLy9cblxuICBzdGF0aWMgREVGQVVMVF9DT0xVTU5TID0gMTI7XG4gIHN0YXRpYyBERUZBVUxUX1JPV19IRUlHSFQgPSAzMDtcbiAgc3RhdGljIERFRkFVTFRfR0FQID0gMDtcblxuICBzdGF0aWMgVEFQX0RFTEFZID0gMjUwO1xuICBzdGF0aWMgVEFQX1RIUkVTSE9MRCA9IDEwO1xuXG4gIHN0YXRpYyByZW5kZXJMYXlvdXQoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICApIHtcbiAgICBjb25zdCB7XG4gICAgICBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMsXG4gICAgICBnYXAgPSB0aGlzLkRFRkFVTFRfR0FQLFxuICAgICAgY29sdW1uR2FwID0gZ2FwLFxuICAgICAgcm93R2FwID0gZ2FwLFxuICAgICAgcm93SGVpZ2h0ID0gdGhpcy5ERUZBVUxUX1JPV19IRUlHSFQsXG4gICAgfSA9IGNvbmZpZztcblxuICAgIGNvbnN0IGNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLm9mZnNldFdpZHRoO1xuICAgIGNvbnN0IGNvbHVtbldpZHRoID0gKGNvbnRhaW5lcldpZHRoIC0gKGNvbHVtbnMgLSAxKSAqIGNvbHVtbkdhcCkgLyBjb2x1bW5zO1xuICAgIGNvbnN0IGNvbHVtbldpZHRoQW5kR2FwID0gY29sdW1uV2lkdGggKyBjb2x1bW5HYXA7XG4gICAgY29uc3Qgcm93SGVpZ2h0QW5kR2FwID0gcm93SGVpZ2h0ICsgcm93R2FwO1xuXG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2Zhc3QtZ3JpZC1sYXlvdXQnKTtcblxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBHcmlkTGF5b3V0SXRlbT4oKTtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcbiAgICAgIG1hcC5zZXQoaXRlbS5pLCBpdGVtKTtcbiAgICB9XG5cbiAgICBsZXQgaE1heCA9IDA7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSBjb250YWluZXIuY2hpbGRyZW5baV07XG5cbiAgICAgIGlmICghKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgICAgLy8gVE9ETyB3YXJuaW5nP1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFlbGVtZW50LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIGVsZW1lbnQuZGF0YXNldC5rZXkgPSBpLnRvU3RyaW5nKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGtleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgICBjb25zdCBpdGVtID0gbWFwLmdldChrZXkpO1xuXG4gICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgLy8gVE9ETyB3YXJuaW5nP1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpdGVtJyk7XG5cbiAgICAgIGNvbnN0IGggPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGlmIChoID4gaE1heCkge1xuICAgICAgICBoTWF4ID0gaDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2lkdGggPSByb3VuZChpdGVtLncgKiBjb2x1bW5XaWR0aEFuZEdhcCAtIGNvbHVtbkdhcCkgKyAncHgnO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gcm91bmQoaXRlbS5oICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG4gICAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlKCcgK1xuICAgICAgICByb3VuZChpdGVtLnggKiBjb2x1bW5XaWR0aEFuZEdhcCkgK1xuICAgICAgICAncHgsICcgK1xuICAgICAgICByb3VuZChpdGVtLnkgKiByb3dIZWlnaHRBbmRHYXApICtcbiAgICAgICAgJ3B4KSc7XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLndpZHRoICE9PSB3aWR0aCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gIT09IHRyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSByb3VuZChoTWF4ICogcm93SGVpZ2h0QW5kR2FwIC0gcm93R2FwKSArICdweCc7XG5cbiAgICBpZiAoY29udGFpbmVyLnN0eWxlLmhlaWdodCAhPT0gY29udGFpbmVySGVpZ2h0KSB7XG4gICAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJTZWxlY3Rpb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5IGFzIHN0cmluZyksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHJlbmRlck1ldGEoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBkcmFnZ2luZzogYm9vbGVhbixcbiAgICByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctbW92aW5nJywgZHJhZ2dpbmcgJiYgIXJlc2l6ZUhhbmRsZSk7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1yZXNpemluZycsIGRyYWdnaW5nICYmICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IHJvb3QgPSBjb250YWluZXIub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19oaWRlLXNlbGVjdGlvbicsIGRyYWdnaW5nKTtcbiAgICByb290LmNsYXNzTGlzdC50b2dnbGUoJ19mb3JjZS1jdXJzb3InLCAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGUpO1xuXG4gICAgaWYgKHJvb3Quc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1mb3JjZS1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZvcmNlLWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNhbGN1bGF0ZURyYWcoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgZHJhZ1N0YXJ0WDogbnVtYmVyLFxuICAgIGRyYWdTdGFydFk6IG51bWJlcixcbiAgICBkcmFnRW5kWDogbnVtYmVyLFxuICAgIGRyYWdFbmRZOiBudW1iZXIsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIHJvd0hlaWdodCA9IHRoaXMuREVGQVVMVF9ST1dfSEVJR0hULFxuICAgICAgZ2FwID0gdGhpcy5ERUZBVUxUX0dBUCxcbiAgICAgIGNvbHVtbkdhcCA9IGdhcCxcbiAgICAgIHJvd0dhcCA9IGdhcCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgZHggPSByb3VuZCgoZHJhZ0VuZFggLSBkcmFnU3RhcnRYKSAvIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkpO1xuICAgIGNvbnN0IGR5ID0gcm91bmQoKGRyYWdFbmRZIC0gZHJhZ1N0YXJ0WSkgLyAocm93SGVpZ2h0ICsgcm93R2FwKSk7XG5cbiAgICByZXR1cm4geyBkeCwgZHkgfTtcbiAgfVxuXG4gIHN0YXRpYyBjaGVja1Jlc2l6ZUhhbmRsZShcbiAgICBjbGllbnRSZWN0OiBET01SZWN0LFxuICAgIGNsaWVudFg6IG51bWJlcixcbiAgICBjbGllbnRZOiBudW1iZXIsXG4gICAgdGhyZXNob2xkOiBudW1iZXIsXG4gICk6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgbiA9IGNsaWVudFkgLSBjbGllbnRSZWN0LnRvcCA8IHRocmVzaG9sZDtcbiAgICBjb25zdCBlID0gY2xpZW50UmVjdC5yaWdodCAtIGNsaWVudFggPCB0aHJlc2hvbGQ7XG4gICAgY29uc3QgcyA9IGNsaWVudFJlY3QuYm90dG9tIC0gY2xpZW50WSA8IHRocmVzaG9sZDtcbiAgICBjb25zdCB3ID0gY2xpZW50WCAtIGNsaWVudFJlY3QubGVmdCA8IHRocmVzaG9sZDtcblxuICAgIGlmIChzKSB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gJ3NlJztcbiAgICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgICByZXR1cm4gJ3N3JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAncyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlKSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ25lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3KSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByZXR1cm4gJ253JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAndyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuKSB7XG4gICAgICByZXR1cm4gJ24nO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBnZXRSZXNpemVDdXJzb3IocmVzaXplSGFuZGxlOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQpIHtcbiAgICBzd2l0Y2ggKHJlc2l6ZUhhbmRsZSkge1xuICAgICAgY2FzZSAnbic6XG4gICAgICBjYXNlICdzJzpcbiAgICAgICAgcmV0dXJuICducy1yZXNpemUnO1xuICAgICAgY2FzZSAnZSc6XG4gICAgICBjYXNlICd3JzpcbiAgICAgICAgcmV0dXJuICdldy1yZXNpemUnO1xuICAgICAgY2FzZSAnbmUnOlxuICAgICAgY2FzZSAnc3cnOlxuICAgICAgICByZXR1cm4gJ25lc3ctcmVzaXplJztcbiAgICAgIGNhc2UgJ3NlJzpcbiAgICAgIGNhc2UgJ253JzpcbiAgICAgICAgcmV0dXJuICdud3NlLXJlc2l6ZSc7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1vdmVzIHRoZSBzcGVjaWZpZWQgaXRlbXMgKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyBtb3ZlSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgKSB7XG4gICAgaWYgKChkeCA9PT0gMCAmJiBkeSA9PT0gMCkgfHwgc2VsZWN0aW9uLnNpemUgPT09IDApIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgbGV0IG91dCA9IGxheW91dDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gbGF5b3V0Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgaXRlbSA9IGxheW91dFtpXTtcblxuICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoaXRlbS5pKSkge1xuICAgICAgICBjb25zdCB4ID0gaXRlbS54ICsgZHg7XG4gICAgICAgIGNvbnN0IHkgPSBpdGVtLnkgKyBkeTtcblxuICAgICAgICBpZiAoaXRlbS54ICE9PSB4IHx8IGl0ZW0ueSAhPT0geSkge1xuICAgICAgICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgICAgICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICAgICAgICAgIG91dCA9IGxheW91dC5zbGljZSgwKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvdXRbaV0gPSB7IC4uLml0ZW0sIHgsIHkgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvdXQgPT09IGxheW91dCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2l6ZXMgdGhlIHNwZWNpZmllZCBpdGVtIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgcmVzaXplSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbHVtbnM6IG51bWJlcixcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgICBoYW5kbGU6IFJlc2l6ZUhhbmRsZSxcbiAgKSB7XG4gICAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeyBtYXhXID0gY29sdW1ucywgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgICAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuICAgICAgICBjb25zdCB4dyA9IHggKyB3O1xuICAgICAgICBjb25zdCB5aCA9IHkgKyBoO1xuICAgICAgICBjb25zdCBjeCA9IGNvbHVtbnMgLSB4O1xuXG4gICAgICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdlJzpcbiAgICAgICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncyc6XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3cnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICB4ID0gY2xhbXAoeCArIGR4LCAwLCB4dyAtIDEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbmUnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgKyBkeCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZSc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoICsgZHksIDEsIG1heEgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc3cnOlxuICAgICAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdudyc6XG4gICAgICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgICAgIGggPSBjbGFtcChoIC0gZHksIDEsIG1heEgpO1xuICAgICAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnggIT09IHggfHwgaXRlbS55ICE9PSB5IHx8IGl0ZW0udyAhPT0gdyB8fCBpdGVtLmggIT09IGgpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb2x1bW5zLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeGVzIG92ZXJsYXBzLCBnYXBzLCBhbmQgbGF5b3V0IG91dCBvZiBib3VuZHMuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlyTGF5b3V0KFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb2x1bW5zOiBudW1iZXIsXG4gICAgc2VsZWN0aW9uPzogU2V0PHN0cmluZz4sXG4gICkge1xuICAgIC8vIFNvcnQgYnkgcm93IGZpcnN0LCBzZWxlY3Rpb24gc2Vjb25kIChpZiBhbnkpLCBjb2x1bW4gdGhpcmQuXG4gICAgY29uc3Qgc29ydGVkSXRlbXMgPSBsYXlvdXQuc2xpY2UoMCkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgaWYgKGEueSA8IGIueSkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEueSA+IGIueSkgcmV0dXJuIDE7XG5cbiAgICAgIGlmIChzZWxlY3Rpb24pIHtcbiAgICAgICAgaWYgKHNlbGVjdGlvbi5oYXMoYS5pKSkge1xuICAgICAgICAgIGlmICghc2VsZWN0aW9uLmhhcyhiLmkpKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGlvbi5oYXMoYi5pKSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChhLnggPCBiLngpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLnggPiBiLngpIHJldHVybiAxO1xuXG4gICAgICByZXR1cm4gMDtcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0YXRpY0l0ZW1zID0gc29ydGVkSXRlbXMuZmlsdGVyKChpdGVtKSA9PiBpdGVtLnN0YXRpYyk7XG4gICAgY29uc3QgbnVtU3RhdGljcyA9IHN0YXRpY0l0ZW1zLmxlbmd0aDtcbiAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcbiAgICBsZXQgc3RhdGljT2Zmc2V0ID0gMDtcblxuICAgIC8vIFwiUmlzaW5nIHRpZGVcIiwgaS5lLiBudW1iZXIgb2YgYmxvY2tlZCBjZWxscyBwZXIgY29sdW1uLlxuICAgIGNvbnN0IHRpZGU6IG51bWJlcltdID0gQXJyYXkoY29sdW1ucyk7XG5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGNvbHVtbnM7ICsreCkge1xuICAgICAgdGlkZVt4XSA9IDA7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBzb3J0ZWRJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBhbGxvdyBpdGVtcyB0byBiZSBvdXQgb2YgYm91bmRzIGR1cmluZyBzb3J0aW5nLFxuICAgICAgLy8gd2hpY2ggKGZvciBleGFtcGxlKSBhbGxvd3MgbW92aW5nIGl0ZW1zIFwiYmVmb3JlXCIgdGhlIGZpcnN0IGl0ZW0uXG4gICAgICAvLyBXZSBmaXggYW55IG91dCBvZiBib3VuZCBpc3N1ZXMgaGVyZS5cbiAgICAgIGxldCBpdGVtID0gdGhpcy5yZXBhaXJJdGVtKHNvcnRlZEl0ZW1zW2ldLCBjb2x1bW5zKTtcbiAgICAgIGNvbnN0IHgyID0gaXRlbS54ICsgaXRlbS53O1xuXG4gICAgICBpZiAoaXRlbS5zdGF0aWMpIHtcbiAgICAgICAgLy8gVGhpcyBzdGF0aWMgaXRlbSB3aWxsIGJlIHBhcnQgb2YgdGhlIHRpZGVcbiAgICAgICAgLy8gYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgY29uc2lkZXJlZCBmb3IgY29sbGlzaW9uIGFueW1vcmUuXG4gICAgICAgIC8vIFNpbmNlIHN0YXRpYyBpdGVtIHdpbGwgYmUgdmlzaXRlZCBpbiB0aGUgc2FtZSBvcmRlclxuICAgICAgICAvLyBhcyB0aGUgc3RhdGljSXRlbXMgYXJyYXksIHdlIGNhbiBqdXN0IGluY3JlbWVudCB0aGUgb2Zmc2V0IGhlcmUuXG4gICAgICAgICsrc3RhdGljT2Zmc2V0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGV0ZWN0IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAgd2l0aCB0aWRlLlxuICAgICAgICBsZXQgbWluR2FwID0gSW5maW5pdHk7XG5cbiAgICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgICBjb25zdCBnYXAgPSBpdGVtLnkgLSB0aWRlW3hdO1xuXG4gICAgICAgICAgaWYgKGdhcCA8IG1pbkdhcCkge1xuICAgICAgICAgICAgbWluR2FwID0gZ2FwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpeCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwLlxuICAgICAgICBsZXQgeU5leHQgPSBpdGVtLnkgLSBtaW5HYXA7XG5cbiAgICAgICAgLy8gSGFuZGxlIGNvbGxpc2lvbiB3aXRoIHN0YXRpYyBpdGVtcy5cbiAgICAgICAgZm9yIChsZXQgaiA9IHN0YXRpY09mZnNldDsgaiA8IG51bVN0YXRpY3M7ICsraikge1xuICAgICAgICAgIGNvbnN0IHN0YXRpY0l0ZW0gPSBzdGF0aWNJdGVtc1tqXTtcblxuICAgICAgICAgIGlmIChzdGF0aWNJdGVtLnkgPj0geU5leHQgKyBpdGVtLmgpIHtcbiAgICAgICAgICAgIC8vIEZvbGxvd2luZyBzdGF0aWMgaXRlbXMgY2Fubm90IGNvbGxpZGUgYmVjYXVzZSBvZiBzb3J0aW5nOyBzdG9wLlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgLy9zdGF0aWNJdGVtLnkgPCB5TmV4dCArIGl0ZW0uaCAmJiAvLyBUaGlzIGlzIGltcGxpZWQgYWJvdmUuXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnkgKyBzdGF0aWNJdGVtLmggPiB5TmV4dCAmJlxuICAgICAgICAgICAgc3RhdGljSXRlbS54IDwgaXRlbS54ICsgaXRlbS53ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggKyBzdGF0aWNJdGVtLncgPiBpdGVtLnhcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIENvbGxpc2lvbiBkZXRlY3RlZDsgbW92ZSBjdXJyZW50IGl0ZW0gYmVsb3cgc3RhdGljIGl0ZW0uXG4gICAgICAgICAgICB5TmV4dCA9IHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaDtcblxuICAgICAgICAgICAgLy8gQ3VycmVudCBpdGVtIHdhcyBtb3ZlZDtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gcmVjaGVjayBjb2xsaXNpb24gd2l0aCBvdGhlciBzdGF0aWMgaXRlbXMuXG4gICAgICAgICAgICBqID0gc3RhdGljT2Zmc2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnkgIT09IHlOZXh0KSB7XG4gICAgICAgICAgaXRlbSA9IHsgLi4uaXRlbSwgeTogeU5leHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtICE9PSBzb3J0ZWRJdGVtc1tpXSkge1xuICAgICAgICAgIHNvcnRlZEl0ZW1zW2ldID0gaXRlbTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRpZGUuXG4gICAgICBjb25zdCB0ID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICBpZiAodGlkZVt4XSA8IHQpIHtcbiAgICAgICAgICB0aWRlW3hdID0gdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZCA/IHNvcnRlZEl0ZW1zIDogbGF5b3V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGFpciBib3VuZHMgb2YgdGhlIGdpdmVuIGl0ZW0gdG8gZml0IHRoZSBnaXZlbiBjb25maWcuXG4gICAqIFJldHVybnMgYSBuZXcgaXRlbSBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckl0ZW0oaXRlbTogR3JpZExheW91dEl0ZW0sIGNvbHVtbnM6IG51bWJlcikge1xuICAgIGNvbnN0IHsgbWluVyA9IDEsIG1heFcgPSBjb2x1bW5zLCBtaW5IID0gMSwgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgIGxldCB7IHgsIHksIHcsIGggfSA9IGl0ZW07XG5cbiAgICB3ID0gY2xhbXAodywgbWluVywgbWluKG1heFcsIGNvbHVtbnMpKTtcbiAgICBoID0gY2xhbXAoaCwgbWluSCwgbWF4SCk7XG4gICAgeCA9IGNsYW1wKHgsIDAsIGNvbHVtbnMgLSB3KTtcbiAgICBpZiAoeSA8IDApIHkgPSAwO1xuXG4gICAgaWYgKGl0ZW0ueCA9PT0geCAmJiBpdGVtLnkgPT09IHkgJiYgaXRlbS53ID09PSB3ICYmIGl0ZW0uaCA9PT0gaCkge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsYW1wKHZhbHVlOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xuICBpZiAodmFsdWUgPCBtaW4pIHJldHVybiBtaW47XG4gIGlmICh2YWx1ZSA+IG1heCkgcmV0dXJuIG1heDtcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5jb25zdCBhYnMgPSBNYXRoLmFicztcbmNvbnN0IG1pbiA9IE1hdGgubWluO1xuY29uc3Qgcm91bmQgPSBNYXRoLnJvdW5kO1xuXG5jb25zdCBDQVBUVVJFID0geyBjYXB0dXJlOiB0cnVlIH07XG5jb25zdCBQQVNTSVZFID0geyBwYXNzaXZlOiB0cnVlIH07XG4iXX0=