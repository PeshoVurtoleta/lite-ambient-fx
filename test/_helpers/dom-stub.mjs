// test/_helpers/dom-stub.mjs
// Minimal DOM shim so lite-ambient-fx's DOM-touching paths run under `node --test`.
// The stubs expose introspection helpers (`_listenerCount`, `_observerCount`, etc.)
// so leak tests can compare a baseline to a post-destroy snapshot.
//
// NOT jsdom. Zero deps, pure ESM, install once per test file.

class EventTargetStub {
    constructor() {
        // Keyed by event type; each entry is a Set of listener fns.
        this._listeners = new Map();
    }
    addEventListener(type, fn) {
        if (typeof fn !== 'function') return;
        let s = this._listeners.get(type);
        if (!s) { s = new Set(); this._listeners.set(type, s); }
        s.add(fn);
    }
    removeEventListener(type, fn) {
        const s = this._listeners.get(type);
        if (s) s.delete(fn);
    }
    dispatchEvent(event) {
        const s = this._listeners.get(event.type);
        if (s) for (const fn of s) fn(event);
        return true;
    }
    _listenerCount(type) {
        if (type === undefined) {
            let n = 0;
            for (const s of this._listeners.values()) n += s.size;
            return n;
        }
        const s = this._listeners.get(type);
        return s ? s.size : 0;
    }
}

class CanvasRenderingContext2DStub {
    constructor() {
        this.globalAlpha = 1;
        this.fillStyle = '#000';
        this.strokeStyle = '#000';
        this.lineWidth = 1;
        this._drawCallCount = 0;
    }
    clearRect() {}
    fillRect() {}
    strokeRect() {}
    drawImage() { this._drawCallCount++; }
    setTransform() {}
    resetTransform() {}
    transform() {}
    beginPath() {}
    closePath() {}
    arc() {}
    fill() {}
    stroke() {}
    save() {}
    restore() {}
    translate() {}
    scale() {}
    rotate() {}
    createRadialGradient() { return { addColorStop() {} }; }
    createLinearGradient() { return { addColorStop() {} }; }
    getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; }
    putImageData() {}
}

class HTMLCanvasElementStub extends EventTargetStub {
    constructor(w = 400, h = 300) {
        super();
        this.width = w;
        this.height = h;
        this.style = {};
        this._transferred = false;
    }
    getContext() { return new CanvasRenderingContext2DStub(); }
    getBoundingClientRect() {
        return { top: 0, left: 0, right: this.width, bottom: this.height,
                 width: this.width, height: this.height, x: 0, y: 0 };
    }
    transferControlToOffscreen() {
        this._transferred = true;
        return new OffscreenCanvasStub(this.width, this.height);
    }
    toDataURL() { return 'data:,'; }
}

class OffscreenCanvasStub {
    constructor(w = 0, h = 0) { this.width = w; this.height = h; }
    getContext() { return new CanvasRenderingContext2DStub(); }
    transferToImageBitmap() { return {}; }
    convertToBlob() { return Promise.resolve({}); }
}

// The pool of live ResizeObserver / MutationObserver / IntersectionObserver
// instances. lite-leak's observer kernel patches the constructors and hooks
// disconnect, but the stub also exposes a count for direct assertion.
const _observerRegistry = new Set();

class ResizeObserverStub {
    constructor(cb) {
        this._cb = cb;
        this._targets = new Set();
        this._disconnected = false;
        _observerRegistry.add(this);
    }
    observe(el) { this._targets.add(el); }
    unobserve(el) { this._targets.delete(el); }
    disconnect() {
        this._targets.clear();
        this._disconnected = true;
        _observerRegistry.delete(this);
    }
}

class MutationObserverStub {
    constructor(cb) {
        this._cb = cb;
        this._disconnected = false;
        _observerRegistry.add(this);
    }
    observe() {}
    disconnect() {
        this._disconnected = true;
        _observerRegistry.delete(this);
    }
    takeRecords() { return []; }
}

class IntersectionObserverStub {
    constructor(cb) {
        this._cb = cb;
        this._disconnected = false;
        _observerRegistry.add(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {
        this._disconnected = true;
        _observerRegistry.delete(this);
    }
}

class MediaQueryListStub extends EventTargetStub {
    constructor(query) {
        super();
        this.media = query;
        this.matches = false;
        this.onchange = null;
    }
}

let _rafId = 0;
const _rafPending = new Map();

function installDomStubs() {
    globalThis.EventTarget          = EventTargetStub;
    globalThis.HTMLCanvasElement    = HTMLCanvasElementStub;
    globalThis.OffscreenCanvas      = OffscreenCanvasStub;
    globalThis.ResizeObserver       = ResizeObserverStub;
    globalThis.MutationObserver     = MutationObserverStub;
    globalThis.IntersectionObserver = IntersectionObserverStub;

    if (!globalThis.performance) {
        globalThis.performance = { now: () => Number(process.hrtime.bigint() / 1000000n) };
    }

    // rAF/cAF: setTimeout-backed so lite-leak's timer kernel sees the underlying
    // setTimeout AND the rAF patch it installs. Ambient-fx should always cancel.
    globalThis.requestAnimationFrame = (cb) => {
        const id = ++_rafId;
        const t = setTimeout(() => { _rafPending.delete(id); cb(performance.now()); }, 16);
        _rafPending.set(id, t);
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        const t = _rafPending.get(id);
        if (t !== undefined) { clearTimeout(t); _rafPending.delete(id); }
    };

    globalThis.matchMedia = (q) => new MediaQueryListStub(q);

    if (!globalThis.window) {
        // window MUST be an actual EventTargetStub instance (not globalThis
        // with bound methods) so lite-leak's listener kernel patch of
        // `EventTarget.prototype.addEventListener` intercepts calls made via
        // `window.addEventListener(...)`.
        const win = new EventTargetStub();
        win.devicePixelRatio = 1;
        win.innerWidth = 1024;
        win.innerHeight = 768;
        globalThis.window = win;
    }
    if (!globalThis.document) {
        const doc = new EventTargetStub();
        doc.hidden = false;
        doc.visibilityState = 'visible';
        doc.body = new HTMLCanvasElementStub();
        doc.createElement = (tag) => {
            if (tag === 'canvas') return new HTMLCanvasElementStub();
            const el = new EventTargetStub();
            el.tagName = String(tag).toUpperCase();
            el.style = {};
            return el;
        };
        globalThis.document = doc;
    }
}

function makeCanvas(w, h) { return new HTMLCanvasElementStub(w, h); }

function domSnapshot() {
    return {
        observers:     _observerRegistry.size,
        rafPending:    _rafPending.size,
        winListeners:  globalThis.window && globalThis.window._listenerCount
            ? globalThis.window._listenerCount()
            : 0,
        docListeners:  globalThis.document && globalThis.document._listenerCount
            ? globalThis.document._listenerCount()
            : 0,
    };
}

function resetDomState() {
    _observerRegistry.clear();
    for (const t of _rafPending.values()) clearTimeout(t);
    _rafPending.clear();
    _rafId = 0;
}

export {
    installDomStubs,
    makeCanvas,
    domSnapshot,
    resetDomState,
    EventTargetStub,
    HTMLCanvasElementStub,
    ResizeObserverStub,
};
