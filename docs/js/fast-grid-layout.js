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
        this.layoutNeedsUpdate = true;
        this.selectionNeedsUpdate = true;
        this.dragNeedsUpdate = true;
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
            this.layoutNeedsUpdate = true;
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
        this.layoutNeedsUpdate = true;
        this.selectionNeedsUpdate = true;
        this.dragNeedsUpdate = true;
        this.requestRender();
    }
    setLayout(layout) {
        var _a, _b;
        if (this.layout === layout)
            return;
        this.layout = this.fn.repairLayout(layout, this.config);
        (_b = (_a = this.config).onLayoutChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.layout);
        this.layoutNeedsUpdate = true;
        this.requestRender();
    }
    setSelection(selection) {
        var _a, _b;
        if (selection === this.selection)
            return;
        this.selection = new Set(selection);
        (_b = (_a = this.config).onSelectionChange) === null || _b === void 0 ? void 0 : _b.call(_a, this.selection);
        this.selectionNeedsUpdate = true;
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
        this.selectionNeedsUpdate = true;
        this.requestRender();
    }
    clearSelection() {
        if (this.selection.size > 0) {
            this.selection.clear();
            this.selectionNeedsUpdate = true;
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
        if (this.layoutNeedsUpdate) {
            this.fn.renderLayout(this.container, (_a = this.temporaryItems) !== null && _a !== void 0 ? _a : this.layout, this.config);
            this.layoutNeedsUpdate = false;
        }
        if (this.selectionNeedsUpdate) {
            this.fn.renderSelection(this.container, this.selection);
            this.selectionNeedsUpdate = false;
        }
        if (this.dragNeedsUpdate) {
            this.fn.renderDrag(this.container, this.dragging, this.resizeHandle);
            if (this.dragging) {
                const { dx, dy } = this.fn.calculateDrag(this.container, this.config, this.dragStartX, this.dragStartY, this.dragEndX, this.dragEndY);
                if (dx !== this.dragX || dy !== this.dragY) {
                    this.dragX = dx;
                    this.dragY = dy;
                    this.temporaryItems = this.fn.dragItems(this.layout, this.config, this.selection, dx, dy, this.resizeHandle);
                    this.layoutNeedsUpdate = true;
                }
            }
            this.dragNeedsUpdate = false;
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
        this.dragNeedsUpdate = true;
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
        if (this.temporaryItems) {
            this.setLayout(this.temporaryItems);
            this.temporaryItems = undefined;
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
        this.dragNeedsUpdate = true;
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
            const element = this.getTargetElement(e);
            if (element === null || element === void 0 ? void 0 : element.dataset.key) {
                this.toggleSelection(element.dataset.key, true);
            }
            else {
                this.clearSelection();
            }
        }
        else if (this.temporaryItems) {
            this.setLayout(this.temporaryItems);
            this.temporaryItems = undefined;
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
        this.dragNeedsUpdate = true;
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
        this.fn.renderDrag(this.container, false);
        this.resizeObserver.unobserve(this.container);
        this.removeEventListeners();
    }
    addEventListeners() {
        this.container.addEventListener('pointerdown', this._handleMouseDown);
        window.addEventListener('pointermove', this._handleMouseMove, {
            passive: true,
        });
        window.addEventListener('pointerup', this._handleMouseUp);
        window.addEventListener('pointercancel', this._handleMouseUp);
        this.container.addEventListener('pointerdown', this._handlePointerDown);
        window.addEventListener('pointermove', this._handlePointerMove, {
            passive: false,
        });
        window.addEventListener('pointerup', this._handlePointerUp);
        window.addEventListener('pointercancel', this._handlePointerUp);
        window.addEventListener('click', this._handleClick, { capture: true });
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
        window.removeEventListener('click', this._handleClick, { capture: true });
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
            const width = round(item.w * (columnWidth + columnGap) - columnGap) + 'px';
            const height = round(item.h * (rowHeight + rowGap) - rowGap) + 'px';
            const transform = 'translate(' +
                round(item.x * (columnWidth + columnGap)) +
                'px, ' +
                round(item.y * (rowHeight + rowGap)) +
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
        const containerHeight = round(hMax * (rowHeight + rowGap) - rowGap) + 'px';
        if (container.style.height !== containerHeight) {
            container.style.height = containerHeight;
        }
    }
    static renderSelection(container, selection) {
        for (let i = 0, l = container.children.length; i < l; ++i) {
            const element = container.children[i];
            if (element instanceof HTMLElement && selection && element.dataset.key) {
                element.classList.toggle('-selected', selection.has(element.dataset.key));
            }
        }
    }
    static renderDrag(container, dragging, resizeHandle) {
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
     * Moves the specified layout (in grid units).
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
        return this.repairLayout(out, config, this.compareMidpoint);
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
        return this.repairLayout(out, config);
    }
    /**
     * Fixes overlaps, gaps, and layout out of bounds.
     * Returns a new layout if there was anything to repair.
     */
    static repairLayout(layout, config, compare = this.compareTopLeft) {
        const { columns = this.DEFAULT_COLUMNS } = config;
        // "Rising tide", i.e. number of blocked cells per column.
        const tide = Array(columns);
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
                        staticItem.x + staticItem.w > item.x) {
                        // Collision detected; move current item below static item.
                        yNext = staticItem.y + staticItem.h;
                        // Current item was moved;
                        // need to recheck collision with other static layout.
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
     * Repair bounds of the given grid layout item to fit the given config.
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
    /**
     * Compare layout by midpoint (row-first).
     */
    static compareMidpoint(a, b) {
        // Compare by midpoint
        const au = a.x + a.w / 2;
        const av = a.y + a.h / 2;
        const bu = b.x + b.w / 2;
        const bv = b.y + b.h / 2;
        if (av < bv)
            return -1;
        if (av > bv)
            return 1;
        if (au < bu)
            return -1;
        if (au > bu)
            return 1;
        return 0;
    }
    /**
     * Compare by top left corner (row-first).
     */
    static compareTopLeft(a, b) {
        if (a.y < b.y)
            return -1;
        if (a.y > b.y)
            return 1;
        if (a.x < b.x)
            return -1;
        if (a.x > b.x)
            return 1;
        return 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXlGQSxNQUFNLE9BQU8sVUFBVTtJQThCckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBM0JsRCxXQUFNLEdBQXFCLEVBQUUsQ0FBQztRQUc5QixjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUc5QixrQkFBYSxHQUFHLENBQUMsQ0FBQztRQUNsQixrQkFBYSxHQUFHLENBQUMsQ0FBQztRQUNsQixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsZUFBVSxHQUFHLENBQUMsQ0FBQztRQUNmLGFBQVEsR0FBRyxDQUFDLENBQUM7UUFDYixhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBRWIsYUFBUSxHQUFHLEtBQUssQ0FBQztRQUNqQixVQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsVUFBSyxHQUFHLENBQUMsQ0FBQztRQUNWLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBSXJCLG9CQUFlLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLHNCQUFpQixHQUFHLElBQUksQ0FBQztRQUN6Qix5QkFBb0IsR0FBRyxJQUFJLENBQUM7UUFDNUIsb0JBQWUsR0FBRyxJQUFJLENBQUM7UUFFdkIsT0FBRSxHQUFHLElBQUksQ0FBQyxXQUFnQyxDQUFDO1FBcVUzQyxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxtQkFBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRS9DLHVCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFD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SyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLE1BQU07WUFDUixLQUFLLElBQUk7Z0JBQ1AsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLE1BQU07WUFDUixLQUFLLElBQUk7Z0JBQ1AsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNO1lBQ1IsS0FBSyxJQUFJO2dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dC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LEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0Q29uZmlnIHtcbiAgLyoqXG4gICAqIE51bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMlxuICAgKi9cbiAgY29sdW1ucz86IG51bWJlcjtcblxuICAvKipcbiAgICogSGVpZ2h0IG9mIGVhY2ggcm93IGluIHBpeGVscy5cbiAgICpcbiAgICogQGRlZmF1bHQgMzBcbiAgICovXG4gIHJvd0hlaWdodD86IG51bWJlcjtcblxuICAvKipcbiAgICogRGVmYXVsdCBnYXAgYmV0d2VlbiBncmlkIGNlbGxzIChhcHBsaWVzIHRvIGJvdGggcm93cyBhbmQgY29sdW1ucyBpZiBubyBvdmVycmlkZXMgYXJlIGdpdmVuKS5cbiAgICpcbiAgICogQGRlZmF1bHQgMFxuICAgKi9cbiAgZ2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIb3Jpem9udGFsIGdhcCBiZXR3ZWVuIGdyaWQgY29sdW1ucyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgY29sdW1uR2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBWZXJ0aWNhbCBnYXAgYmV0d2VlbiBncmlkIHJvd3MgaW4gcGl4ZWxzLlxuICAgKiBPdmVycmlkZXMgYGdhcGAgaWYgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBnYXBcbiAgICovXG4gIHJvd0dhcD86IG51bWJlcjtcblxuICAvKipcbiAgICogU2V0IG9mIGFsbG93ZWQgcmVzaXplIGhhbmRsZXMgZm9yIGdyaWQgaXRlbXMuXG4gICAqIFBvc3NpYmxlIHZhbHVlczogYCduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudydgLlxuICAgKlxuICAgKiBAZGVmYXVsdCBuZXcgU2V0KFsnZScsICdzZScsICdzJywgJ3N3JywgJ3cnXSlcbiAgICovXG4gIHJlc2l6ZUhhbmRsZXM/OiBTZXQ8UmVzaXplSGFuZGxlPjtcblxuICAvKipcbiAgICogUGl4ZWwgdGhyZXNob2xkIGZvciBkZXRlY3RpbmcgYSByZXNpemUgYWN0aW9uXG4gICAqIHdoZW4gcG9pbnRlciBpcyBuZWFyIGFuIGl0ZW0ncyBlZGdlLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMFxuICAgKi9cbiAgcmVzaXplVGhyZXNob2xkPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0cmlnZ2VyZWQgd2hlbiB0aGUgbGF5b3V0IGNoYW5nZXNcbiAgICogKGUuZy4gYWZ0ZXIgZHJhZy9yZXNpemUgb3IgZXh0ZXJuYWwgdXBkYXRlKS5cbiAgICovXG4gIG9uTGF5b3V0Q2hhbmdlPzogKGxheW91dDogR3JpZExheW91dEl0ZW1bXSkgPT4gdm9pZDtcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdHJpZ2dlcmVkIHdoZW4gdGhlIHNlbGVjdGlvbiBjaGFuZ2VzXG4gICAqIChlLmcuIHVzZXIgY2xpY2tzIG9yIHRvZ2dsZXMgaXRlbSBzZWxlY3Rpb24pLlxuICAgKi9cbiAgb25TZWxlY3Rpb25DaGFuZ2U/OiAoc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikgPT4gdm9pZDtcblxuICAvKipcbiAgICogSXMgdGhlIGxheW91dCBlZGl0YWJsZT9cbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZWRpdGFibGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRJdGVtIHtcbiAgaTogc3RyaW5nO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIG1pblc/OiBudW1iZXI7XG4gIG1pbkg/OiBudW1iZXI7XG4gIG1heFc/OiBudW1iZXI7XG4gIG1heEg/OiBudW1iZXI7XG4gIHN0YXRpYz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFJlc2l6ZUhhbmRsZSA9ICduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudyc7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByb3RlY3RlZCBjb25maWc6IEdyaWRMYXlvdXRDb25maWc7XG4gIHByb3RlY3RlZCBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10gPSBbXTtcbiAgcHJvdGVjdGVkIHRlbXBvcmFyeUl0ZW1zPzogR3JpZExheW91dEl0ZW1bXTtcblxuICBwcm90ZWN0ZWQgc2VsZWN0aW9uID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByb3RlY3RlZCByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGU7XG5cbiAgcHJvdGVjdGVkIGRyYWdQb2ludGVySWQgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0VGltZSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0tleT86IHN0cmluZztcbiAgcHJvdGVjdGVkIGRyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBkcmFnWCA9IDA7XG4gIHByb3RlY3RlZCBkcmFnWSA9IDA7XG4gIHByb3RlY3RlZCBwcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICBwcm90ZWN0ZWQgcmVzaXplT2JzZXJ2ZXI6IFJlc2l6ZU9ic2VydmVyO1xuXG4gIHByb3RlY3RlZCByZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGxheW91dE5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIHNlbGVjdGlvbk5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgcHJvdGVjdGVkIGRyYWdOZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgcHJvdGVjdGVkIGZuID0gdGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgR3JpZExheW91dDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcblxuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9KTtcbiAgICB0aGlzLnJlc2l6ZU9ic2VydmVyLm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgc2V0Q29uZmlnKGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIGlmICh0aGlzLmNvbmZpZyA9PT0gY29uZmlnKSByZXR1cm47XG5cbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KHRoaXMubGF5b3V0LCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5kcmFnTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgc2V0TGF5b3V0KGxheW91dDogR3JpZExheW91dEl0ZW1bXSkge1xuICAgIGlmICh0aGlzLmxheW91dCA9PT0gbGF5b3V0KSByZXR1cm47XG5cbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgdGhpcy5jb25maWcpO1xuICAgIHRoaXMuY29uZmlnLm9uTGF5b3V0Q2hhbmdlPy4odGhpcy5sYXlvdXQpO1xuXG4gICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRTZWxlY3Rpb24oc2VsZWN0aW9uOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG4gICAgaWYgKHNlbGVjdGlvbiA9PT0gdGhpcy5zZWxlY3Rpb24pIHJldHVybjtcblxuICAgIHRoaXMuc2VsZWN0aW9uID0gbmV3IFNldChzZWxlY3Rpb24pO1xuICAgIHRoaXMuY29uZmlnLm9uU2VsZWN0aW9uQ2hhbmdlPy4odGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICB0b2dnbGVTZWxlY3Rpb24oa2V5OiBzdHJpbmcsIGV4Y2x1c2l2ZSA9IGZhbHNlKSB7XG4gICAgaWYgKHRoaXMuc2VsZWN0aW9uLmhhcyhrZXkpKSB7XG4gICAgICB0aGlzLnNlbGVjdGlvbi5kZWxldGUoa2V5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGV4Y2x1c2l2ZSkge1xuICAgICAgICB0aGlzLnNlbGVjdGlvbi5jbGVhcigpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnNlbGVjdGlvbi5hZGQoa2V5KTtcbiAgICB9XG5cbiAgICB0aGlzLnNlbGVjdGlvbk5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICByZXF1ZXN0UmVuZGVyKCkge1xuICAgIGlmICghdGhpcy5yZW5kZXJSZXF1ZXN0ZWQpIHtcbiAgICAgIHRoaXMucmVuZGVyUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB0aGlzLnJlbmRlcigpKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLmxheW91dE5lZWRzVXBkYXRlKSB7XG4gICAgICB0aGlzLmZuLnJlbmRlckxheW91dChcbiAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgIHRoaXMudGVtcG9yYXJ5SXRlbXMgPz8gdGhpcy5sYXlvdXQsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0TmVlZHNVcGRhdGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSkge1xuICAgICAgdGhpcy5mbi5yZW5kZXJTZWxlY3Rpb24odGhpcy5jb250YWluZXIsIHRoaXMuc2VsZWN0aW9uKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uTmVlZHNVcGRhdGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5kcmFnTmVlZHNVcGRhdGUpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyRHJhZyh0aGlzLmNvbnRhaW5lciwgdGhpcy5kcmFnZ2luZywgdGhpcy5yZXNpemVIYW5kbGUpO1xuXG4gICAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgICBjb25zdCB7IGR4LCBkeSB9ID0gdGhpcy5mbi5jYWxjdWxhdGVEcmFnKFxuICAgICAgICAgIHRoaXMuY29udGFpbmVyLFxuICAgICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgICAgIHRoaXMuZHJhZ1N0YXJ0WCxcbiAgICAgICAgICB0aGlzLmRyYWdTdGFydFksXG4gICAgICAgICAgdGhpcy5kcmFnRW5kWCxcbiAgICAgICAgICB0aGlzLmRyYWdFbmRZLFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChkeCAhPT0gdGhpcy5kcmFnWCB8fCBkeSAhPT0gdGhpcy5kcmFnWSkge1xuICAgICAgICAgIHRoaXMuZHJhZ1ggPSBkeDtcbiAgICAgICAgICB0aGlzLmRyYWdZID0gZHk7XG5cbiAgICAgICAgICB0aGlzLnRlbXBvcmFyeUl0ZW1zID0gdGhpcy5mbi5kcmFnSXRlbXMoXG4gICAgICAgICAgICB0aGlzLmxheW91dCxcbiAgICAgICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgICBkeCxcbiAgICAgICAgICAgIGR5LFxuICAgICAgICAgICAgdGhpcy5yZXNpemVIYW5kbGUsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIHRoaXMubGF5b3V0TmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZHJhZ05lZWRzVXBkYXRlID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICBwcm90ZWN0ZWQgaGFuZGxlTW91c2VEb3duKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSAhPT0gJ21vdXNlJyB8fCBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuXG4gICAgdGhpcy5kcmFnU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLmRyYWdTdGFydFggPSB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdTdGFydFkgPSB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcblxuICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICBpZiAoZWxlbWVudCkge1xuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSB0aGlzLmZuLmNoZWNrUmVzaXplSGFuZGxlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB0aGlzLmNvbmZpZyxcbiAgICAgICAgZS5jbGllbnRYLFxuICAgICAgICBlLmNsaWVudFksXG4gICAgICApO1xuXG4gICAgICB0aGlzLmRyYWdLZXkgPSBlbGVtZW50LmRhdGFzZXQua2V5O1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVNb3VzZU1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlICE9PSAnbW91c2UnKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdFbmRYID0gZS5wYWdlWDtcbiAgICB0aGlzLmRyYWdFbmRZID0gZS5wYWdlWTtcbiAgICB0aGlzLmRyYWdOZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG5cbiAgICBpZiAoIXRoaXMuZHJhZ0tleSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSBlbGVtZW50XG4gICAgICAgID8gdGhpcy5mbi5jaGVja1Jlc2l6ZUhhbmRsZShlbGVtZW50LCB0aGlzLmNvbmZpZywgZS5jbGllbnRYLCBlLmNsaWVudFkpXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmRyYWdLZXkgJiYgIXRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuXG4gICAgICBpZiAoIXRoaXMuc2VsZWN0aW9uLmhhcyh0aGlzLmRyYWdLZXkpIHx8IHRoaXMucmVzaXplSGFuZGxlKSB7XG4gICAgICAgIHRoaXMuc2V0U2VsZWN0aW9uKFt0aGlzLmRyYWdLZXldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlTW91c2VVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgIT09ICdtb3VzZScgfHwgZS5idXR0b24gIT09IDApIHJldHVybjtcblxuICAgIGlmICh0aGlzLnRlbXBvcmFyeUl0ZW1zKSB7XG4gICAgICB0aGlzLnNldExheW91dCh0aGlzLnRlbXBvcmFyeUl0ZW1zKTtcbiAgICAgIHRoaXMudGVtcG9yYXJ5SXRlbXMgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdGhpcy5yZXNldERyYWcoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAodGhpcy5kcmFnUG9pbnRlcklkKSByZXR1cm47XG5cbiAgICB0aGlzLmRyYWdQb2ludGVySWQgPSBlLnBvaW50ZXJJZDtcbiAgICB0aGlzLmRyYWdTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WCA9IHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ1N0YXJ0WSA9IHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuXG4gICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSAmJiB0aGlzLnNlbGVjdGlvbi5oYXMoZWxlbWVudC5kYXRhc2V0LmtleSkpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5yZXNpemVIYW5kbGUgPSB0aGlzLmZuLmNoZWNrUmVzaXplSGFuZGxlKFxuICAgICAgICBlbGVtZW50LFxuICAgICAgICB0aGlzLmNvbmZpZyxcbiAgICAgICAgZS5jbGllbnRYLFxuICAgICAgICBlLmNsaWVudFksXG4gICAgICApO1xuXG4gICAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlck1vdmUoZTogUG9pbnRlckV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuICAgIGlmIChlLnBvaW50ZXJUeXBlID09PSAnbW91c2UnKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlcklkICE9PSB0aGlzLmRyYWdQb2ludGVySWQpIHJldHVybjtcblxuICAgIHRoaXMuZHJhZ0VuZFggPSBlLnBhZ2VYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLnBhZ2VZO1xuICAgIHRoaXMuZHJhZ05lZWRzVXBkYXRlID0gdHJ1ZTtcblxuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJVcChlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKGUucG9pbnRlclR5cGUgPT09ICdtb3VzZScpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVySWQgIT09IHRoaXMuZHJhZ1BvaW50ZXJJZCkgcmV0dXJuO1xuXG4gICAgaWYgKFxuICAgICAgdGhpcy5kcmFnU3RhcnRUaW1lID49IERhdGUubm93KCkgLSAyNTAgJiZcbiAgICAgIGFicyh0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYKSA8IDEwICYmXG4gICAgICBhYnModGhpcy5kcmFnRW5kWSAtIHRoaXMuZHJhZ1N0YXJ0WSkgPCAxMFxuICAgICkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudChlKTtcblxuICAgICAgaWYgKGVsZW1lbnQ/LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIHRoaXMudG9nZ2xlU2VsZWN0aW9uKGVsZW1lbnQuZGF0YXNldC5rZXksIHRydWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy50ZW1wb3JhcnlJdGVtcykge1xuICAgICAgdGhpcy5zZXRMYXlvdXQodGhpcy50ZW1wb3JhcnlJdGVtcyk7XG4gICAgICB0aGlzLnRlbXBvcmFyeUl0ZW1zID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXREcmFnKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLnByZXZlbnRDbGljaykge1xuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSBmYWxzZTtcblxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSkge1xuICAgICAgICB0aGlzLmNsZWFyU2VsZWN0aW9uKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnQoZSk7XG5cbiAgICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgICB0aGlzLnRvZ2dsZVNlbGVjdGlvbihlbGVtZW50LmRhdGFzZXQua2V5KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlS2V5VXAoZTogS2V5Ym9hcmRFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIHN3aXRjaCAoZS5rZXkpIHtcbiAgICAgIGNhc2UgJ0VzY2FwZSc6XG4gICAgICAgIHRoaXMucmVzZXREcmFnKCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCByZXNldERyYWcoKSB7XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdGlvbiA9IChkb2N1bWVudC5kZWZhdWx0VmlldyB8fCB3aW5kb3cpLmdldFNlbGVjdGlvbigpO1xuXG4gICAgICAgIGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLnR5cGUgIT09ICdDYXJldCcpIHtcbiAgICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBpZ25vcmVcbiAgICAgIH1cblxuICAgICAgdGhpcy5wcmV2ZW50Q2xpY2sgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMuZHJhZ1BvaW50ZXJJZCA9IDA7XG4gICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhZ0tleSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmRyYWdYID0gMDtcbiAgICB0aGlzLmRyYWdZID0gMDtcbiAgICB0aGlzLmRyYWdOZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0VGFyZ2V0RWxlbWVudChlOiBFdmVudCkge1xuICAgIGlmIChlLnRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlLnRhcmdldC5jbG9zZXN0PEhUTUxFbGVtZW50PignLmZhc3QtZ3JpZC1sYXlvdXQgPiAuaXRlbScpO1xuICAgIH1cbiAgfVxuXG4gIC8vXG5cbiAgZGlzY29ubmVjdCgpIHtcbiAgICB0aGlzLnJlc2V0RHJhZygpO1xuICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCBuZXcgU2V0KCkpO1xuICAgIHRoaXMuZm4ucmVuZGVyRHJhZyh0aGlzLmNvbnRhaW5lciwgZmFsc2UpO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci51bm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuXG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9oYW5kbGVNb3VzZURvd24gPSB0aGlzLmhhbmRsZU1vdXNlRG93bi5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZU1vdXNlTW92ZSA9IHRoaXMuaGFuZGxlTW91c2VNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlTW91c2VVcCA9IHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlckRvd24gPSB0aGlzLmhhbmRsZVBvaW50ZXJEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlck1vdmUgPSB0aGlzLmhhbmRsZVBvaW50ZXJNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlclVwID0gdGhpcy5oYW5kbGVQb2ludGVyVXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgX2hhbmRsZUNsaWNrID0gdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpO1xuICBwcm90ZWN0ZWQgX2hhbmRsZUtleVVwID0gdGhpcy5oYW5kbGVLZXlVcC5iaW5kKHRoaXMpO1xuXG4gIHByb3RlY3RlZCBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZU1vdXNlRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlTW91c2VNb3ZlLCB7XG4gICAgICBwYXNzaXZlOiB0cnVlLFxuICAgIH0pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUsIHtcbiAgICAgIHBhc3NpdmU6IGZhbHNlLFxuICAgIH0pO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgcHJvdGVjdGVkIHJlbW92ZUV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdGhpcy5faGFuZGxlTW91c2VEb3duKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVNb3VzZU1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVNb3VzZVVwKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIHRoaXMuX2hhbmRsZU1vdXNlVXApO1xuXG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyY2FuY2VsJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcblxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCB7IGNhcHR1cmU6IHRydWUgfSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgLy9cblxuICBzdGF0aWMgREVGQVVMVF9DT0xVTU5TID0gMTI7XG4gIHN0YXRpYyBERUZBVUxUX1JPV19IRUlHSFQgPSAzMDtcbiAgc3RhdGljIERFRkFVTFRfR0FQID0gMDtcbiAgc3RhdGljIERFRkFVTFRfUkVTSVpFX0hBTkRMRVMgPSBuZXcgU2V0KFsnZScsICdzZScsICdzJywgJ3N3JywgJ3cnXSk7XG4gIHN0YXRpYyBERUZBVUxUX1JFU0laRV9USFJFU0hPTEQgPSAxMDtcblxuICBzdGF0aWMgcmVuZGVyTGF5b3V0KFxuICAgIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29sdW1ucyA9IHRoaXMuREVGQVVMVF9DT0xVTU5TLFxuICAgICAgZ2FwID0gdGhpcy5ERUZBVUxUX0dBUCxcbiAgICAgIGNvbHVtbkdhcCA9IGdhcCxcbiAgICAgIHJvd0dhcCA9IGdhcCxcbiAgICAgIHJvd0hlaWdodCA9IHRoaXMuREVGQVVMVF9ST1dfSEVJR0hULFxuICAgIH0gPSBjb25maWc7XG5cbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgR3JpZExheW91dEl0ZW0+KCk7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG4gICAgICBtYXAuc2V0KGl0ZW0uaSwgaXRlbSk7XG4gICAgfVxuXG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2Zhc3QtZ3JpZC1sYXlvdXQnKTtcblxuICAgIGNvbnN0IGNvbnRhaW5lcldpZHRoID0gY29udGFpbmVyLm9mZnNldFdpZHRoO1xuICAgIGNvbnN0IGNvbHVtbldpZHRoID0gKGNvbnRhaW5lcldpZHRoIC0gKGNvbHVtbnMgLSAxKSAqIGNvbHVtbkdhcCkgLyBjb2x1bW5zO1xuXG4gICAgbGV0IGhNYXggPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmNoaWxkcmVuW2ldO1xuXG4gICAgICBpZiAoIShlbGVtZW50IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgIC8vIFRPRE8gd2FybmluZz9cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICghZWxlbWVudC5kYXRhc2V0LmtleSkge1xuICAgICAgICBlbGVtZW50LmRhdGFzZXQua2V5ID0gaS50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBrZXkgPSBlbGVtZW50LmRhdGFzZXQua2V5O1xuICAgICAgY29uc3QgaXRlbSA9IG1hcC5nZXQoa2V5KTtcblxuICAgICAgaWYgKCFpdGVtKSB7XG4gICAgICAgIC8vIFRPRE8gd2FybmluZz9cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaXRlbScpO1xuXG4gICAgICBjb25zdCBoID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBpZiAoaCA+IGhNYXgpIHtcbiAgICAgICAgaE1heCA9IGg7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHdpZHRoID1cbiAgICAgICAgcm91bmQoaXRlbS53ICogKGNvbHVtbldpZHRoICsgY29sdW1uR2FwKSAtIGNvbHVtbkdhcCkgKyAncHgnO1xuICAgICAgY29uc3QgaGVpZ2h0ID0gcm91bmQoaXRlbS5oICogKHJvd0hlaWdodCArIHJvd0dhcCkgLSByb3dHYXApICsgJ3B4JztcbiAgICAgIGNvbnN0IHRyYW5zZm9ybSA9XG4gICAgICAgICd0cmFuc2xhdGUoJyArXG4gICAgICAgIHJvdW5kKGl0ZW0ueCAqIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkpICtcbiAgICAgICAgJ3B4LCAnICtcbiAgICAgICAgcm91bmQoaXRlbS55ICogKHJvd0hlaWdodCArIHJvd0dhcCkpICtcbiAgICAgICAgJ3B4KSc7XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLndpZHRoICE9PSB3aWR0aCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLndpZHRoID0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbGVtZW50LnN0eWxlLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gIT09IHRyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zZm9ybTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjb250YWluZXJIZWlnaHQgPSByb3VuZChoTWF4ICogKHJvd0hlaWdodCArIHJvd0dhcCkgLSByb3dHYXApICsgJ3B4JztcblxuICAgIGlmIChjb250YWluZXIuc3R5bGUuaGVpZ2h0ICE9PSBjb250YWluZXJIZWlnaHQpIHtcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBjb250YWluZXJIZWlnaHQ7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHJlbmRlclNlbGVjdGlvbihjb250YWluZXI6IEhUTUxFbGVtZW50LCBzZWxlY3Rpb246IFNldDxzdHJpbmc+KSB7XG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmNoaWxkcmVuW2ldO1xuXG4gICAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50ICYmIHNlbGVjdGlvbiAmJiBlbGVtZW50LmRhdGFzZXQua2V5KSB7XG4gICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZShcbiAgICAgICAgICAnLXNlbGVjdGVkJyxcbiAgICAgICAgICBzZWxlY3Rpb24uaGFzKGVsZW1lbnQuZGF0YXNldC5rZXkpLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJEcmFnKFxuICAgIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gICAgZHJhZ2dpbmc6IGJvb2xlYW4sXG4gICAgcmVzaXplSGFuZGxlPzogUmVzaXplSGFuZGxlLFxuICApIHtcbiAgICBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnLW1vdmluZycsIGRyYWdnaW5nICYmICFyZXNpemVIYW5kbGUpO1xuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCctcmVzaXppbmcnLCBkcmFnZ2luZyAmJiAhIXJlc2l6ZUhhbmRsZSk7XG5cbiAgICBjb25zdCByb290ID0gY29udGFpbmVyLm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgcm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdfaGlkZS1zZWxlY3Rpb24nLCBkcmFnZ2luZyk7XG4gICAgcm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdfY3Vyc29yJywgISFyZXNpemVIYW5kbGUpO1xuXG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5nZXRSZXNpemVDdXJzb3IocmVzaXplSGFuZGxlKTtcblxuICAgIGlmIChyb290LnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tZmFzdC1ncmlkLWxheW91dC1jdXJzb3InKSAhPT0gY3Vyc29yKSB7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWZhc3QtZ3JpZC1sYXlvdXQtY3Vyc29yJywgY3Vyc29yKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgY2FsY3VsYXRlRHJhZyhcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBkcmFnU3RhcnRYOiBudW1iZXIsXG4gICAgZHJhZ1N0YXJ0WTogbnVtYmVyLFxuICAgIGRyYWdFbmRYOiBudW1iZXIsXG4gICAgZHJhZ0VuZFk6IG51bWJlcixcbiAgKSB7XG4gICAgY29uc3Qge1xuICAgICAgY29sdW1ucyA9IHRoaXMuREVGQVVMVF9DT0xVTU5TLFxuICAgICAgcm93SGVpZ2h0ID0gdGhpcy5ERUZBVUxUX1JPV19IRUlHSFQsXG4gICAgICBnYXAgPSB0aGlzLkRFRkFVTFRfR0FQLFxuICAgICAgY29sdW1uR2FwID0gZ2FwLFxuICAgICAgcm93R2FwID0gZ2FwLFxuICAgIH0gPSBjb25maWc7XG5cbiAgICBjb25zdCBjb250YWluZXJXaWR0aCA9IGNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICBjb25zdCBjb2x1bW5XaWR0aCA9IChjb250YWluZXJXaWR0aCAtIChjb2x1bW5zIC0gMSkgKiBjb2x1bW5HYXApIC8gY29sdW1ucztcbiAgICBjb25zdCBkeCA9IHJvdW5kKChkcmFnRW5kWCAtIGRyYWdTdGFydFgpIC8gKGNvbHVtbldpZHRoICsgY29sdW1uR2FwKSk7XG4gICAgY29uc3QgZHkgPSByb3VuZCgoZHJhZ0VuZFkgLSBkcmFnU3RhcnRZKSAvIChyb3dIZWlnaHQgKyByb3dHYXApKTtcblxuICAgIHJldHVybiB7IGR4LCBkeSB9O1xuICB9XG5cbiAgc3RhdGljIGNoZWNrUmVzaXplSGFuZGxlKFxuICAgIGVsZW1lbnQ6IEVsZW1lbnQsXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIGNsaWVudFg6IG51bWJlcixcbiAgICBjbGllbnRZOiBudW1iZXIsXG4gICk6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3Qge1xuICAgICAgcmVzaXplSGFuZGxlcyA9IHRoaXMuREVGQVVMVF9SRVNJWkVfSEFORExFUyxcbiAgICAgIHJlc2l6ZVRocmVzaG9sZCA9IHRoaXMuREVGQVVMVF9SRVNJWkVfVEhSRVNIT0xELFxuICAgIH0gPSBjb25maWc7XG5cbiAgICBjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBjb25zdCBuID0gY2xpZW50WSAtIHJlY3QudG9wIDwgcmVzaXplVGhyZXNob2xkO1xuICAgIGNvbnN0IGUgPSByZWN0LnJpZ2h0IC0gY2xpZW50WCA8IHJlc2l6ZVRocmVzaG9sZDtcbiAgICBjb25zdCBzID0gcmVjdC5ib3R0b20gLSBjbGllbnRZIDwgcmVzaXplVGhyZXNob2xkO1xuICAgIGNvbnN0IHcgPSBjbGllbnRYIC0gcmVjdC5sZWZ0IDwgcmVzaXplVGhyZXNob2xkO1xuXG4gICAgbGV0IHI6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZDtcblxuICAgIGlmIChzKSB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByID0gJ3NlJztcbiAgICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgICByID0gJ3N3JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHIgPSAncyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlKSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByID0gJ25lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHIgPSAnZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3KSB7XG4gICAgICBpZiAobikge1xuICAgICAgICByID0gJ253JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHIgPSAndyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuKSB7XG4gICAgICByID0gJ24nO1xuICAgIH1cblxuICAgIGlmIChyICYmIHJlc2l6ZUhhbmRsZXMuaGFzKHIpKSB7XG4gICAgICByZXR1cm4gcjtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgZ2V0UmVzaXplQ3Vyc29yKHJlc2l6ZUhhbmRsZTogUmVzaXplSGFuZGxlIHwgdW5kZWZpbmVkKSB7XG4gICAgc3dpdGNoIChyZXNpemVIYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgY2FzZSAncyc6XG4gICAgICAgIHJldHVybiAnbnMtcmVzaXplJztcbiAgICAgIGNhc2UgJ2UnOlxuICAgICAgY2FzZSAndyc6XG4gICAgICAgIHJldHVybiAnZXctcmVzaXplJztcbiAgICAgIGNhc2UgJ25lJzpcbiAgICAgIGNhc2UgJ3N3JzpcbiAgICAgICAgcmV0dXJuICduZXN3LXJlc2l6ZSc7XG4gICAgICBjYXNlICdzZSc6XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIHJldHVybiAnbndzZS1yZXNpemUnO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlIG9yIHJlc2l6ZSBzcGVjaWZpZWQgaXRlbShzKSAoaW4gZ3JpZCB1bml0cykuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIG1vZGlmaWVkLlxuICAgKi9cbiAgc3RhdGljIGRyYWdJdGVtcyhcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIHNlbGVjdGlvbjogU2V0PHN0cmluZz4sXG4gICAgZHg6IG51bWJlcixcbiAgICBkeTogbnVtYmVyLFxuICAgIHJlc2l6ZUhhbmRsZT86IFJlc2l6ZUhhbmRsZSxcbiAgKSB7XG4gICAgaWYgKHJlc2l6ZUhhbmRsZSkge1xuICAgICAgZm9yIChjb25zdCBrZXkgb2Ygc2VsZWN0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc2l6ZUl0ZW0obGF5b3V0LCBjb25maWcsIGtleSwgcmVzaXplSGFuZGxlLCBkeCwgZHkpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm1vdmVJdGVtcyhsYXlvdXQsIGNvbmZpZywgc2VsZWN0aW9uLCBkeCwgZHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmVzIHRoZSBzcGVjaWZpZWQgbGF5b3V0IChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgbW92ZUl0ZW1zKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPixcbiAgICBkeDogbnVtYmVyLFxuICAgIGR5OiBudW1iZXIsXG4gICkge1xuICAgIGlmICgoZHggPT09IDAgJiYgZHkgPT09IDApIHx8IHNlbGVjdGlvbi5zaXplID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGxldCBvdXQgPSBsYXlvdXQ7XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxheW91dC5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaV07XG5cbiAgICAgIGlmIChzZWxlY3Rpb24uaGFzKGl0ZW0uaSkpIHtcbiAgICAgICAgY29uc3QgeCA9IGl0ZW0ueCArIGR4O1xuICAgICAgICBjb25zdCB5ID0gaXRlbS55ICsgZHk7XG5cbiAgICAgICAgaWYgKGl0ZW0ueCAhPT0geCB8fCBpdGVtLnkgIT09IHkpIHtcbiAgICAgICAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgICAgICAgIC8vIENvcHkgb24gd3JpdGUuXG4gICAgICAgICAgICBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgb3V0W2ldID0geyAuLi5pdGVtLCB4LCB5IH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3V0ID09PSBsYXlvdXQpIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29uZmlnLCB0aGlzLmNvbXBhcmVNaWRwb2ludCk7XG4gIH1cblxuICAvKipcbiAgICogUmVzaXplcyB0aGUgc3BlY2lmaWVkIGl0ZW0gKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyByZXNpemVJdGVtKFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAga2V5OiBzdHJpbmcsXG4gICAgaGFuZGxlOiBSZXNpemVIYW5kbGUsXG4gICAgZHg6IG51bWJlcixcbiAgICBkeTogbnVtYmVyLFxuICApIHtcbiAgICBpZiAoZHggPT09IDAgJiYgZHkgPT09IDApIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgaW5kZXggPSBsYXlvdXQuZmluZEluZGV4KChpdCkgPT4gaXQuaSA9PT0ga2V5KTtcblxuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgaXRlbSA9IGxheW91dFtpbmRleF07XG5cbiAgICBjb25zdCB7IGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyB9ID0gY29uZmlnO1xuICAgIGNvbnN0IHsgbWF4VyA9IGNvbHVtbnMsIG1heEggPSBJbmZpbml0eSB9ID0gaXRlbTtcbiAgICBsZXQgeyB4LCB5LCB3LCBoIH0gPSBpdGVtO1xuICAgIGNvbnN0IHh3ID0geCArIHc7XG4gICAgY29uc3QgeWggPSB5ICsgaDtcbiAgICBjb25zdCBjeCA9IGNvbHVtbnMgLSB4O1xuXG4gICAgc3dpdGNoIChoYW5kbGUpIHtcbiAgICAgIGNhc2UgJ24nOlxuICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgeSA9IGNsYW1wKHkgKyBkeSwgMCwgeWggLSAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdlJzpcbiAgICAgICAgdyA9IGNsYW1wKHcgKyBkeCwgMSwgbWluKG1heFcsIGN4KSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncyc6XG4gICAgICAgIGggPSBjbGFtcChoICsgZHksIDEsIG1heEgpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3cnOlxuICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICduZSc6XG4gICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgeSA9IGNsYW1wKHkgKyBkeSwgMCwgeWggLSAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzZSc6XG4gICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzdyc6XG4gICAgICAgIHcgPSBjbGFtcCh3IC0gZHgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdudyc6XG4gICAgICAgIHcgPSBjbGFtcCh3IC0gZHgsIDEsIG1pbihtYXhXLCB4dykpO1xuICAgICAgICBoID0gY2xhbXAoaCAtIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgeCA9IGNsYW1wKHggKyBkeCwgMCwgeHcgLSAxKTtcbiAgICAgICAgeSA9IGNsYW1wKHkgKyBkeSwgMCwgeWggLSAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKGl0ZW0ueCA9PT0geCAmJiBpdGVtLnkgPT09IHkgJiYgaXRlbS53ID09PSB3ICYmIGl0ZW0uaCA9PT0gaCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICAvLyBDb3B5IG9uIHdyaXRlLlxuICAgIGNvbnN0IG91dCA9IGxheW91dC5zbGljZSgwKTtcbiAgICBvdXRbaW5kZXhdID0geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXBhaXJMYXlvdXQob3V0LCBjb25maWcpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZpeGVzIG92ZXJsYXBzLCBnYXBzLCBhbmQgbGF5b3V0IG91dCBvZiBib3VuZHMuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIHRoZXJlIHdhcyBhbnl0aGluZyB0byByZXBhaXIuXG4gICAqL1xuICBzdGF0aWMgcmVwYWlyTGF5b3V0KFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgY29tcGFyZSA9IHRoaXMuY29tcGFyZVRvcExlZnQsXG4gICkge1xuICAgIGNvbnN0IHsgY29sdW1ucyA9IHRoaXMuREVGQVVMVF9DT0xVTU5TIH0gPSBjb25maWc7XG5cbiAgICAvLyBcIlJpc2luZyB0aWRlXCIsIGkuZS4gbnVtYmVyIG9mIGJsb2NrZWQgY2VsbHMgcGVyIGNvbHVtbi5cbiAgICBjb25zdCB0aWRlOiBudW1iZXJbXSA9IEFycmF5KGNvbHVtbnMpO1xuXG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCBjb2x1bW5zOyArK3gpIHtcbiAgICAgIHRpZGVbeF0gPSAwO1xuICAgIH1cblxuICAgIGNvbnN0IHNvcnRlZEl0ZW1zID0gbGF5b3V0LnNsaWNlKDApLnNvcnQoY29tcGFyZSk7XG4gICAgY29uc3Qgc3RhdGljSXRlbXMgPSBzb3J0ZWRJdGVtcy5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uc3RhdGljKTtcbiAgICBjb25zdCBudW1TdGF0aWNzID0gc3RhdGljSXRlbXMubGVuZ3RoO1xuICAgIGxldCBtb2RpZmllZCA9IGZhbHNlO1xuICAgIGxldCBzdGF0aWNPZmZzZXQgPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBzb3J0ZWRJdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIC8vIE5vdGUgdGhhdCB3ZSBhbGxvdyBsYXlvdXQgdG8gYmUgb3V0IG9mIGJvdW5kcyBkdXJpbmcgc29ydGluZyxcbiAgICAgIC8vIHdoaWNoIChmb3IgZXhhbXBsZSkgYWxsb3dzIG1vdmluZyBsYXlvdXQgXCJiZWZvcmVcIiB0aGUgZmlyc3QgaXRlbS5cbiAgICAgIC8vIFdlIGZpeCBhbnkgb3V0IG9mIGJvdW5kIGlzc3VlcyBoZXJlLlxuICAgICAgbGV0IGl0ZW0gPSB0aGlzLnJlcGFpckl0ZW0oc29ydGVkSXRlbXNbaV0sIGNvbmZpZyk7XG4gICAgICBjb25zdCB4MiA9IGl0ZW0ueCArIGl0ZW0udztcblxuICAgICAgaWYgKGl0ZW0uc3RhdGljKSB7XG4gICAgICAgIC8vIFRoaXMgc3RhdGljIGl0ZW0gd2lsbCBiZSBwYXJ0IG9mIHRoZSB0aWRlXG4gICAgICAgIC8vIGFuZCBkb2VzIG5vdCBuZWVkIHRvIGJlIGNvbnNpZGVyZWQgZm9yIGNvbGxpc2lvbiBhbnltb3JlLlxuICAgICAgICAvLyBTaW5jZSBzdGF0aWMgbGF5b3V0IHdpbGwgYmUgdmlzaXRlZCBpbiB0aGUgc2FtZSBvcmRlclxuICAgICAgICAvLyBhcyB0aGUgc3RhdGljSXRlbXMgYXJyYXksIHdlIGNhbiBqdXN0IGluY3JlbWVudCB0aGUgb2Zmc2V0IGhlcmUuXG4gICAgICAgICsrc3RhdGljT2Zmc2V0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGV0ZWN0IHNtYWxsZXN0IGdhcC9sYXJnZXN0IG92ZXJsYXAgd2l0aCB0aWRlLlxuICAgICAgICBsZXQgbWluR2FwID0gSW5maW5pdHk7XG5cbiAgICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgICBjb25zdCBnYXAgPSBpdGVtLnkgLSB0aWRlW3hdO1xuXG4gICAgICAgICAgaWYgKGdhcCA8IG1pbkdhcCkge1xuICAgICAgICAgICAgbWluR2FwID0gZ2FwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpeCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwLlxuICAgICAgICBsZXQgeU5leHQgPSBpdGVtLnkgLSBtaW5HYXA7XG5cbiAgICAgICAgLy8gSGFuZGxlIGNvbGxpc2lvbiB3aXRoIHN0YXRpYyBsYXlvdXQuXG4gICAgICAgIGZvciAobGV0IGogPSBzdGF0aWNPZmZzZXQ7IGogPCBudW1TdGF0aWNzOyArK2opIHtcbiAgICAgICAgICBjb25zdCBzdGF0aWNJdGVtID0gc3RhdGljSXRlbXNbal07XG5cbiAgICAgICAgICBpZiAoc3RhdGljSXRlbS55ID49IHlOZXh0ICsgaXRlbS5oKSB7XG4gICAgICAgICAgICAvLyBGb2xsb3dpbmcgc3RhdGljIGxheW91dCBjYW5ub3QgY29sbGlkZSBiZWNhdXNlIG9mIHNvcnRpbmc7IHN0b3AuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAvL3N0YXRpY0l0ZW0ueSA8IHlOZXh0ICsgaXRlbS5oICYmIC8vIFRoaXMgaXMgaW1wbGllZCBhYm92ZS5cbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaCA+IHlOZXh0ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggPCBpdGVtLnggKyBpdGVtLncgJiZcbiAgICAgICAgICAgIHN0YXRpY0l0ZW0ueCArIHN0YXRpY0l0ZW0udyA+IGl0ZW0ueFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gQ29sbGlzaW9uIGRldGVjdGVkOyBtb3ZlIGN1cnJlbnQgaXRlbSBiZWxvdyBzdGF0aWMgaXRlbS5cbiAgICAgICAgICAgIHlOZXh0ID0gc3RhdGljSXRlbS55ICsgc3RhdGljSXRlbS5oO1xuXG4gICAgICAgICAgICAvLyBDdXJyZW50IGl0ZW0gd2FzIG1vdmVkO1xuICAgICAgICAgICAgLy8gbmVlZCB0byByZWNoZWNrIGNvbGxpc2lvbiB3aXRoIG90aGVyIHN0YXRpYyBsYXlvdXQuXG4gICAgICAgICAgICBqID0gc3RhdGljT2Zmc2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtLnkgIT09IHlOZXh0KSB7XG4gICAgICAgICAgaXRlbSA9IHsgLi4uaXRlbSwgeTogeU5leHQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpdGVtICE9PSBzb3J0ZWRJdGVtc1tpXSkge1xuICAgICAgICAgIHNvcnRlZEl0ZW1zW2ldID0gaXRlbTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRpZGUuXG4gICAgICBjb25zdCB0ID0gaXRlbS55ICsgaXRlbS5oO1xuXG4gICAgICBmb3IgKGxldCB4ID0gaXRlbS54OyB4IDwgeDI7ICsreCkge1xuICAgICAgICBpZiAodGlkZVt4XSA8IHQpIHtcbiAgICAgICAgICB0aWRlW3hdID0gdDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtb2RpZmllZCA/IHNvcnRlZEl0ZW1zIDogbGF5b3V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGFpciBib3VuZHMgb2YgdGhlIGdpdmVuIGdyaWQgbGF5b3V0IGl0ZW0gdG8gZml0IHRoZSBnaXZlbiBjb25maWcuXG4gICAqIFJldHVybnMgYSBuZXcgaXRlbSBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckl0ZW0oaXRlbTogR3JpZExheW91dEl0ZW0sIGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIGNvbnN0IHsgY29sdW1ucyA9IHRoaXMuREVGQVVMVF9DT0xVTU5TIH0gPSBjb25maWc7XG4gICAgY29uc3QgeyBtaW5XID0gMSwgbWF4VyA9IGNvbHVtbnMsIG1pbkggPSAxLCBtYXhIID0gSW5maW5pdHkgfSA9IGl0ZW07XG4gICAgbGV0IHsgeCwgeSwgdywgaCB9ID0gaXRlbTtcblxuICAgIHcgPSBjbGFtcCh3LCBtaW5XLCBtaW4obWF4VywgY29sdW1ucykpO1xuICAgIGggPSBjbGFtcChoLCBtaW5ILCBtYXhIKTtcbiAgICB4ID0gY2xhbXAoeCwgMCwgY29sdW1ucyAtIHcpO1xuICAgIGlmICh5IDwgMCkgeSA9IDA7XG5cbiAgICBpZiAoaXRlbS54ID09PSB4ICYmIGl0ZW0ueSA9PT0geSAmJiBpdGVtLncgPT09IHcgJiYgaXRlbS5oID09PSBoKSB7XG4gICAgICByZXR1cm4gaXRlbTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5pdGVtLCB4LCB5LCB3LCBoIH07XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyZSBsYXlvdXQgYnkgbWlkcG9pbnQgKHJvdy1maXJzdCkuXG4gICAqL1xuICBzdGF0aWMgY29tcGFyZU1pZHBvaW50KGE6IEdyaWRMYXlvdXRJdGVtLCBiOiBHcmlkTGF5b3V0SXRlbSkge1xuICAgIC8vIENvbXBhcmUgYnkgbWlkcG9pbnRcbiAgICBjb25zdCBhdSA9IGEueCArIGEudyAvIDI7XG4gICAgY29uc3QgYXYgPSBhLnkgKyBhLmggLyAyO1xuICAgIGNvbnN0IGJ1ID0gYi54ICsgYi53IC8gMjtcbiAgICBjb25zdCBidiA9IGIueSArIGIuaCAvIDI7XG5cbiAgICBpZiAoYXYgPCBidikgcmV0dXJuIC0xO1xuICAgIGlmIChhdiA+IGJ2KSByZXR1cm4gMTtcbiAgICBpZiAoYXUgPCBidSkgcmV0dXJuIC0xO1xuICAgIGlmIChhdSA+IGJ1KSByZXR1cm4gMTtcblxuICAgIHJldHVybiAwO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgYnkgdG9wIGxlZnQgY29ybmVyIChyb3ctZmlyc3QpLlxuICAgKi9cbiAgc3RhdGljIGNvbXBhcmVUb3BMZWZ0KGE6IEdyaWRMYXlvdXRJdGVtLCBiOiBHcmlkTGF5b3V0SXRlbSkge1xuICAgIGlmIChhLnkgPCBiLnkpIHJldHVybiAtMTtcbiAgICBpZiAoYS55ID4gYi55KSByZXR1cm4gMTtcbiAgICBpZiAoYS54IDwgYi54KSByZXR1cm4gLTE7XG4gICAgaWYgKGEueCA+IGIueCkgcmV0dXJuIDE7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGFtcCh2YWx1ZTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpIHtcbiAgaWYgKHZhbHVlIDwgbWluKSByZXR1cm4gbWluO1xuICBpZiAodmFsdWUgPiBtYXgpIHJldHVybiBtYXg7XG4gIHJldHVybiB2YWx1ZTtcbn1cblxuY29uc3QgYWJzID0gTWF0aC5hYnM7XG5jb25zdCBtaW4gPSBNYXRoLm1pbjtcbmNvbnN0IHJvdW5kID0gTWF0aC5yb3VuZDtcbiJdfQ==