export class GridLayout {
    constructor(container, config) {
        this.layout = [];
        this.selection = new Set();
        this.dragging = false;
        this.dragStartTime = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragEndX = 0;
        this.dragEndY = 0;
        this.dragX = 0;
        this.dragY = 0;
        this.preventClick = false;
        this.renderRequested = false;
        this.layoutNeedsUpdate = true;
        this.selectionNeedsUpdate = true;
        this.dragNeedsUpdate = true;
        this._handleClick = this.handleClick.bind(this);
        this._handlePointerDown = this.handlePointerDown.bind(this);
        this._handlePointerMove = this.handlePointerMove.bind(this);
        this._handlePointerUp = this.handlePointerUp.bind(this);
        this._handleKeyUp = this.handleKeyUp.bind(this);
        this.fn = this.constructor;
        this.container = container;
        this.config = config;
        this.resizeObserver = new ResizeObserver(() => {
            this.layoutNeedsUpdate = true;
            this.requestRender();
        });
        this.resizeObserver.observe(this.container);
        this.container.addEventListener('pointerdown', this._handlePointerDown);
        window.addEventListener('pointermove', this._handlePointerMove, {
            passive: true,
        });
        window.addEventListener('pointerup', this._handlePointerUp);
        window.addEventListener('click', this._handleClick, true);
        window.addEventListener('keyup', this._handleKeyUp);
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
    toggleSelection(key) {
        if (this.selection.has(key)) {
            this.selection.delete(key);
        }
        else {
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
            this.dragNeedsUpdate = false;
        }
    }
    //
    handlePointerDown(e) {
        if (this.config.editable === false)
            return;
        if (this.dragging)
            return;
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        const element = e.target instanceof Element
            ? e.target.closest('.fast-grid-layout > .item')
            : undefined;
        if (!element)
            return;
        this.resizeHandle = this.fn.checkResizeHandle(element, this.config, e.clientX, e.clientY);
        this.dragKey = element.dataset.key;
        this.dragStartTime = Date.now();
        this.dragEndX = this.dragStartX = e.clientX + window.scrollX;
        this.dragEndY = this.dragStartY = e.clientY + window.scrollY;
    }
    handlePointerMove(e) {
        if (this.config.editable === false)
            return;
        this.requestRender();
        this.dragEndX = e.clientX + window.scrollX;
        this.dragEndY = e.clientY + window.scrollY;
        this.dragNeedsUpdate = true;
        if (this.dragging) {
            const { dx, dy } = this.fn.calculateDrag(this.container, this.config, this.dragStartX, this.dragStartY, this.dragEndX, this.dragEndY);
            if (dx !== this.dragX || dy !== this.dragY) {
                this.dragX = dx;
                this.dragY = dy;
                this.temporaryItems = this.fn.dragItems(this.layout, this.config, this.selection, dx, dy, this.resizeHandle);
                this.layoutNeedsUpdate = true;
            }
            return;
        }
        if (!this.dragKey) {
            const element = e.target instanceof Element
                ? e.target.closest('.fast-grid-layout > .item')
                : undefined;
            this.resizeHandle = element
                ? this.fn.checkResizeHandle(element, this.config, e.clientX, e.clientY)
                : undefined;
            return;
        }
        const deltaX = this.dragEndX - this.dragStartX;
        const deltaY = this.dragEndY - this.dragStartY;
        const { dragThreshold = this.fn.DEFAULT_DRAG_THRESHOLD } = this.config;
        if (abs(deltaX) < dragThreshold && abs(deltaY) < dragThreshold) {
            return;
        }
        // Prevent unintentional dragging on touch devices.
        if (e.pointerType === 'touch' && Date.now() - this.dragStartTime < 50) {
            return this.cleanUpAfterDrag();
        }
        this.dragging = true;
        if (!this.selection.has(this.dragKey) || this.resizeHandle) {
            this.setSelection([this.dragKey]);
        }
    }
    handlePointerUp() {
        if (this.config.editable === false)
            return;
        if (this.dragging && this.temporaryItems) {
            this.setLayout(this.temporaryItems);
            this.temporaryItems = undefined;
        }
        this.cleanUpAfterDrag();
    }
    handleClick(e) {
        if (this.config.editable === false)
            return;
        if (this.preventClick) {
            this.preventClick = false;
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if (!e.ctrlKey && !e.metaKey) {
            this.clearSelection();
        }
        const element = e.target instanceof Element
            ? e.target.closest('.fast-grid-layout > .item')
            : undefined;
        if (element === null || element === void 0 ? void 0 : element.dataset.key) {
            this.toggleSelection(element.dataset.key);
        }
    }
    handleKeyUp(e) {
        if (this.config.editable === false)
            return;
        if (e.key === 'Escape') {
            this.cleanUpAfterDrag();
        }
    }
    cleanUpAfterDrag() {
        if (this.dragging) {
            const selection = (document.defaultView || window).getSelection();
            if (selection && selection.type !== 'Caret') {
                selection.removeAllRanges();
            }
            this.preventClick = true;
        }
        this.dragging = false;
        this.dragKey = undefined;
        this.resizeHandle = undefined;
        this.dragX = 0;
        this.dragY = 0;
        this.dragNeedsUpdate = true;
        this.requestRender();
    }
    disconnect() {
        this.cleanUpAfterDrag();
        this.fn.renderSelection(this.container, new Set());
        this.fn.renderDrag(this.container, false);
        this.resizeObserver.unobserve(this.container);
        this.container.removeEventListener('pointerdown', this._handlePointerDown);
        window.removeEventListener('pointermove', this._handlePointerMove);
        window.removeEventListener('pointerup', this._handlePointerUp);
        window.removeEventListener('click', this._handleClick, true);
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
GridLayout.DEFAULT_DRAG_THRESHOLD = 5;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFzdC1ncmlkLWxheW91dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9mYXN0LWdyaWQtbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQW1HQSxNQUFNLE9BQU8sVUFBVTtJQW1DckIsWUFBWSxTQUFzQixFQUFFLE1BQXdCO1FBaENsRCxXQUFNLEdBQXFCLEVBQUUsQ0FBQztRQUc5QixjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUc5QixhQUFRLEdBQUcsS0FBSyxDQUFDO1FBRWpCLGtCQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLGVBQVUsR0FBRyxDQUFDLENBQUM7UUFDZixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUNiLGFBQVEsR0FBRyxDQUFDLENBQUM7UUFDYixVQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsVUFBSyxHQUFHLENBQUMsQ0FBQztRQUNWLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBSXJCLG9CQUFlLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLHNCQUFpQixHQUFHLElBQUksQ0FBQztRQUN6Qix5QkFBb0IsR0FBRyxJQUFJLENBQUM7UUFDNUIsb0JBQWUsR0FBRyxJQUFJLENBQUM7UUFFdkIsaUJBQVksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMzQyx1QkFBa0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELHVCQUFrQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQscUJBQWdCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkQsaUJBQVksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUz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LEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDM0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLE1BQU07WUFDUixLQUFLLElBQUk7Z0JBQ1AsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLE1BQU07WUFDUixLQUFLLElBQUk7Z0JBQ1AsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzNCLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixNQUFNO1lBQ1IsS0FBSyxJQUFJO2dCQUNQLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMzQixDQUFDLEdBQUcsS0FBSyxD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QztBQUNyQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGludGVyZmFjZSBHcmlkTGF5b3V0Q29uZmlnIHtcbiAgLyoqXG4gICAqIE51bWJlciBvZiBjb2x1bW5zIGluIHRoZSBncmlkLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMlxuICAgKi9cbiAgY29sdW1ucz86IG51bWJlcjtcblxuICAvKipcbiAgICogSGVpZ2h0IG9mIGVhY2ggcm93IGluIHBpeGVscy5cbiAgICpcbiAgICogQGRlZmF1bHQgMzBcbiAgICovXG4gIHJvd0hlaWdodD86IG51bWJlcjtcblxuICAvKipcbiAgICogRGVmYXVsdCBnYXAgYmV0d2VlbiBncmlkIGNlbGxzIChhcHBsaWVzIHRvIGJvdGggcm93cyBhbmQgY29sdW1ucyBpZiBubyBvdmVycmlkZXMgYXJlIGdpdmVuKS5cbiAgICpcbiAgICogQGRlZmF1bHQgMFxuICAgKi9cbiAgZ2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBIb3Jpem9udGFsIGdhcCBiZXR3ZWVuIGdyaWQgY29sdW1ucyBpbiBwaXhlbHMuXG4gICAqIE92ZXJyaWRlcyBgZ2FwYCBpZiBzcGVjaWZpZWQuXG4gICAqXG4gICAqIEBkZWZhdWx0IGdhcFxuICAgKi9cbiAgY29sdW1uR2FwPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBWZXJ0aWNhbCBnYXAgYmV0d2VlbiBncmlkIHJvd3MgaW4gcGl4ZWxzLlxuICAgKiBPdmVycmlkZXMgYGdhcGAgaWYgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBAZGVmYXVsdCBnYXBcbiAgICovXG4gIHJvd0dhcD86IG51bWJlcjtcblxuICAvKipcbiAgICogU2V0IG9mIGFsbG93ZWQgcmVzaXplIGhhbmRsZXMgZm9yIGdyaWQgaXRlbXMuXG4gICAqIFBvc3NpYmxlIHZhbHVlczogYCduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudydgLlxuICAgKlxuICAgKiBAZGVmYXVsdCBuZXcgU2V0KFsnZScsICdzZScsICdzJywgJ3N3JywgJ3cnXSlcbiAgICovXG4gIHJlc2l6ZUhhbmRsZXM/OiBTZXQ8UmVzaXplSGFuZGxlPjtcblxuICAvKipcbiAgICogUGl4ZWwgdGhyZXNob2xkIGZvciBkZXRlY3RpbmcgYSByZXNpemUgYWN0aW9uXG4gICAqIHdoZW4gcG9pbnRlciBpcyBuZWFyIGFuIGl0ZW0ncyBlZGdlLlxuICAgKlxuICAgKiBAZGVmYXVsdCAxMFxuICAgKi9cbiAgcmVzaXplVGhyZXNob2xkPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBNaW5pbXVtIHBvaW50ZXIgbW92ZW1lbnQgaW4gcGl4ZWxzIGJlZm9yZSBhIGRyYWdcbiAgICogaXMgcmVjb2duaXplZCBhcyBpbnRlbnRpb25hbC5cbiAgICpcbiAgICogSGVscHMgcHJldmVudCBhY2NpZGVudGFsIGRyYWdzLlxuICAgKlxuICAgKiBAZGVmYXVsdCA1XG4gICAqL1xuICBkcmFnVGhyZXNob2xkPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0cmlnZ2VyZWQgd2hlbiB0aGUgbGF5b3V0IGNoYW5nZXNcbiAgICogKGUuZy4gYWZ0ZXIgZHJhZy9yZXNpemUgb3IgZXh0ZXJuYWwgdXBkYXRlKS5cbiAgICovXG4gIG9uTGF5b3V0Q2hhbmdlPzogKGxheW91dDogR3JpZExheW91dEl0ZW1bXSkgPT4gdm9pZDtcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdHJpZ2dlcmVkIHdoZW4gdGhlIHNlbGVjdGlvbiBjaGFuZ2VzXG4gICAqIChlLmcuIHVzZXIgY2xpY2tzIG9yIHRvZ2dsZXMgaXRlbSBzZWxlY3Rpb24pLlxuICAgKi9cbiAgb25TZWxlY3Rpb25DaGFuZ2U/OiAoc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikgPT4gdm9pZDtcblxuICAvKipcbiAgICogSXMgdGhlIGxheW91dCBlZGl0YWJsZT9cbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZWRpdGFibGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdyaWRMYXlvdXRJdGVtIHtcbiAgaTogc3RyaW5nO1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdzogbnVtYmVyO1xuICBoOiBudW1iZXI7XG4gIG1pblc/OiBudW1iZXI7XG4gIG1pbkg/OiBudW1iZXI7XG4gIG1heFc/OiBudW1iZXI7XG4gIG1heEg/OiBudW1iZXI7XG4gIHN0YXRpYz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFJlc2l6ZUhhbmRsZSA9ICduJyB8ICdlJyB8ICdzJyB8ICd3JyB8ICduZScgfCAnc2UnIHwgJ3N3JyB8ICdudyc7XG5cbmV4cG9ydCBjbGFzcyBHcmlkTGF5b3V0IHtcbiAgcHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByb3RlY3RlZCBjb25maWc6IEdyaWRMYXlvdXRDb25maWc7XG4gIHByb3RlY3RlZCBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10gPSBbXTtcbiAgcHJvdGVjdGVkIHRlbXBvcmFyeUl0ZW1zPzogR3JpZExheW91dEl0ZW1bXTtcblxuICBwcm90ZWN0ZWQgc2VsZWN0aW9uID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIHByb3RlY3RlZCByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGU7XG5cbiAgcHJvdGVjdGVkIGRyYWdnaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBkcmFnS2V5Pzogc3RyaW5nO1xuICBwcm90ZWN0ZWQgZHJhZ1N0YXJ0VGltZSA9IDA7XG4gIHByb3RlY3RlZCBkcmFnU3RhcnRYID0gMDtcbiAgcHJvdGVjdGVkIGRyYWdTdGFydFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ0VuZFkgPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1ggPSAwO1xuICBwcm90ZWN0ZWQgZHJhZ1kgPSAwO1xuICBwcm90ZWN0ZWQgcHJldmVudENsaWNrID0gZmFsc2U7XG5cbiAgcHJvdGVjdGVkIHJlc2l6ZU9ic2VydmVyOiBSZXNpemVPYnNlcnZlcjtcblxuICBwcm90ZWN0ZWQgcmVuZGVyUmVxdWVzdGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBsYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gIHByb3RlY3RlZCBzZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG4gIHByb3RlY3RlZCBkcmFnTmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gIHByb3RlY3RlZCBfaGFuZGxlQ2xpY2sgPSB0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlckRvd24gPSB0aGlzLmhhbmRsZVBvaW50ZXJEb3duLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlck1vdmUgPSB0aGlzLmhhbmRsZVBvaW50ZXJNb3ZlLmJpbmQodGhpcyk7XG4gIHByb3RlY3RlZCBfaGFuZGxlUG9pbnRlclVwID0gdGhpcy5oYW5kbGVQb2ludGVyVXAuYmluZCh0aGlzKTtcbiAgcHJvdGVjdGVkIF9oYW5kbGVLZXlVcCA9IHRoaXMuaGFuZGxlS2V5VXAuYmluZCh0aGlzKTtcblxuICBwcm90ZWN0ZWQgZm4gPSB0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBHcmlkTGF5b3V0O1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlciA9IG5ldyBSZXNpemVPYnNlcnZlcigoKSA9PiB7XG4gICAgICB0aGlzLmxheW91dE5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICAgIH0pO1xuICAgIHRoaXMucmVzaXplT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLmNvbnRhaW5lcik7XG5cbiAgICB0aGlzLmNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHRoaXMuX2hhbmRsZVBvaW50ZXJEb3duKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCB0aGlzLl9oYW5kbGVQb2ludGVyTW92ZSwge1xuICAgICAgcGFzc2l2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcnVwJywgdGhpcy5faGFuZGxlUG9pbnRlclVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLl9oYW5kbGVDbGljaywgdHJ1ZSk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5faGFuZGxlS2V5VXApO1xuICB9XG5cbiAgc2V0Q29uZmlnKGNvbmZpZzogR3JpZExheW91dENvbmZpZykge1xuICAgIGlmICh0aGlzLmNvbmZpZyA9PT0gY29uZmlnKSByZXR1cm47XG5cbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KHRoaXMubGF5b3V0LCB0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5kcmFnTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuICB9XG5cbiAgc2V0TGF5b3V0KGxheW91dDogR3JpZExheW91dEl0ZW1bXSkge1xuICAgIGlmICh0aGlzLmxheW91dCA9PT0gbGF5b3V0KSByZXR1cm47XG5cbiAgICB0aGlzLmxheW91dCA9IHRoaXMuZm4ucmVwYWlyTGF5b3V0KGxheW91dCwgdGhpcy5jb25maWcpO1xuICAgIHRoaXMuY29uZmlnLm9uTGF5b3V0Q2hhbmdlPy4odGhpcy5sYXlvdXQpO1xuXG4gICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBzZXRTZWxlY3Rpb24oc2VsZWN0aW9uOiBJdGVyYWJsZTxzdHJpbmc+KSB7XG4gICAgaWYgKHNlbGVjdGlvbiA9PT0gdGhpcy5zZWxlY3Rpb24pIHJldHVybjtcblxuICAgIHRoaXMuc2VsZWN0aW9uID0gbmV3IFNldChzZWxlY3Rpb24pO1xuICAgIHRoaXMuY29uZmlnLm9uU2VsZWN0aW9uQ2hhbmdlPy4odGhpcy5zZWxlY3Rpb24pO1xuXG4gICAgdGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICB0b2dnbGVTZWxlY3Rpb24oa2V5OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5zZWxlY3Rpb24uaGFzKGtleSkpIHtcbiAgICAgIHRoaXMuc2VsZWN0aW9uLmRlbGV0ZShrZXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbGVjdGlvbi5hZGQoa2V5KTtcbiAgICB9XG5cbiAgICB0aGlzLnNlbGVjdGlvbk5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICB0aGlzLnJlcXVlc3RSZW5kZXIoKTtcbiAgfVxuXG4gIGNsZWFyU2VsZWN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNlbGVjdGlvbi5zaXplID4gMCkge1xuICAgICAgdGhpcy5zZWxlY3Rpb24uY2xlYXIoKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gICAgfVxuICB9XG5cbiAgLy9cblxuICByZXF1ZXN0UmVuZGVyKCkge1xuICAgIGlmICghdGhpcy5yZW5kZXJSZXF1ZXN0ZWQpIHtcbiAgICAgIHRoaXMucmVuZGVyUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB0aGlzLnJlbmRlcigpKTtcbiAgICB9XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5yZW5kZXJSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLmxheW91dE5lZWRzVXBkYXRlKSB7XG4gICAgICB0aGlzLmZuLnJlbmRlckxheW91dChcbiAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgIHRoaXMudGVtcG9yYXJ5SXRlbXMgPz8gdGhpcy5sYXlvdXQsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgKTtcbiAgICAgIHRoaXMubGF5b3V0TmVlZHNVcGRhdGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zZWxlY3Rpb25OZWVkc1VwZGF0ZSkge1xuICAgICAgdGhpcy5mbi5yZW5kZXJTZWxlY3Rpb24odGhpcy5jb250YWluZXIsIHRoaXMuc2VsZWN0aW9uKTtcbiAgICAgIHRoaXMuc2VsZWN0aW9uTmVlZHNVcGRhdGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5kcmFnTmVlZHNVcGRhdGUpIHtcbiAgICAgIHRoaXMuZm4ucmVuZGVyRHJhZyh0aGlzLmNvbnRhaW5lciwgdGhpcy5kcmFnZ2luZywgdGhpcy5yZXNpemVIYW5kbGUpO1xuICAgICAgdGhpcy5kcmFnTmVlZHNVcGRhdGUgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvL1xuXG4gIHByb3RlY3RlZCBoYW5kbGVQb2ludGVyRG93bihlOiBQb2ludGVyRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHJldHVybjtcbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ21vdXNlJyAmJiBlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZWxlbWVudCA9XG4gICAgICBlLnRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnRcbiAgICAgICAgPyBlLnRhcmdldC5jbG9zZXN0PEhUTUxFbGVtZW50PignLmZhc3QtZ3JpZC1sYXlvdXQgPiAuaXRlbScpXG4gICAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKCFlbGVtZW50KSByZXR1cm47XG5cbiAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHRoaXMuZm4uY2hlY2tSZXNpemVIYW5kbGUoXG4gICAgICBlbGVtZW50LFxuICAgICAgdGhpcy5jb25maWcsXG4gICAgICBlLmNsaWVudFgsXG4gICAgICBlLmNsaWVudFksXG4gICAgKTtcblxuICAgIHRoaXMuZHJhZ0tleSA9IGVsZW1lbnQuZGF0YXNldC5rZXk7XG4gICAgdGhpcy5kcmFnU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLmRyYWdFbmRYID0gdGhpcy5kcmFnU3RhcnRYID0gZS5jbGllbnRYICsgd2luZG93LnNjcm9sbFg7XG4gICAgdGhpcy5kcmFnRW5kWSA9IHRoaXMuZHJhZ1N0YXJ0WSA9IGUuY2xpZW50WSArIHdpbmRvdy5zY3JvbGxZO1xuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZVBvaW50ZXJNb3ZlKGU6IFBvaW50ZXJFdmVudCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIHRoaXMucmVxdWVzdFJlbmRlcigpO1xuXG4gICAgdGhpcy5kcmFnRW5kWCA9IGUuY2xpZW50WCArIHdpbmRvdy5zY3JvbGxYO1xuICAgIHRoaXMuZHJhZ0VuZFkgPSBlLmNsaWVudFkgKyB3aW5kb3cuc2Nyb2xsWTtcbiAgICB0aGlzLmRyYWdOZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgY29uc3QgeyBkeCwgZHkgfSA9IHRoaXMuZm4uY2FsY3VsYXRlRHJhZyhcbiAgICAgICAgdGhpcy5jb250YWluZXIsXG4gICAgICAgIHRoaXMuY29uZmlnLFxuICAgICAgICB0aGlzLmRyYWdTdGFydFgsXG4gICAgICAgIHRoaXMuZHJhZ1N0YXJ0WSxcbiAgICAgICAgdGhpcy5kcmFnRW5kWCxcbiAgICAgICAgdGhpcy5kcmFnRW5kWSxcbiAgICAgICk7XG5cbiAgICAgIGlmIChkeCAhPT0gdGhpcy5kcmFnWCB8fCBkeSAhPT0gdGhpcy5kcmFnWSkge1xuICAgICAgICB0aGlzLmRyYWdYID0gZHg7XG4gICAgICAgIHRoaXMuZHJhZ1kgPSBkeTtcblxuICAgICAgICB0aGlzLnRlbXBvcmFyeUl0ZW1zID0gdGhpcy5mbi5kcmFnSXRlbXMoXG4gICAgICAgICAgdGhpcy5sYXlvdXQsXG4gICAgICAgICAgdGhpcy5jb25maWcsXG4gICAgICAgICAgdGhpcy5zZWxlY3Rpb24sXG4gICAgICAgICAgZHgsXG4gICAgICAgICAgZHksXG4gICAgICAgICAgdGhpcy5yZXNpemVIYW5kbGUsXG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5sYXlvdXROZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuZHJhZ0tleSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9XG4gICAgICAgIGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudFxuICAgICAgICAgID8gZS50YXJnZXQuY2xvc2VzdDxIVE1MRWxlbWVudD4oJy5mYXN0LWdyaWQtbGF5b3V0ID4gLml0ZW0nKVxuICAgICAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IGVsZW1lbnRcbiAgICAgICAgPyB0aGlzLmZuLmNoZWNrUmVzaXplSGFuZGxlKGVsZW1lbnQsIHRoaXMuY29uZmlnLCBlLmNsaWVudFgsIGUuY2xpZW50WSlcbiAgICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkZWx0YVggPSB0aGlzLmRyYWdFbmRYIC0gdGhpcy5kcmFnU3RhcnRYO1xuICAgIGNvbnN0IGRlbHRhWSA9IHRoaXMuZHJhZ0VuZFkgLSB0aGlzLmRyYWdTdGFydFk7XG5cbiAgICBjb25zdCB7IGRyYWdUaHJlc2hvbGQgPSB0aGlzLmZuLkRFRkFVTFRfRFJBR19USFJFU0hPTEQgfSA9IHRoaXMuY29uZmlnO1xuXG4gICAgaWYgKGFicyhkZWx0YVgpIDwgZHJhZ1RocmVzaG9sZCAmJiBhYnMoZGVsdGFZKSA8IGRyYWdUaHJlc2hvbGQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBQcmV2ZW50IHVuaW50ZW50aW9uYWwgZHJhZ2dpbmcgb24gdG91Y2ggZGV2aWNlcy5cbiAgICBpZiAoZS5wb2ludGVyVHlwZSA9PT0gJ3RvdWNoJyAmJiBEYXRlLm5vdygpIC0gdGhpcy5kcmFnU3RhcnRUaW1lIDwgNTApIHtcbiAgICAgIHJldHVybiB0aGlzLmNsZWFuVXBBZnRlckRyYWcoKTtcbiAgICB9XG5cbiAgICB0aGlzLmRyYWdnaW5nID0gdHJ1ZTtcblxuICAgIGlmICghdGhpcy5zZWxlY3Rpb24uaGFzKHRoaXMuZHJhZ0tleSkgfHwgdGhpcy5yZXNpemVIYW5kbGUpIHtcbiAgICAgIHRoaXMuc2V0U2VsZWN0aW9uKFt0aGlzLmRyYWdLZXldKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgaGFuZGxlUG9pbnRlclVwKCkge1xuICAgIGlmICh0aGlzLmNvbmZpZy5lZGl0YWJsZSA9PT0gZmFsc2UpIHJldHVybjtcblxuICAgIGlmICh0aGlzLmRyYWdnaW5nICYmIHRoaXMudGVtcG9yYXJ5SXRlbXMpIHtcbiAgICAgIHRoaXMuc2V0TGF5b3V0KHRoaXMudGVtcG9yYXJ5SXRlbXMpO1xuICAgICAgdGhpcy50ZW1wb3JhcnlJdGVtcyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB0aGlzLmNsZWFuVXBBZnRlckRyYWcoKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuY29uZmlnLmVkaXRhYmxlID09PSBmYWxzZSkgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMucHJldmVudENsaWNrKSB7XG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IGZhbHNlO1xuXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFlLmN0cmxLZXkgJiYgIWUubWV0YUtleSkge1xuICAgICAgdGhpcy5jbGVhclNlbGVjdGlvbigpO1xuICAgIH1cblxuICAgIGNvbnN0IGVsZW1lbnQgPVxuICAgICAgZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50XG4gICAgICAgID8gZS50YXJnZXQuY2xvc2VzdDxIVE1MRWxlbWVudD4oJy5mYXN0LWdyaWQtbGF5b3V0ID4gLml0ZW0nKVxuICAgICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGlmIChlbGVtZW50Py5kYXRhc2V0LmtleSkge1xuICAgICAgdGhpcy50b2dnbGVTZWxlY3Rpb24oZWxlbWVudC5kYXRhc2V0LmtleSk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGhhbmRsZUtleVVwKGU6IEtleWJvYXJkRXZlbnQpIHtcbiAgICBpZiAodGhpcy5jb25maWcuZWRpdGFibGUgPT09IGZhbHNlKSByZXR1cm47XG5cbiAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICB0aGlzLmNsZWFuVXBBZnRlckRyYWcoKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgY2xlYW5VcEFmdGVyRHJhZygpIHtcbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgY29uc3Qgc2VsZWN0aW9uID0gKGRvY3VtZW50LmRlZmF1bHRWaWV3IHx8IHdpbmRvdykuZ2V0U2VsZWN0aW9uKCk7XG5cbiAgICAgIGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLnR5cGUgIT09ICdDYXJldCcpIHtcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnByZXZlbnRDbGljayA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuZHJhZ0tleSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlc2l6ZUhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmRyYWdYID0gMDtcbiAgICB0aGlzLmRyYWdZID0gMDtcbiAgICB0aGlzLmRyYWdOZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgdGhpcy5yZXF1ZXN0UmVuZGVyKCk7XG4gIH1cblxuICBkaXNjb25uZWN0KCkge1xuICAgIHRoaXMuY2xlYW5VcEFmdGVyRHJhZygpO1xuICAgIHRoaXMuZm4ucmVuZGVyU2VsZWN0aW9uKHRoaXMuY29udGFpbmVyLCBuZXcgU2V0KCkpO1xuICAgIHRoaXMuZm4ucmVuZGVyRHJhZyh0aGlzLmNvbnRhaW5lciwgZmFsc2UpO1xuXG4gICAgdGhpcy5yZXNpemVPYnNlcnZlci51bm9ic2VydmUodGhpcy5jb250YWluZXIpO1xuXG4gICAgdGhpcy5jb250YWluZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigncG9pbnRlcmRvd24nLCB0aGlzLl9oYW5kbGVQb2ludGVyRG93bik7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgdGhpcy5faGFuZGxlUG9pbnRlck1vdmUpO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCB0aGlzLl9oYW5kbGVQb2ludGVyVXApO1xuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuX2hhbmRsZUNsaWNrLCB0cnVlKTtcbiAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9oYW5kbGVLZXlVcCk7XG4gIH1cblxuICAvL1xuXG4gIHN0YXRpYyBERUZBVUxUX0NPTFVNTlMgPSAxMjtcbiAgc3RhdGljIERFRkFVTFRfUk9XX0hFSUdIVCA9IDMwO1xuICBzdGF0aWMgREVGQVVMVF9HQVAgPSAwO1xuICBzdGF0aWMgREVGQVVMVF9SRVNJWkVfSEFORExFUyA9IG5ldyBTZXQoWydlJywgJ3NlJywgJ3MnLCAnc3cnLCAndyddKTtcbiAgc3RhdGljIERFRkFVTFRfUkVTSVpFX1RIUkVTSE9MRCA9IDEwO1xuICBzdGF0aWMgREVGQVVMVF9EUkFHX1RIUkVTSE9MRCA9IDU7XG5cbiAgc3RhdGljIHJlbmRlckxheW91dChcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGxheW91dDogR3JpZExheW91dEl0ZW1bXSxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIGdhcCA9IHRoaXMuREVGQVVMVF9HQVAsXG4gICAgICBjb2x1bW5HYXAgPSBnYXAsXG4gICAgICByb3dHYXAgPSBnYXAsXG4gICAgICByb3dIZWlnaHQgPSB0aGlzLkRFRkFVTFRfUk9XX0hFSUdIVCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEdyaWRMYXlvdXRJdGVtPigpO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuICAgICAgbWFwLnNldChpdGVtLmksIGl0ZW0pO1xuICAgIH1cblxuICAgIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdmYXN0LWdyaWQtbGF5b3V0Jyk7XG5cbiAgICBjb25zdCBjb250YWluZXJXaWR0aCA9IGNvbnRhaW5lci5vZmZzZXRXaWR0aDtcbiAgICBjb25zdCBjb2x1bW5XaWR0aCA9IChjb250YWluZXJXaWR0aCAtIChjb2x1bW5zIC0gMSkgKiBjb2x1bW5HYXApIC8gY29sdW1ucztcblxuICAgIGxldCBoTWF4ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWVsZW1lbnQuZGF0YXNldC5rZXkpIHtcbiAgICAgICAgZWxlbWVudC5kYXRhc2V0LmtleSA9IGkudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qga2V5ID0gZWxlbWVudC5kYXRhc2V0LmtleTtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtYXAuZ2V0KGtleSk7XG5cbiAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAvLyBUT0RPIHdhcm5pbmc/XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2l0ZW0nKTtcblxuICAgICAgY29uc3QgaCA9IGl0ZW0ueSArIGl0ZW0uaDtcblxuICAgICAgaWYgKGggPiBoTWF4KSB7XG4gICAgICAgIGhNYXggPSBoO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB3aWR0aCA9XG4gICAgICAgIHJvdW5kKGl0ZW0udyAqIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkgLSBjb2x1bW5HYXApICsgJ3B4JztcbiAgICAgIGNvbnN0IGhlaWdodCA9IHJvdW5kKGl0ZW0uaCAqIChyb3dIZWlnaHQgKyByb3dHYXApIC0gcm93R2FwKSArICdweCc7XG4gICAgICBjb25zdCB0cmFuc2Zvcm0gPVxuICAgICAgICAndHJhbnNsYXRlKCcgK1xuICAgICAgICByb3VuZChpdGVtLnggKiAoY29sdW1uV2lkdGggKyBjb2x1bW5HYXApKSArXG4gICAgICAgICdweCwgJyArXG4gICAgICAgIHJvdW5kKGl0ZW0ueSAqIChyb3dIZWlnaHQgKyByb3dHYXApKSArXG4gICAgICAgICdweCknO1xuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS53aWR0aCAhPT0gd2lkdGgpIHtcbiAgICAgICAgZWxlbWVudC5zdHlsZS53aWR0aCA9IHdpZHRoO1xuICAgICAgfVxuXG4gICAgICBpZiAoZWxlbWVudC5zdHlsZS5oZWlnaHQgIT09IGhlaWdodCkge1xuICAgICAgICBlbGVtZW50LnN0eWxlLmhlaWdodCA9IGhlaWdodDtcbiAgICAgIH1cblxuICAgICAgaWYgKGVsZW1lbnQuc3R5bGUudHJhbnNmb3JtICE9PSB0cmFuc2Zvcm0pIHtcbiAgICAgICAgZWxlbWVudC5zdHlsZS50cmFuc2Zvcm0gPSB0cmFuc2Zvcm07XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29udGFpbmVySGVpZ2h0ID0gcm91bmQoaE1heCAqIChyb3dIZWlnaHQgKyByb3dHYXApIC0gcm93R2FwKSArICdweCc7XG5cbiAgICBpZiAoY29udGFpbmVyLnN0eWxlLmhlaWdodCAhPT0gY29udGFpbmVySGVpZ2h0KSB7XG4gICAgICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gY29udGFpbmVySGVpZ2h0O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJTZWxlY3Rpb24oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc2VsZWN0aW9uOiBTZXQ8c3RyaW5nPikge1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5jaGlsZHJlbltpXTtcblxuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBzZWxlY3Rpb24gJiYgZWxlbWVudC5kYXRhc2V0LmtleSkge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG4gICAgICAgICAgJy1zZWxlY3RlZCcsXG4gICAgICAgICAgc2VsZWN0aW9uLmhhcyhlbGVtZW50LmRhdGFzZXQua2V5KSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0aWMgcmVuZGVyRHJhZyhcbiAgICBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuICAgIGRyYWdnaW5nOiBib29sZWFuLFxuICAgIHJlc2l6ZUhhbmRsZT86IFJlc2l6ZUhhbmRsZSxcbiAgKSB7XG4gICAgY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJy1tb3ZpbmcnLCBkcmFnZ2luZyAmJiAhcmVzaXplSGFuZGxlKTtcbiAgICBjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnLXJlc2l6aW5nJywgZHJhZ2dpbmcgJiYgISFyZXNpemVIYW5kbGUpO1xuXG4gICAgY29uc3Qgcm9vdCA9IGNvbnRhaW5lci5vd25lckRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuICAgIHJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnX2hpZGUtc2VsZWN0aW9uJywgZHJhZ2dpbmcpO1xuICAgIHJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnX2N1cnNvcicsICEhcmVzaXplSGFuZGxlKTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuZ2V0UmVzaXplQ3Vyc29yKHJlc2l6ZUhhbmRsZSk7XG5cbiAgICBpZiAocm9vdC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLWZhc3QtZ3JpZC1sYXlvdXQtY3Vyc29yJykgIT09IGN1cnNvcikge1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1mYXN0LWdyaWQtbGF5b3V0LWN1cnNvcicsIGN1cnNvcik7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGNhbGN1bGF0ZURyYWcoXG4gICAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgICBjb25maWc6IEdyaWRMYXlvdXRDb25maWcsXG4gICAgZHJhZ1N0YXJ0WDogbnVtYmVyLFxuICAgIGRyYWdTdGFydFk6IG51bWJlcixcbiAgICBkcmFnRW5kWDogbnVtYmVyLFxuICAgIGRyYWdFbmRZOiBudW1iZXIsXG4gICkge1xuICAgIGNvbnN0IHtcbiAgICAgIGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyxcbiAgICAgIHJvd0hlaWdodCA9IHRoaXMuREVGQVVMVF9ST1dfSEVJR0hULFxuICAgICAgZ2FwID0gdGhpcy5ERUZBVUxUX0dBUCxcbiAgICAgIGNvbHVtbkdhcCA9IGdhcCxcbiAgICAgIHJvd0dhcCA9IGdhcCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgY29udGFpbmVyV2lkdGggPSBjb250YWluZXIub2Zmc2V0V2lkdGg7XG4gICAgY29uc3QgY29sdW1uV2lkdGggPSAoY29udGFpbmVyV2lkdGggLSAoY29sdW1ucyAtIDEpICogY29sdW1uR2FwKSAvIGNvbHVtbnM7XG4gICAgY29uc3QgZHggPSByb3VuZCgoZHJhZ0VuZFggLSBkcmFnU3RhcnRYKSAvIChjb2x1bW5XaWR0aCArIGNvbHVtbkdhcCkpO1xuICAgIGNvbnN0IGR5ID0gcm91bmQoKGRyYWdFbmRZIC0gZHJhZ1N0YXJ0WSkgLyAocm93SGVpZ2h0ICsgcm93R2FwKSk7XG5cbiAgICByZXR1cm4geyBkeCwgZHkgfTtcbiAgfVxuXG4gIHN0YXRpYyBjaGVja1Jlc2l6ZUhhbmRsZShcbiAgICBlbGVtZW50OiBFbGVtZW50LFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBjbGllbnRYOiBudW1iZXIsXG4gICAgY2xpZW50WTogbnVtYmVyLFxuICApOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHtcbiAgICAgIHJlc2l6ZUhhbmRsZXMgPSB0aGlzLkRFRkFVTFRfUkVTSVpFX0hBTkRMRVMsXG4gICAgICByZXNpemVUaHJlc2hvbGQgPSB0aGlzLkRFRkFVTFRfUkVTSVpFX1RIUkVTSE9MRCxcbiAgICB9ID0gY29uZmlnO1xuXG4gICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgbiA9IGNsaWVudFkgLSByZWN0LnRvcCA8IHJlc2l6ZVRocmVzaG9sZDtcbiAgICBjb25zdCBlID0gcmVjdC5yaWdodCAtIGNsaWVudFggPCByZXNpemVUaHJlc2hvbGQ7XG4gICAgY29uc3QgcyA9IHJlY3QuYm90dG9tIC0gY2xpZW50WSA8IHJlc2l6ZVRocmVzaG9sZDtcbiAgICBjb25zdCB3ID0gY2xpZW50WCAtIHJlY3QubGVmdCA8IHJlc2l6ZVRocmVzaG9sZDtcblxuICAgIGxldCByOiBSZXNpemVIYW5kbGUgfCB1bmRlZmluZWQ7XG5cbiAgICBpZiAocykge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgciA9ICdzZSc7XG4gICAgICB9IGVsc2UgaWYgKHcpIHtcbiAgICAgICAgciA9ICdzdyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ3MnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZSkge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgciA9ICduZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodykge1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgciA9ICdudyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByID0gJ3cnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobikge1xuICAgICAgciA9ICduJztcbiAgICB9XG5cbiAgICBpZiAociAmJiByZXNpemVIYW5kbGVzLmhhcyhyKSkge1xuICAgICAgcmV0dXJuIHI7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGdldFJlc2l6ZUN1cnNvcihyZXNpemVIYW5kbGU6IFJlc2l6ZUhhbmRsZSB8IHVuZGVmaW5lZCkge1xuICAgIHN3aXRjaCAocmVzaXplSGFuZGxlKSB7XG4gICAgICBjYXNlICduJzpcbiAgICAgIGNhc2UgJ3MnOlxuICAgICAgICByZXR1cm4gJ25zLXJlc2l6ZSc7XG4gICAgICBjYXNlICdlJzpcbiAgICAgIGNhc2UgJ3cnOlxuICAgICAgICByZXR1cm4gJ2V3LXJlc2l6ZSc7XG4gICAgICBjYXNlICduZSc6XG4gICAgICBjYXNlICdzdyc6XG4gICAgICAgIHJldHVybiAnbmVzdy1yZXNpemUnO1xuICAgICAgY2FzZSAnc2UnOlxuICAgICAgY2FzZSAnbncnOlxuICAgICAgICByZXR1cm4gJ253c2UtcmVzaXplJztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTW92ZSBvciByZXNpemUgc3BlY2lmaWVkIGl0ZW0ocykgKGluIGdyaWQgdW5pdHMpLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiBtb2RpZmllZC5cbiAgICovXG4gIHN0YXRpYyBkcmFnSXRlbXMoXG4gICAgbGF5b3V0OiBHcmlkTGF5b3V0SXRlbVtdLFxuICAgIGNvbmZpZzogR3JpZExheW91dENvbmZpZyxcbiAgICBzZWxlY3Rpb246IFNldDxzdHJpbmc+LFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgICByZXNpemVIYW5kbGU/OiBSZXNpemVIYW5kbGUsXG4gICkge1xuICAgIGlmIChyZXNpemVIYW5kbGUpIHtcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIHNlbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5yZXNpemVJdGVtKGxheW91dCwgY29uZmlnLCBrZXksIHJlc2l6ZUhhbmRsZSwgZHgsIGR5KTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5tb3ZlSXRlbXMobGF5b3V0LCBjb25maWcsIHNlbGVjdGlvbiwgZHgsIGR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNb3ZlcyB0aGUgc3BlY2lmaWVkIGxheW91dCAoaW4gZ3JpZCB1bml0cykuXG4gICAqIFJldHVybnMgYSBuZXcgbGF5b3V0IGlmIG1vZGlmaWVkLlxuICAgKi9cbiAgc3RhdGljIG1vdmVJdGVtcyhcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIHNlbGVjdGlvbjogU2V0PHN0cmluZz4sXG4gICAgZHg6IG51bWJlcixcbiAgICBkeTogbnVtYmVyLFxuICApIHtcbiAgICBpZiAoKGR4ID09PSAwICYmIGR5ID09PSAwKSB8fCBzZWxlY3Rpb24uc2l6ZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGxheW91dDtcbiAgICB9XG5cbiAgICBsZXQgb3V0ID0gbGF5b3V0O1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsYXlvdXQubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICBjb25zdCBpdGVtID0gbGF5b3V0W2ldO1xuXG4gICAgICBpZiAoc2VsZWN0aW9uLmhhcyhpdGVtLmkpKSB7XG4gICAgICAgIGNvbnN0IHggPSBpdGVtLnggKyBkeDtcbiAgICAgICAgY29uc3QgeSA9IGl0ZW0ueSArIGR5O1xuXG4gICAgICAgIGlmIChpdGVtLnggIT09IHggfHwgaXRlbS55ICE9PSB5KSB7XG4gICAgICAgICAgaWYgKG91dCA9PT0gbGF5b3V0KSB7XG4gICAgICAgICAgICAvLyBDb3B5IG9uIHdyaXRlLlxuICAgICAgICAgICAgb3V0ID0gbGF5b3V0LnNsaWNlKDApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIG91dFtpXSA9IHsgLi4uaXRlbSwgeCwgeSB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG91dCA9PT0gbGF5b3V0KSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnJlcGFpckxheW91dChvdXQsIGNvbmZpZywgdGhpcy5jb21wYXJlTWlkcG9pbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2l6ZXMgdGhlIHNwZWNpZmllZCBpdGVtIChpbiBncmlkIHVuaXRzKS5cbiAgICogUmV0dXJucyBhIG5ldyBsYXlvdXQgaWYgbW9kaWZpZWQuXG4gICAqL1xuICBzdGF0aWMgcmVzaXplSXRlbShcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIGtleTogc3RyaW5nLFxuICAgIGhhbmRsZTogUmVzaXplSGFuZGxlLFxuICAgIGR4OiBudW1iZXIsXG4gICAgZHk6IG51bWJlcixcbiAgKSB7XG4gICAgaWYgKGR4ID09PSAwICYmIGR5ID09PSAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGNvbnN0IGluZGV4ID0gbGF5b3V0LmZpbmRJbmRleCgoaXQpID0+IGl0LmkgPT09IGtleSk7XG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICByZXR1cm4gbGF5b3V0O1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW0gPSBsYXlvdXRbaW5kZXhdO1xuXG4gICAgY29uc3QgeyBjb2x1bW5zID0gdGhpcy5ERUZBVUxUX0NPTFVNTlMgfSA9IGNvbmZpZztcbiAgICBjb25zdCB7IG1heFcgPSBjb2x1bW5zLCBtYXhIID0gSW5maW5pdHkgfSA9IGl0ZW07XG4gICAgbGV0IHsgeCwgeSwgdywgaCB9ID0gaXRlbTtcbiAgICBjb25zdCB4dyA9IHggKyB3O1xuICAgIGNvbnN0IHloID0geSArIGg7XG4gICAgY29uc3QgY3ggPSBjb2x1bW5zIC0geDtcblxuICAgIHN3aXRjaCAoaGFuZGxlKSB7XG4gICAgICBjYXNlICduJzpcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZSc6XG4gICAgICAgIHcgPSBjbGFtcCh3ICsgZHgsIDEsIG1pbihtYXhXLCBjeCkpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3MnOlxuICAgICAgICBoID0gY2xhbXAoaCArIGR5LCAxLCBtYXhIKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd3JzpcbiAgICAgICAgdyA9IGNsYW1wKHcgLSBkeCwgMSwgbWluKG1heFcsIHh3KSk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbmUnOlxuICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2UnOlxuICAgICAgICB3ID0gY2xhbXAodyArIGR4LCAxLCBtaW4obWF4VywgY3gpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3cnOlxuICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggKyBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbncnOlxuICAgICAgICB3ID0gY2xhbXAodyAtIGR4LCAxLCBtaW4obWF4VywgeHcpKTtcbiAgICAgICAgaCA9IGNsYW1wKGggLSBkeSwgMSwgbWF4SCk7XG4gICAgICAgIHggPSBjbGFtcCh4ICsgZHgsIDAsIHh3IC0gMSk7XG4gICAgICAgIHkgPSBjbGFtcCh5ICsgZHksIDAsIHloIC0gMSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChpdGVtLnggPT09IHggJiYgaXRlbS55ID09PSB5ICYmIGl0ZW0udyA9PT0gdyAmJiBpdGVtLmggPT09IGgpIHtcbiAgICAgIHJldHVybiBsYXlvdXQ7XG4gICAgfVxuXG4gICAgLy8gQ29weSBvbiB3cml0ZS5cbiAgICBjb25zdCBvdXQgPSBsYXlvdXQuc2xpY2UoMCk7XG4gICAgb3V0W2luZGV4XSA9IHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVwYWlyTGF5b3V0KG91dCwgY29uZmlnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaXhlcyBvdmVybGFwcywgZ2FwcywgYW5kIGxheW91dCBvdXQgb2YgYm91bmRzLlxuICAgKiBSZXR1cm5zIGEgbmV3IGxheW91dCBpZiB0aGVyZSB3YXMgYW55dGhpbmcgdG8gcmVwYWlyLlxuICAgKi9cbiAgc3RhdGljIHJlcGFpckxheW91dChcbiAgICBsYXlvdXQ6IEdyaWRMYXlvdXRJdGVtW10sXG4gICAgY29uZmlnOiBHcmlkTGF5b3V0Q29uZmlnLFxuICAgIGNvbXBhcmUgPSB0aGlzLmNvbXBhcmVUb3BMZWZ0LFxuICApIHtcbiAgICBjb25zdCB7IGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyB9ID0gY29uZmlnO1xuXG4gICAgLy8gXCJSaXNpbmcgdGlkZVwiLCBpLmUuIG51bWJlciBvZiBibG9ja2VkIGNlbGxzIHBlciBjb2x1bW4uXG4gICAgY29uc3QgdGlkZTogbnVtYmVyW10gPSBBcnJheShjb2x1bW5zKTtcblxuICAgIGZvciAobGV0IHggPSAwOyB4IDwgY29sdW1uczsgKyt4KSB7XG4gICAgICB0aWRlW3hdID0gMDtcbiAgICB9XG5cbiAgICBjb25zdCBzb3J0ZWRJdGVtcyA9IGxheW91dC5zbGljZSgwKS5zb3J0KGNvbXBhcmUpO1xuICAgIGNvbnN0IHN0YXRpY0l0ZW1zID0gc29ydGVkSXRlbXMuZmlsdGVyKChpdGVtKSA9PiBpdGVtLnN0YXRpYyk7XG4gICAgY29uc3QgbnVtU3RhdGljcyA9IHN0YXRpY0l0ZW1zLmxlbmd0aDtcbiAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcbiAgICBsZXQgc3RhdGljT2Zmc2V0ID0gMDtcblxuICAgIGZvciAobGV0IGkgPSAwLCBsID0gc29ydGVkSXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAvLyBOb3RlIHRoYXQgd2UgYWxsb3cgbGF5b3V0IHRvIGJlIG91dCBvZiBib3VuZHMgZHVyaW5nIHNvcnRpbmcsXG4gICAgICAvLyB3aGljaCAoZm9yIGV4YW1wbGUpIGFsbG93cyBtb3ZpbmcgbGF5b3V0IFwiYmVmb3JlXCIgdGhlIGZpcnN0IGl0ZW0uXG4gICAgICAvLyBXZSBmaXggYW55IG91dCBvZiBib3VuZCBpc3N1ZXMgaGVyZS5cbiAgICAgIGxldCBpdGVtID0gdGhpcy5yZXBhaXJJdGVtKHNvcnRlZEl0ZW1zW2ldLCBjb25maWcpO1xuICAgICAgY29uc3QgeDIgPSBpdGVtLnggKyBpdGVtLnc7XG5cbiAgICAgIGlmIChpdGVtLnN0YXRpYykge1xuICAgICAgICAvLyBUaGlzIHN0YXRpYyBpdGVtIHdpbGwgYmUgcGFydCBvZiB0aGUgdGlkZVxuICAgICAgICAvLyBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBjb25zaWRlcmVkIGZvciBjb2xsaXNpb24gYW55bW9yZS5cbiAgICAgICAgLy8gU2luY2Ugc3RhdGljIGxheW91dCB3aWxsIGJlIHZpc2l0ZWQgaW4gdGhlIHNhbWUgb3JkZXJcbiAgICAgICAgLy8gYXMgdGhlIHN0YXRpY0l0ZW1zIGFycmF5LCB3ZSBjYW4ganVzdCBpbmNyZW1lbnQgdGhlIG9mZnNldCBoZXJlLlxuICAgICAgICArK3N0YXRpY09mZnNldDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIERldGVjdCBzbWFsbGVzdCBnYXAvbGFyZ2VzdCBvdmVybGFwIHdpdGggdGlkZS5cbiAgICAgICAgbGV0IG1pbkdhcCA9IEluZmluaXR5O1xuXG4gICAgICAgIGZvciAobGV0IHggPSBpdGVtLng7IHggPCB4MjsgKyt4KSB7XG4gICAgICAgICAgY29uc3QgZ2FwID0gaXRlbS55IC0gdGlkZVt4XTtcblxuICAgICAgICAgIGlmIChnYXAgPCBtaW5HYXApIHtcbiAgICAgICAgICAgIG1pbkdhcCA9IGdhcDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXggc21hbGxlc3QgZ2FwL2xhcmdlc3Qgb3ZlcmxhcC5cbiAgICAgICAgbGV0IHlOZXh0ID0gaXRlbS55IC0gbWluR2FwO1xuXG4gICAgICAgIC8vIEhhbmRsZSBjb2xsaXNpb24gd2l0aCBzdGF0aWMgbGF5b3V0LlxuICAgICAgICBmb3IgKGxldCBqID0gc3RhdGljT2Zmc2V0OyBqIDwgbnVtU3RhdGljczsgKytqKSB7XG4gICAgICAgICAgY29uc3Qgc3RhdGljSXRlbSA9IHN0YXRpY0l0ZW1zW2pdO1xuXG4gICAgICAgICAgaWYgKHN0YXRpY0l0ZW0ueSA+PSB5TmV4dCArIGl0ZW0uaCkge1xuICAgICAgICAgICAgLy8gRm9sbG93aW5nIHN0YXRpYyBsYXlvdXQgY2Fubm90IGNvbGxpZGUgYmVjYXVzZSBvZiBzb3J0aW5nOyBzdG9wLlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgLy9zdGF0aWNJdGVtLnkgPCB5TmV4dCArIGl0ZW0uaCAmJiAvLyBUaGlzIGlzIGltcGxpZWQgYWJvdmUuXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnkgKyBzdGF0aWNJdGVtLmggPiB5TmV4dCAmJlxuICAgICAgICAgICAgc3RhdGljSXRlbS54IDwgaXRlbS54ICsgaXRlbS53ICYmXG4gICAgICAgICAgICBzdGF0aWNJdGVtLnggKyBzdGF0aWNJdGVtLncgPiBpdGVtLnhcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIENvbGxpc2lvbiBkZXRlY3RlZDsgbW92ZSBjdXJyZW50IGl0ZW0gYmVsb3cgc3RhdGljIGl0ZW0uXG4gICAgICAgICAgICB5TmV4dCA9IHN0YXRpY0l0ZW0ueSArIHN0YXRpY0l0ZW0uaDtcblxuICAgICAgICAgICAgLy8gQ3VycmVudCBpdGVtIHdhcyBtb3ZlZDtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gcmVjaGVjayBjb2xsaXNpb24gd2l0aCBvdGhlciBzdGF0aWMgbGF5b3V0LlxuICAgICAgICAgICAgaiA9IHN0YXRpY09mZnNldDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbS55ICE9PSB5TmV4dCkge1xuICAgICAgICAgIGl0ZW0gPSB7IC4uLml0ZW0sIHk6IHlOZXh0IH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXRlbSAhPT0gc29ydGVkSXRlbXNbaV0pIHtcbiAgICAgICAgICBzb3J0ZWRJdGVtc1tpXSA9IGl0ZW07XG4gICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0aWRlLlxuICAgICAgY29uc3QgdCA9IGl0ZW0ueSArIGl0ZW0uaDtcblxuICAgICAgZm9yIChsZXQgeCA9IGl0ZW0ueDsgeCA8IHgyOyArK3gpIHtcbiAgICAgICAgaWYgKHRpZGVbeF0gPCB0KSB7XG4gICAgICAgICAgdGlkZVt4XSA9IHQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZWQgPyBzb3J0ZWRJdGVtcyA6IGxheW91dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXBhaXIgYm91bmRzIG9mIHRoZSBnaXZlbiBncmlkIGxheW91dCBpdGVtIHRvIGZpdCB0aGUgZ2l2ZW4gY29uZmlnLlxuICAgKiBSZXR1cm5zIGEgbmV3IGl0ZW0gaWYgdGhlcmUgd2FzIGFueXRoaW5nIHRvIHJlcGFpci5cbiAgICovXG4gIHN0YXRpYyByZXBhaXJJdGVtKGl0ZW06IEdyaWRMYXlvdXRJdGVtLCBjb25maWc6IEdyaWRMYXlvdXRDb25maWcpIHtcbiAgICBjb25zdCB7IGNvbHVtbnMgPSB0aGlzLkRFRkFVTFRfQ09MVU1OUyB9ID0gY29uZmlnO1xuICAgIGNvbnN0IHsgbWluVyA9IDEsIG1heFcgPSBjb2x1bW5zLCBtaW5IID0gMSwgbWF4SCA9IEluZmluaXR5IH0gPSBpdGVtO1xuICAgIGxldCB7IHgsIHksIHcsIGggfSA9IGl0ZW07XG5cbiAgICB3ID0gY2xhbXAodywgbWluVywgbWluKG1heFcsIGNvbHVtbnMpKTtcbiAgICBoID0gY2xhbXAoaCwgbWluSCwgbWF4SCk7XG4gICAgeCA9IGNsYW1wKHgsIDAsIGNvbHVtbnMgLSB3KTtcbiAgICBpZiAoeSA8IDApIHkgPSAwO1xuXG4gICAgaWYgKGl0ZW0ueCA9PT0geCAmJiBpdGVtLnkgPT09IHkgJiYgaXRlbS53ID09PSB3ICYmIGl0ZW0uaCA9PT0gaCkge1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgLi4uaXRlbSwgeCwgeSwgdywgaCB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBhcmUgbGF5b3V0IGJ5IG1pZHBvaW50IChyb3ctZmlyc3QpLlxuICAgKi9cbiAgc3RhdGljIGNvbXBhcmVNaWRwb2ludChhOiBHcmlkTGF5b3V0SXRlbSwgYjogR3JpZExheW91dEl0ZW0pIHtcbiAgICAvLyBDb21wYXJlIGJ5IG1pZHBvaW50XG4gICAgY29uc3QgYXUgPSBhLnggKyBhLncgLyAyO1xuICAgIGNvbnN0IGF2ID0gYS55ICsgYS5oIC8gMjtcbiAgICBjb25zdCBidSA9IGIueCArIGIudyAvIDI7XG4gICAgY29uc3QgYnYgPSBiLnkgKyBiLmggLyAyO1xuXG4gICAgaWYgKGF2IDwgYnYpIHJldHVybiAtMTtcbiAgICBpZiAoYXYgPiBidikgcmV0dXJuIDE7XG4gICAgaWYgKGF1IDwgYnUpIHJldHVybiAtMTtcbiAgICBpZiAoYXUgPiBidSkgcmV0dXJuIDE7XG5cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb21wYXJlIGJ5IHRvcCBsZWZ0IGNvcm5lciAocm93LWZpcnN0KS5cbiAgICovXG4gIHN0YXRpYyBjb21wYXJlVG9wTGVmdChhOiBHcmlkTGF5b3V0SXRlbSwgYjogR3JpZExheW91dEl0ZW0pIHtcbiAgICBpZiAoYS55IDwgYi55KSByZXR1cm4gLTE7XG4gICAgaWYgKGEueSA+IGIueSkgcmV0dXJuIDE7XG4gICAgaWYgKGEueCA8IGIueCkgcmV0dXJuIC0xO1xuICAgIGlmIChhLnggPiBiLngpIHJldHVybiAxO1xuXG4gICAgcmV0dXJuIDA7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG4gIGlmICh2YWx1ZSA8IG1pbikgcmV0dXJuIG1pbjtcbiAgaWYgKHZhbHVlID4gbWF4KSByZXR1cm4gbWF4O1xuICByZXR1cm4gdmFsdWU7XG59XG5cbmNvbnN0IGFicyA9IE1hdGguYWJzO1xuY29uc3QgbWluID0gTWF0aC5taW47XG5jb25zdCByb3VuZCA9IE1hdGgucm91bmQ7XG4iXX0=