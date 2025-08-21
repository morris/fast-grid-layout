export class GridLayout {
    constructor(container, config) {
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
        this.resizeObserver = new ResizeObserver(() => {
            this.layoutFlag = true;
            this.requestRender();
        });
        this.resizeObserver.observe(this.container);
        this.addEventListeners();
    }
    setConfig(config) {
        if (this.config === config)
            return;
        this.config = config;
        this.layout = this.fn.repairLayout(this.layout, this.config);
        this.layoutFlag = true;
        this.selectionFlag = true;
        this.metaFlag = true;
        this.requestRender();
    }
    setLayout(layout) {
        var _a, _b;
        if (this.layout === layout)
            return;
        this.layout = this.fn.repairLayout(layout, this.config);
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
                    this.tempLayout = this.fn.dragItems(this.layout, this.config, this.selection, dx, dy, this.resizeHandle);
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
            this.resizeHandle = this.fn.checkResizeHandle(element, this.config, e.clientX, e.clientY);
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
            this.resizeHandle = this.fn.checkResizeHandle(element, this.config, e.clientX, e.clientY);
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
        if (this.dragStartTime >= Date.now() - 250 &&
            abs(this.dragEndX - this.dragStartX) < 10 &&
            abs(this.dragEndY - this.dragStartY) < 10) {
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
    getTargetElement(e) {
        if (e.target instanceof Element) {
            return e.target.closest('.fast-grid-layout > .item');
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
        const map = new Map();
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
        root.classList.toggle('_cursor', !!resizeHandle);
        const cursor = this.getResizeCursor(resizeHandle);
        if (root.style.getPropertyValue('--fast-grid-layout-cursor') !== cursor) {
            root.style.setProperty('--fast-grid-layout-cursor', cursor);
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
    static checkResizeHandle(element, config, clientX, clientY) {
        const { resizeHandles = this.DEFAULT_RESIZE_HANDLES, resizeThreshold = this.DEFAULT_RESIZE_THRESHOLD, } = config;
        const rect = element.getBoundingClientRect();
        const n = clientY - rect.top < resizeThreshold;
        const e = rect.right - clientX < resizeThreshold;
        const s = rect.bottom - clientY < resizeThreshold;
        const w = clientX - rect.left < resizeThreshold;
        let r;
        if (s) {
            if (e) {
                r = 'se';
            }
            else if (w) {
                r = 'sw';
            }
            else {
                r = 's';
            }
        }
        else if (e) {
            if (n) {
                r = 'ne';
            }
            else {
                r = 'e';
            }
        }
        else if (w) {
            if (n) {
                r = 'nw';
            }
            else {
                r = 'w';
            }
        }
        else if (n) {
            r = 'n';
        }
        if (r && resizeHandles.has(r)) {
            return r;
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
     * Move or resize specified item(s) (in grid units).
     * Returns a new layout if modified.
     */
    static dragItems(layout, config, selection, dx, dy, resizeHandle) {
        if (resizeHandle) {
            for (const key of selection) {
                return this.resizeItem(layout, config, key, resizeHandle, dx, dy);
            }
            return layout;
        }
        return this.moveItems(layout, config, selection, dx, dy);
    }
    /**
     * Moves the specified items (in grid units).
     * Returns a new layout if modified.
     */
    static moveItems(layout, config, selection, dx, dy) {
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
        return this.repairLayout(out, config, selection);
    }
    /**
     * Resizes the specified item (in grid units).
     * Returns a new layout if modified.
     */
    static resizeItem(layout, config, key, handle, dx, dy) {
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
        out[index] = Object.assign(Object.assign({}, item), { x, y, w, h });
        return this.repairLayout(out, config, new Set([key]));
    }
    /**
     * Fixes overlaps, gaps, and layout out of bounds.
     * Returns a new layout if there was anything to repair.
     */
    static repairLayout(layout, config, selection) {
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
        const { columns = this.DEFAULT_COLUMNS } = config;
        // "Rising tide", i.e. number of blocked cells per column.
        const tide = Array(columns);
        for (let x = 0; x < columns; ++x) {
            tide[x] = 0;
        }
        for (let i = 0, l = sortedItems.length; i < l; i++) {
            // Note that we allow items to be out of bounds during sorting,
            // which (for example) allows moving items "before" the first item.
            // We fix any out of bound issues here.
            let item = this.repairItem(sortedItems[i], config);
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
    static repairItem(item, config) {
        const { columns = this.DEFAULT_COLUMNS } = config;
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
GridLayout.DEFAULT_RESIZE_HANDLES = new Set(['e', 'se', 's', 'sw', 'w']);
GridLayout.DEFAULT_RESIZE_THRESHOLD = 10;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlGQSxNQUFNLE9BQU8sVUFBVTtJQThCckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBM0JsRCxXQUFNLEdBQXFCLEVBQUUsQ0FBQztRQUc5QixjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUc5QixrQkFBYSxHQUFHLENBQUMsQ0FBQztRQUNsQixrQkFBYSxHQUFHLENBQUMsQ0FBQztRQUNsQixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGFBQVEsR0FBRyxDQUFDLENBQUM7UUFDYixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBRWIsYUFBUSxHQUFHLEtBQUssQ0FBQztRQUNqQixVQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsVUFBSyxHQUFHLENBQUMsQ0FBQztRQUNWLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBSXJCLG9CQUFlLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLGVBQVUsR0FBRyxJQUFJLENBQUM7UUFDbEIsa0JBQWEsR0FBRyxJQUFJLENBQUM7UUFDckIsYUFBUSxHQUFHLElBQUksQ0FBQztRQUVoQixPQUFFLEdBQUcsSUFBSSxDQUFDLFdBQWdDLENBQUM7UUF1VTNDLHFCQUFnQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25ELHFCQUFnQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25ELG1CQUFjLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFL0MsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RCx1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LEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNO1lBQ1IsS0FBSyxJQUFJO2dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMzQixNQUFNO1lBQ1IsS0FBSyxJQUFJO2dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMzQixDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDN0IsTUFBTTtZQUNSLEtBQUssSUFBSTtnQkFDUCxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxD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Q0FBQzs7QUFwZkQsRUFBRTtBQUVLLDBCQUFlLEdBQUcsRUFBRSxBQUFMLENBQU07QUFDckIsNkJBQWtCLEdBQUcsRUFBRSxBQUFMLENBQU07QUFDeEIsc0JBQVcsR0FBRyxDQUFDLEFBQUosQ0FBSztBQUNoQixpQ0FBc0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxBQUF2QyxDQUF3QztBQUM5RCxtQ0FBd0IsR0FBRyxFQUFFLEFBQUwsQ0FBTTtBQWlmdkMsU0FBUyxLQUFLLENBQUMsS0FBYSxFQUFFLEdBQVcsRUFBRSxHQUFXO0lBQ3BELElBQUksS0FBSyxHQUFHLEdBQUc7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUM1QixJQUFJLEtBQUssR0FBRyxHQUFHO1FBQUUsT0FBTyxHQUFHLENBQUM7SUFDNUIsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDbEMsTUFBTSxPQUFPLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRDb25maWcge1xuICAvKipcbiAgICogTnVtYmVyIG9mIGNvbHVtbnMgaW4gdGhlIGdyaWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IDEyXG4gICAqL1xuICBjb2x1bW5zPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIZWlnaHQgb2YgZWFjaCByb3cgaW4gcGl4ZWxzLlxuICAgKlxuICAgKiBAZGVmYXVsdCAzMFxuICAgKi9cbiAgcm93SGVpZ2h0PzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBEZWZhdWx0IGdhcCBiZXR3ZWVuIGdyaWQgY2VsbHMgKGFwcGxpZXMgdG8gYm90aCByb3dzIGFuZCBjb2x1bW5zIGlmIG5vIG92ZXJyaWRlcyBhcmUgZ2l2ZW4pLlxuICAgKlxuICAgKiBAZGVmYXVsdCAwXG4gICAqL1xuICBnYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIEhvcml6b250YWwgZ2FwIGJldHdlZW4gZ3JpZCBjb2x1bW5zIGluIHBpeGVscy5cbiAgICogT3ZlcnJpZGVzIGBnYXBgIGlmIHNwZWNpZmllZC5cbiAgICpcbiAgICogQGRlZmF1bHQgZ2FwXG4gICAqL1xuICBjb2x1bW5HYXA/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFZlcnRpY2FsIGdhcCBiZXR3ZWVuIGdyaWQgcm93cyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgcm93R2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBTZXQgb2YgYWxsb3dlZCByZXNpemUgaGFuZGxlcy5cbiAgICogUG9zc2libGUgdmFsdWVzOiBgJ24nIHwgJ2UnIHwgJ3MnIHwgJ3cnIHwgJ25lJyB8ICdzZScgfCAnc3cnIHwgJ253J2AuXG4gICAqXG4gICAqIEBkZWZhdWx0IG5ldyBTZXQoWydlJywgJ3NlJywgJ3MnLCAnc3cnLCAndyddKVxuICAgKi9cbiAgcmVzaXplSGFuZGxlcz86IFNldDxSZXNpemVIYW5kbGU+O1xuXG4gIC8qKlxuICAgKiBQaXhlbCB0aHJlc2hvbGQgZm9yIGRldGVjdGluZyBhIHJlc2l6ZSBhY3Rpb25cbiAgICogd2hlbiBwb2ludGVyIGlzIG5lYXIgYW4gaXRlbSdzIGVkZ2UuXG4gICAqXG4gICAqIEBkZWZhdWx0IDEwXG4gICAqL1xuICByZXNpemVUaHJlc2hvbGQ/OiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHRyaWdnZXJlZCB3aGVuIHRoZSBsYXlvdXQgY2hhbmdlc1xuICAgKiAoZS5nLiBhZnRlciBkcmFnL3Jlc2l6ZSBvciBleHRlcm5hbCB1cGRhdGUpLlxuICAgKi9cbiAgb25MYXlvdXRDaGFuZ2U/OiAobGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdKSA9PiB2b2lkO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0cmlnZ2VyZWQgd2hlbiB0aGUgc2VsZWN0aW9uIGNoYW5nZXNcbiAgICogKGUuZy4gdXNlciBjbGlja3Mgb3IgdG9nZ2xlcyBpdGVtIHNlbGVjdGlvbikuXG4gICAqL1xuICBvblNlbGVjdGlvbkNoYW5nZT86IChzZWxlY3Rpb246IFNldDxzdHJpbmc+KSA9PiB2b2lkO1xuXG4gIC8qKlxuICAgKiBJcyB0aGUgbGF5b3V0IGVkaXRhYmxlP1xuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBlZGl0YWJsZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3JpZExheW91dEl0ZW0ge1xuICBpOiBzdHJpbmc7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB3OiBudW1iZXI7XG4gIGg6IG51bWJlcjtcbiAgbWluVz86IG51bWJlcjtcbiAgbWluSD86IG51bWJlcjtcbiAgbWF4Vz86IG51bWJlcjtcbiAgbWF4SD86IG51bWJlcjtcbiAgc3RhdGljPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgUmVzaXplSGFuZGxlID0gJ24nIHwgJ2UnIHwgJ3MnIHwgJ3cnIHwgJ25lJyB8ICdzZScgfCAnc3cnIHwgJ253JztcblxuZXhwb3J0IGNsYXNzIEdyaWRMYXlvdXQge1xuICBwcm90ZWN0ZWQgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcbiAgcHJvdGVjdGVkIGNvbmZpZzogR3JpZExheW91dENvbmZpZztcbiAgcHJvdGVjdGVkIGxheW91dDogR3JpZExheW91dEl0ZW1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgdGVtcExheW91dD86IEdyaWRMYXlvdXRJdGVtW107XG5cbiAgcHJvdGVjdGVkIHNlbGVjdGlvbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBwcm90ZWN0ZWQgcmVzaXplSGFuZGxlPzogUmVzaXplSGFuZGxlO1xuXG4gIHByb3RlY3RlZCBkcmFnUG9pbnRlcklkID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFRpbWUgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0WCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRZID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdFbmRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdFbmRZID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdLZXk/OiBzdHJpbmc7XG4gIHByb3RlY3RlZCBkcmFnZ2luZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgZHJhZ1ggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1kgPSAwO1xuICBwcm90ZWN0ZWQgcHJldmVudENsaWNrID0gZmFsc2U7XG5cbiAgcHJvdGVjdGVkIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlcjtcblxuICBwcm90ZWN0ZWQgcmVuZGVyUmVxdWVzdGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBsYXlvdXRGbGFnID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIHNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICBwcm90ZWN0ZWQgbWV0YUZsYWcgPSB0cnVlO1xuXG4gIHByb3RlY3RlZCBmbiA9IHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEdyaWRMYXlvdXQ7XG5cbiAgY29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnKSB7XG4gICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG5cbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyID0gbmV3IFJlc2l6ZU9ic2VydmVyKCgpID0+IHtcbiAgICAgIHRoaXMubGF5b3V0RmxhZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgc2V0Q29uZmlnKGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIGlmICh0aGlzLmNvbmZpZyA9PT0gY29uZmlnKSByZXR1cm47XG5cbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KHRoaXMubGF5b3V0LCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgc2V0TGF5b3V0KGxheW91dDogR3JpZExheW91dEl0ZW1bXSkge1xuICAgIGlmICh0aGlzLmxheW91dCA9PT0gbGF5b3V0KSByZXR1cm47XG5cbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgdGhpcy5jb25maWcpO1xuICAgIHRoaXMuY29uZmlnLm9uTGF5b3V0Q2hhbmdlPy4odGhpcy5sYXlvdXQpO1xuXG4gICAgdGhpcy5sYXlvdXRGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHNldFNlbGVjdGlvbihzZWxlY3Rpb246IEl0ZXJhYmxlPHN0cmluZz4pIHtcbiAgICBpZiAoc2VsZWN0aW9uID09PSB0aGlzLnNlbGVjdGlvbikgcmV0dXJuO1xuXG4gICAgdGhpcy5zZWxlY3Rpb24gPSBuZXcgU2V0KHNlbGVjdGlvbik7XG4gICAgdGhpcy5jb25maWcub25TZWxlY3Rpb25DaGFuZ2U/Lih0aGlzLnNlbGVjdGlvbik7XG5cbiAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgdG9nZ2xlU2VsZWN0aW9uKGtleTogc3RyaW5nLCBleGNsdXNpdmUgPSBmYWxzZSkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5oYXMoa2V5KSkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uZGVsZXRlKGtleSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChleGNsdXNpdmUpIHtcbiAgICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5zZWxlY3Rpb24uYWRkKGtleSk7XG4gICAgfVxuXG4gICAgdGhpcy5zZWxlY3Rpb25GbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uRmxhZyA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHJlcXVlc3RSZW5kZXIoKSB7XG4gICAgaWYgKCF0aGlzLnJlbmRlclJlcXVlc3RlZCkge1xuICAgICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHRoaXMucmVuZGVyKCkpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlcigpIHtcbiAgICB0aGlzLnJlbmRlclJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMubGF5b3V0RmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJMYXlvdXQoXG4gICAgICAgIHRoaXMuY29udGFpbmVyLFxuICAgICAgICB0aGlzLnRlbXBMYXlvdXQgPz8gdGhpcy5sYXlvdXQsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0RmxhZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNlbGVjdGlvbkZsYWcpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCB0aGlzLnNlbGVjdGlvbik7XG4gICAgICB0aGlzLnNlbGVjdGlvbkZsYWcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tZXRhRmxhZykge1xuICAgICAgdGhpcy5mbi5yZW5kZXJNZXRhKHRoaXMuY29udGFpbmVyLCB0aGlzLmRyYWdnaW5nLCB0aGlzLnJlc2l6ZUhhbmRsZSk7XG5cbiAgICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgZHgsIGR5IH0gPSB0aGlzLmZuLmNhbGN1bGF0ZURyYWcoXG4gICAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgICAgdGhpcy5jb25maWcsXG4gICAgICAgICAgdGhpcy5kcmFnU3RhcnRYLFxuICAgICAgICAgIHRoaXMuZHJhZ1N0YXJ0WSxcbiAgICAgICAgICB0aGlzLmRyYWdFbmRYLFxuICAgICAgICAgIHRoaXMuZHJhZ0VuZFksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKGR4ICE9PSB0aGlzLmRyYWdYIHx8IGR5ICE9PSB0aGlzLmRyYWdZKSB7XG4gICAgICAgICAgdGhpcy5kcmFnWCA9IGR4O1xuICAgICAgICAgIHRoaXMuZHJhZ1kgPSBkeTtcblxuICAgICAgICAgIHRoaXMudGVtcExheW91dCA9IHRoaXMuZm4uZHJhZ0l0ZW1zKFxuICAgICAgICAgICAgdGhpcy5sYXlvdXQsXG4gICAgICAgICAgICB0aGlzLmNvbmZpZyxcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0aW9uLFxuICAgICAgICAgICAgZHgsXG4gICAgICAgICAgICBkeSxcbiAgICAgICAgICAgIHRoaXMucmVzaXplSGFuZGxlLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICB0aGlzLmxheW91dEZsYWcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWV0YUZsYWcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZURvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnIHx8IGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50KSB7XG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuZm4uY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgICAgIGVsZW1lbnQsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgICBlLmNsaWVudFgsXG4gICAgICAgIGUuY2xpZW50WSxcbiAgICAgICk7XG5cbiAgICAgIHRoaXMuZHJhZ0tleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlTW92ZShlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMubWV0YUZsYWcgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuXG4gICAgaWYgKCF0aGlzLmRyYWdLZXkpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gZWxlbWVudFxuICAgICAgICA/IHRoaXMuZm4uY2hlY2tSZXNpemVIYW5kbGUoZWxlbWVudCwgdGhpcy5jb25maWcsIGUuY2xpZW50WCwgZS5jbGllbnRZKVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5kcmFnS2V5ICYmICF0aGlzLmRyYWdnaW5nKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgICAgaWYgKCF0aGlzLnNlbGVjdGlvbi5oYXModGhpcy5kcmFnS2V5KSB8fCB0aGlzLnJlc2l6ZUhhbmRsZSkge1xuICAgICAgICB0aGlzLnNldFNlbGVjdGlvbihbdGhpcy5kcmFnS2V5XSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZU1vdXNlVXAoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnIHx8IGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy50ZW1wTGF5b3V0KSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBMYXlvdXQpO1xuICAgICAgdGhpcy50ZW1wTGF5b3V0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlckRvd24oZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSByZXR1cm47XG4gICAgaWYgKHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnUG9pbnRlcklkID0gZS5wb2ludGVySWQ7XG4gICAgdGhpcy5kcmFnU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLmRyYWdTdGFydFggPSB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdTdGFydFkgPSB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcblxuICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICBpZiAoZWxlbWVudD8uZGF0YXNldC5rZXkgJiYgdGhpcy5zZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkpKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVzaXplSGFuZGxlID0gdGhpcy5mbi5jaGVja1Jlc2l6ZUhhbmRsZShcbiAgICAgICAgZWxlbWVudCxcbiAgICAgICAgdGhpcy5jb25maWcsXG4gICAgICAgIGUuY2xpZW50WCxcbiAgICAgICAgZS5jbGllbnRZLFxuICAgICAgKTtcblxuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJNb3ZlKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJykgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJJZCAhPT0gdGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcblxuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5kcmFnU3RhcnRUaW1lID49IERhdGUubm93KCkgLSAyNTAgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA8IDEwICYmXG4gICAgICBhYnModGhpcy5kcmFnRW5kWSAtIHRoaXMuZHJhZ1N0YXJ0WSkgPCAxMFxuICAgICkge1xuICAgICAgLy8gSXQncyBhIHRhcC5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5LCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2xlYXJTZWxlY3Rpb24oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMudGVtcExheW91dCkge1xuICAgICAgdGhpcy5zZXRMYXlvdXQodGhpcy50ZW1wTGF5b3V0KTtcbiAgICAgIHRoaXMudGVtcExheW91dCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZUNsaWNrKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBpZiAodGhpcy5wcmV2ZW50Q2xpY2spIHtcbiAgICAgIHRoaXMucHJldmVudENsaWNrID0gZmFsc2U7XG5cbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghZS5jdHJsS2V5ICYmICFlLm1ldGFLZXkpIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50KGUpO1xuXG4gICAgICBpZiAoZWxlbWVudD8uZGF0YXNldC5rZXkpIHtcbiAgICAgICAgdGhpcy50b2dnbGVTZWxlY3Rpb24oZWxlbWVudC5kYXRhc2V0LmtleSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZUtleVVwKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKGUua2V5KSB7XG4gICAgICBjYXNlICdFc2NhcGUnOlxuICAgICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG4gICAgICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCByZXNldERyYWcoKSB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGlvbiA9IChkb2N1bWVudC5kZWZhdWx0VmlldyB8fCB3aW5kb3cpLmdldFNlbGVjdGlvbigpO1xuXG4gICAgICAgIGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLnR5cGUgIT09ICdDYXJldCcpIHtcbiAgICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBpZ25vcmVcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuZHJhZ1BvaW50ZXJJZCA9IDA7XG4gICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhZ0tleSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmRyYWdYID0gMDtcbiAgICB0aGlzLmRyYWdZID0gMDtcbiAgICB0aGlzLm1ldGFGbGFnID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBnZXRUYXJnZXRFbGVtZW50KGU6IEV2ZW50KSB7XG4gICAgaWYgKGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgcmV0dXJuIGUudGFyZ2V0LmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCcuZmFzdC1ncmlkLWxheW91dCA+IC5pdGVtJyk7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBkaXNjb25uZWN0KCkge1xuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgdGhpcy5mbi5yZW5kZXJTZWxlY3Rpb24odGhpcy5jb250YWluZXIsIG5ldyBTZXQoKSk7XG4gICAgdGhpcy5mbi5yZW5kZXJNZXRhKHRoaXMuY29udGFpbmVyLCBmYWxzZSk7XG5cbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLnVub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG5cbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlRG93biA9IHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VNb3ZlID0gdGhpcy5oYW5kbGVNb3VzZU1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZVVwID0gdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyRG93biA9IHRoaXMuaGFuZGxlUG9pbnRlckRvd24uYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyTW92ZSA9IHRoaXMuaGFuZGxlUG9pbnRlck1vdmUuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVQb2ludGVyVXAgPSB0aGlzLmhhbmRsZVBvaW50ZXJVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlQ2xpY2sgPSB0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlS2V5VXAgPSB0aGlzLmhhbmRsZUtleVVwLmJpbmQodGhpcyk7XG5cbiAgcHJvdGVjdGVkIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUsIFBBU1NJVkUpO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCBDQVBUVVJFKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVNb3VzZURvd24pO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIHRoaXMuX2hhbmRsZU1vdXNlTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlTW91c2VVcCk7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZVBvaW50ZXJEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVQb2ludGVyTW92ZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJ1cCcsIHRoaXMuX2hhbmRsZVBvaW50ZXJVcCk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJjYW5jZWwnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5faGFuZGxlQ2xpY2ssIENBUFRVUkUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuX2hhbmRsZUtleVVwKTtcbiAgfVxuXG4gIC8vXG5cbiAgc3RhdGljIERFRkFVTFRfQ09MVU1OUyA9IDEyO1xuICBzdGF0aWMgREVGQVVMVF9ST1dfSEVJR0hUID0gMzA7XG4gIHN0YXRpYyBERUZBVUxUX0dBUCA9IDA7XG4gIHN0YXRpYyBERUZBVUxUX1JFU0laRV9IQU5ETEVTID0gbmV3IFNldChbJ2UnLCAnc2UnLCAncycsICdzdycsICd3J10pO1xuICBzdGF0aWMgREVGQVVMVF9SRVNJWkVfVEhSRVNIT0xEID0gMTA7XG5cbiAgc3RhdGljIHJlbmRlckxheW91dChcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIGdhcCA9IHRoaXMuREVGQVVMVF9HQVAsXG4gICAgICBjb2x1bW5HYXAgPSBnYXAsXG4gICAgICByb3dHYXAgPSBnYXAsXG4gICAgICByb3dIZWlnaHQgPSB0aGlzLkRFRkFVTFRfUk9XX0hFSUdIVCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtPigpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuICAgICAgbWFwLnNldChpdGVtLmksIGl0ZW0pO1xuICAgIH1cblxuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdmYXN0LWdyaWQtbGF5b3V0Jyk7XG5cbiAgICBjb25zdCBjb250YWluZXJXaWR0aCA9IGNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICBjb25zdCBjb2x1bW5XaWR0aCA9IChjb250YWluZXJXaWR0aCAtIChjb2x1bW5zIC0gMSkgKiBjb2x1bW5HYXApIC8gY29sdW1ucztcbiAgICBjb25zdCBjb2x1bW5XaWR0aEFuZEdhcCA9IGNvbHVtbldpZHRoICsgY29sdW1uR2FwO1xuICAgIGNvbnN0IHJvd0hlaWdodEFuZEdhcCA9IHJvd0hlaWdodCArIHJvd0dhcDtcblxuICAgIGxldCBoTWF4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnQuZGF0YXNldC5rZXkpIHtcbiAgICAgICAgZWxlbWVudC5kYXRhc2V0LmtleSA9IGkudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5kYXRhc2V0LmtleTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtYXAuZ2V0KGtleSk7XG5cbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2l0ZW0nKTtcblxuICAgICAgY29uc3QgaCA9IGl0ZW0ueSArIGl0ZW0uaDtcblxuICAgICAgaWYgKGggPiBoTWF4KSB7XG4gICAgICAgIGhNYXggPSBoO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB3aWR0aCA9IHJvdW5kKGl0ZW0udyAqIGNvbHVtbldpZHRoQW5kR2FwIC0gY29sdW1uR2FwKSArICdweCc7XG4gICAgICBjb25zdCBoZWlnaHQgPSByb3VuZChpdGVtLmggKiByb3dIZWlnaHRBbmRHYXAgLSByb3dHYXApICsgJ3B4JztcbiAgICAgIGNvbnN0IHRyYW5zZm9ybSA9XG4gICAgICAgICd0cmFuc2xhdGUoJyArXG4gICAgICAgIHJvdW5kKGl0ZW0ueCAqIGNvbHVtbldpZHRoQW5kR2FwKSArXG4gICAgICAgICdweCwgJyArXG4gICAgICAgIHJvdW5kKGl0ZW0ueSAqIHJvd0hlaWdodEFuZEdhcCkgK1xuICAgICAgICAncHgpJztcblxuICAgICAgaWYgKGVsZW1lbnQuc3R5bGUud2lkdGggIT09IHdpZHRoKSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUud2lkdGggPSB3aWR0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKGVsZW1lbnQuc3R5bGUuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgZWxlbWVudC5zdHlsZS5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSAhPT0gdHJhbnNmb3JtKSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUudHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbnRhaW5lckhlaWdodCA9IHJvdW5kKGhNYXggKiByb3dIZWlnaHRBbmRHYXAgLSByb3dHYXApICsgJ3B4JztcblxuICAgIGlmIChjb250YWluZXIuc3R5bGUuaGVpZ2h0ICE9PSBjb250YWluZXJIZWlnaHQpIHtcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBjb250YWluZXJIZWlnaHQ7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHJlbmRlclNlbGVjdGlvbihjb250YWluZXI6IEhUTUxFbGVtZW50LCBzZWxlY3Rpb246IFNldDxzdHJpbmc+KSB7XG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmNoaWxkcmVuW2ldO1xuXG4gICAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShcbiAgICAgICAgICAnLXNlbGVjdGVkJyxcbiAgICAgICAgICBzZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkgYXMgc3RyaW5nKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0aWMgcmVuZGVyTWV0YShcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGRyYWdnaW5nOiBib29sZWFuLFxuICAgIHJlc2l6ZUhhbmRsZT86IFJlc2l6ZUhhbmRsZSxcbiAgKSB7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1tb3ZpbmcnLCBkcmFnZ2luZyAmJiAhcmVzaXplSGFuZGxlKTtcbiAgICBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnLXJlc2l6aW5nJywgZHJhZ2dpbmcgJiYgISFyZXNpemVIYW5kbGUpO1xuXG4gICAgY29uc3Qgcm9vdCA9IGNvbnRhaW5lci5vd25lckRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuICAgIHJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnX2hpZGUtc2VsZWN0aW9uJywgZHJhZ2dpbmcpO1xuICAgIHJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnX2N1cnNvcicsICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuZ2V0UmVzaXplQ3Vyc29yKHJlc2l6ZUhhbmRsZSk7XG5cbiAgICBpZiAocm9vdC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLWZhc3QtZ3JpZC1sYXlvdXQtY3Vyc29yJykgIT09IGN1cnNvcikge1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1mYXN0LWdyaWQtbGF5b3V0LWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNhbGN1bGF0ZURyYWcoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgZHJhZ1N0YXJ0WDogbnVtYmVyLFxuICAgIGRyYWdTdGFydFk6IG51bWJlcixcbiAgICBkcmFnRW5kWDogbnVtYmVyLFxuICAgIGRyYWdFbmRZOiBudW1iZXIsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIHJvd0hlaWdodCA9IHRoaXMuREVGQVVMVF9ST1dfSEVJR0hULFxuICAgICAgZ2FwID0gdGhpcy5ERUZBVUxUX0dBUCxcbiAgICAgIGNvbHVtbkdhcCA9IGdhcCxcbiAgICAgIHJvd0dhcCA9IGdhcCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgZHggPSByb3VuZCgoZHJhZ0VuZFggLSBkcmFnU3RhcnRYKSAvIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkpO1xuICAgIGNvbnN0IGR5ID0gcm91bmQoKGRyYWdFbmRZIC0gZHJhZ1N0YXJ0WSkgLyAocm93SGVpZ2h0ICsgcm93R2FwKSk7XG5cbiAgICByZXR1cm4geyBkeCwgZHkgfTtcbiAgfVxuXG4gIHN0YXRpYyBjaGVja1Jlc2l6ZUhhbmRsZShcbiAgICBlbGVtZW50OiBFbGVtZW50LFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBjbGllbnRYOiBudW1iZXIsXG4gICAgY2xpZW50WTogbnVtYmVyLFxuICApOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHtcbiAgICAgIHJlc2l6ZUhhbmRsZXMgPSB0aGlzLkRFRkFVTFRfUkVTSVpFX0hBTkRMRVMsXG4gICAgICByZXNpemVUaHJlc2hvbGQgPSB0aGlzLkRFRkFVTFRfUkVTSVpFX1RIUkVTSE9MRCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgbiA9IGNsaWVudFkgLSByZWN0LnRvcCA8IHJlc2l6ZVRocmVzaG9sZDtcbiAgICBjb25zdCBlID0gcmVjdC5yaWdodCAtIGNsaWVudFggPCByZXNpemVUaHJlc2hvbGQ7XG4gICAgY29uc3QgcyA9IHJlY3QuYm90dG9tIC0gY2xpZW50WSA8IHJlc2l6ZVRocmVzaG9sZDtcbiAgICBjb25zdCB3ID0gY2xpZW50WCAtIHJlY3QubGVmdCA8IHJlc2l6ZVRocmVzaG9sZDtcblxuICAgIGxldCByOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQ7XG5cbiAgICBpZiAocykge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgciA9ICdzZSc7XG4gICAgICB9IGVsc2UgaWYgKHcpIHtcbiAgICAgICAgciA9ICdzdyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ3MnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZSkge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgciA9ICduZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgciA9ICdudyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ3cnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobikge1xuICAgICAgciA9ICduJztcbiAgICB9XG5cbiAgICBpZiAociAmJiByZXNpemVIYW5kbGVzLmhhcyhyKSkge1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGU6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCkge1xuICAgIHN3aXRjaCAocmVzaXplSGFuZGxlKSB7XG4gICAgICBjYXNlICduJzpcbiAgICAgIGNhc2UgJ3MnOlxuICAgICAgICByZXR1cm4gJ25zLXJlc2l6ZSc7XG4gICAgICBjYXNlICdlJzpcbiAgICAgIGNhc2UgJ3cnOlxuICAgICAgICByZXR1cm4gJ2V3LXJlc2l6ZSc7XG4gICAgICBjYXNlICduZSc6XG4gICAgICBjYXNlICdzdyc6XG4gICAgICAgIHJldHVybiAnbmVzdy1yZXNpemUnO1xuICAgICAgY2FzZSAnc2UnOlxuICAgICAgY2FzZSAnbncnOlxuICAgICAgICByZXR1cm4gJ253c2UtcmVzaXplJztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTW92ZSBvciByZXNpemUgc3BlY2lmaWVkIGl0ZW0ocykgKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyBkcmFnSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgICByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGlmIChyZXNpemVIYW5kbGUpIHtcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIHNlbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXNpemVJdGVtKGxheW91dCwgY29uZmlnLCBrZXksIHJlc2l6ZUhhbmRsZSwgZHgsIGR5KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5tb3ZlSXRlbXMobGF5b3V0LCBjb25maWcsIHNlbGVjdGlvbiwgZHgsIGR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlcyB0aGUgc3BlY2lmaWVkIGl0ZW1zIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgbW92ZUl0ZW1zKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPixcbiAgICBkeDogbnVtYmVyLFxuICAgIGR5OiBudW1iZXIsXG4gICkge1xuICAgIGlmICgoZHggPT09IDAgJiYgZHkgPT09IDApIHx8IHNlbGVjdGlvbi5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeCA9IGl0ZW0ueCArIGR4O1xuICAgICAgICBjb25zdCB5ID0gaXRlbS55ICsgZHk7XG5cbiAgICAgICAgaWYgKGl0ZW0ueCAhPT0geCB8fCBpdGVtLnkgIT09IHkpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5IH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29uZmlnLCBzZWxlY3Rpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2l6ZXMgdGhlIHNwZWNpZmllZCBpdGVtIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgcmVzaXplSXRlbShcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIGtleTogc3RyaW5nLFxuICAgIGhhbmRsZTogUmVzaXplSGFuZGxlLFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgKSB7XG4gICAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGNvbnN0IGluZGV4ID0gbGF5b3V0LmZpbmRJbmRleCgoaXQpID0+IGl0LmkgPT09IGtleSk7XG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaW5kZXhdO1xuXG4gICAgY29uc3QgeyBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMgfSA9IGNvbmZpZztcbiAgICBjb25zdCB7IG1heFcgPSBjb2x1bW5zLCBtYXhIID0gSW5maW5pdHkgfSA9IGl0ZW07XG4gICAgbGV0IHsgeCwgeSwgdywgaCB9ID0gaXRlbTtcbiAgICBjb25zdCB4dyA9IHggKyB3O1xuICAgIGNvbnN0IHloID0geSArIGg7XG4gICAgY29uc3QgY3ggPSBjb2x1bW5zIC0geDtcblxuICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICBjYXNlICduJzpcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZSc6XG4gICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3MnOlxuICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd3JzpcbiAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbmUnOlxuICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2UnOlxuICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3cnOlxuICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbncnOlxuICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChpdGVtLnggPT09IHggJiYgaXRlbS55ID09PSB5ICYmIGl0ZW0udyA9PT0gdyAmJiBpdGVtLmggPT09IGgpIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICBjb25zdCBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgb3V0W2luZGV4XSA9IHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29uZmlnLCBuZXcgU2V0KFtrZXldKSk7XG4gIH1cblxuICAvKipcbiAgICogRml4ZXMgb3ZlcmxhcHMsIGdhcHMsIGFuZCBsYXlvdXQgb3V0IG9mIGJvdW5kcy5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgdGhlcmUgd2FzIGFueXRoaW5nIHRvIHJlcGFpci5cbiAgICovXG4gIHN0YXRpYyByZXBhaXJMYXlvdXQoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBzZWxlY3Rpb24/OiBTZXQ8c3RyaW5nPixcbiAgKSB7XG4gICAgLy8gU29ydCBieSByb3cgZmlyc3QsIHNlbGVjdGlvbiBzZWNvbmQgKGlmIGFueSksIGNvbHVtbiB0aGlyZC5cbiAgICBjb25zdCBzb3J0ZWRJdGVtcyA9IGxheW91dC5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBpZiAoYS55IDwgYi55KSByZXR1cm4gLTE7XG4gICAgICBpZiAoYS55ID4gYi55KSByZXR1cm4gMTtcblxuICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICBpZiAoc2VsZWN0aW9uLmhhcyhhLmkpKSB7XG4gICAgICAgICAgaWYgKCFzZWxlY3Rpb24uaGFzKGIuaSkpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0aW9uLmhhcyhiLmkpKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGEueCA8IGIueCkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEueCA+IGIueCkgcmV0dXJuIDE7XG5cbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RhdGljSXRlbXMgPSBzb3J0ZWRJdGVtcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uc3RhdGljKTtcbiAgICBjb25zdCBudW1TdGF0aWNzID0gc3RhdGljSXRlbXMubGVuZ3RoO1xuICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuICAgIGxldCBzdGF0aWNPZmZzZXQgPSAwO1xuXG4gICAgY29uc3QgeyBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMgfSA9IGNvbmZpZztcblxuICAgIC8vIFwiUmlzaW5nIHRpZGVcIiwgaS5lLiBudW1iZXIgb2YgYmxvY2tlZCBjZWxscyBwZXIgY29sdW1uLlxuICAgIGNvbnN0IHRpZGU6IG51bWJlcltdID0gQXJyYXkoY29sdW1ucyk7XG5cbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IGNvbHVtbnM7ICsreCkge1xuICAgICAgdGlkZVt4XSA9IDA7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBzb3J0ZWRJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBhbGxvdyBpdGVtcyB0byBiZSBvdXQgb2YgYm91bmRzIGR1cmluZyBzb3J0aW5nLFxuICAgICAgLy8gd2hpY2ggKGZvciBleGFtcGxlKSBhbGxvd3MgbW92aW5nIGl0ZW1zIFwiYmVmb3JlXCIgdGhlIGZpcnN0IGl0ZW0uXG4gICAgICAvLyBXZSBmaXggYW55IG91dCBvZiBib3VuZCBpc3N1ZXMgaGVyZS5cbiAgICAgIGxldCBpdGVtID0gdGhpcy5yZXBhaXJJdGVtKHNvcnRlZEl0ZW1zW2ldLCBjb25maWcpO1xuICAgICAgY29uc3QgeDIgPSBpdGVtLnggKyBpdGVtLnc7XG5cbiAgICAgIGlmIChpdGVtLnN0YXRpYykge1xuICAgICAgICAvLyBUaGlzIHN0YXRpYyBpdGVtIHdpbGwgYmUgcGFydCBvZiB0aGUgdGlkZVxuICAgICAgICAvLyBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBjb25zaWRlcmVkIGZvciBjb2xsaXNpb24gYW55bW9yZS5cbiAgICAgICAgLy8gU2luY2Ugc3RhdGljIGl0ZW0gd2lsbCBiZSB2aXNpdGVkIGluIHRoZSBzYW1lIG9yZGVyXG4gICAgICAgIC8vIGFzIHRoZSBzdGF0aWNJdGVtcyBhcnJheSwgd2UgY2FuIGp1c3QgaW5jcmVtZW50IHRoZSBvZmZzZXQgaGVyZS5cbiAgICAgICAgKytzdGF0aWNPZmZzZXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBEZXRlY3Qgc21hbGxlc3QgZ2FwL2xhcmdlc3Qgb3ZlcmxhcCB3aXRoIHRpZGUuXG4gICAgICAgIGxldCBtaW5HYXAgPSBJbmZpbml0eTtcblxuICAgICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICAgIGNvbnN0IGdhcCA9IGl0ZW0ueSAtIHRpZGVbeF07XG5cbiAgICAgICAgICBpZiAoZ2FwIDwgbWluR2FwKSB7XG4gICAgICAgICAgICBtaW5HYXAgPSBnYXA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRml4IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAuXG4gICAgICAgIGxldCB5TmV4dCA9IGl0ZW0ueSAtIG1pbkdhcDtcblxuICAgICAgICAvLyBIYW5kbGUgY29sbGlzaW9uIHdpdGggc3RhdGljIGl0ZW1zLlxuICAgICAgICBmb3IgKGxldCBqID0gc3RhdGljT2Zmc2V0OyBqIDwgbnVtU3RhdGljczsgKytqKSB7XG4gICAgICAgICAgY29uc3Qgc3RhdGljSXRlbSA9IHN0YXRpY0l0ZW1zW2pdO1xuXG4gICAgICAgICAgaWYgKHN0YXRpY0l0ZW0ueSA+PSB5TmV4dCArIGl0ZW0uaCkge1xuICAgICAgICAgICAgLy8gRm9sbG93aW5nIHN0YXRpYyBpdGVtcyBjYW5ub3QgY29sbGlkZSBiZWNhdXNlIG9mIHNvcnRpbmc7IHN0b3AuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAvL3N0YXRpY0l0ZW0ueSA8IHlOZXh0ICsgaXRlbS5oICYmIC8vIFRoaXMgaXMgaW1wbGllZCBhYm92ZS5cbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaCA+IHlOZXh0ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggPCBpdGVtLnggKyBpdGVtLncgJiZcbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueCArIHN0YXRpY0l0ZW0udyA+IGl0ZW0ueFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gQ29sbGlzaW9uIGRldGVjdGVkOyBtb3ZlIGN1cnJlbnQgaXRlbSBiZWxvdyBzdGF0aWMgaXRlbS5cbiAgICAgICAgICAgIHlOZXh0ID0gc3RhdGljSXRlbS55ICsgc3RhdGljSXRlbS5oO1xuXG4gICAgICAgICAgICAvLyBDdXJyZW50IGl0ZW0gd2FzIG1vdmVkO1xuICAgICAgICAgICAgLy8gbmVlZCB0byByZWNoZWNrIGNvbGxpc2lvbiB3aXRoIG90aGVyIHN0YXRpYyBpdGVtcy5cbiAgICAgICAgICAgIGogPSBzdGF0aWNPZmZzZXQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0ueSAhPT0geU5leHQpIHtcbiAgICAgICAgICBpdGVtID0geyAuLi5pdGVtLCB5OiB5TmV4dCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGl0ZW0gIT09IHNvcnRlZEl0ZW1zW2ldKSB7XG4gICAgICAgICAgc29ydGVkSXRlbXNbaV0gPSBpdGVtO1xuICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGlkZS5cbiAgICAgIGNvbnN0IHQgPSBpdGVtLnkgKyBpdGVtLmg7XG5cbiAgICAgIGZvciAobGV0IHggPSBpdGVtLng7IHggPCB4MjsgKyt4KSB7XG4gICAgICAgIGlmICh0aWRlW3hdIDwgdCkge1xuICAgICAgICAgIHRpZGVbeF0gPSB0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1vZGlmaWVkID8gc29ydGVkSXRlbXMgOiBsYXlvdXQ7XG4gIH1cblxuICAvKipcbiAgICogUmVwYWlyIGJvdW5kcyBvZiB0aGUgZ2l2ZW4gaXRlbSB0byBmaXQgdGhlIGdpdmVuIGNvbmZpZy5cbiAgICogUmV0dXJucyBhIG5ldyBpdGVtIGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlySXRlbShpdGVtOiBHcmlkTGF5b3V0SXRlbSwgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnKSB7XG4gICAgY29uc3QgeyBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMgfSA9IGNvbmZpZztcbiAgICBjb25zdCB7IG1pblcgPSAxLCBtYXhXID0gY29sdW1ucywgbWluSCA9IDEsIG1heEggPSBJbmZpbml0eSB9ID0gaXRlbTtcbiAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuXG4gICAgdyA9IGNsYW1wKHcsIG1pblcsIG1pbihtYXhXLCBjb2x1bW5zKSk7XG4gICAgaCA9IGNsYW1wKGgsIG1pbkgsIG1heEgpO1xuICAgIHggPSBjbGFtcCh4LCAwLCBjb2x1bW5zIC0gdyk7XG4gICAgaWYgKHkgPCAwKSB5ID0gMDtcblxuICAgIGlmIChpdGVtLnggPT09IHggJiYgaXRlbS55ID09PSB5ICYmIGl0ZW0udyA9PT0gdyAmJiBpdGVtLmggPT09IGgpIHtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cblxuICAgIHJldHVybiB7IC4uLml0ZW0sIHgsIHksIHcsIGggfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgaWYgKHZhbHVlIDwgbWluKSByZXR1cm4gbWluO1xuICBpZiAodmFsdWUgPiBtYXgpIHJldHVybiBtYXg7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuY29uc3QgYWJzID0gTWF0aC5hYnM7XG5jb25zdCBtaW4gPSBNYXRoLm1pbjtcbmNvbnN0IHJvdW5kID0gTWF0aC5yb3VuZDtcblxuY29uc3QgQ0FQVFVSRSA9IHsgY2FwdHVyZTogdHJ1ZSB9O1xuY29uc3QgUEFTU0lWRSA9IHsgcGFzc2l2ZTogdHJ1ZSB9O1xuIl19