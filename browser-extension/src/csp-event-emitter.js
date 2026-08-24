// SPDX-License-Identifier: MIT

/**
 * CSP-safe subset of tseep's EventEmitter API used by NDK.
 *
 * tseep optimizes multi-listener dispatch by compiling functions with eval().
 * Page-world extension components cannot do that on hosts with a strict CSP,
 * including YouTube. A small loop-based emitter keeps the same public API
 * without dynamic code generation.
 */
export class EventEmitter {
  constructor() {
    this.events = new Map();
    this.boundFuncs = new Map();
    this.maxListeners = Infinity;
  }

  get _eventsCount() {
    return this.events.size;
  }

  emit(event, ...args) {
    const entries = this.events.get(event);
    if (!entries || entries.length === 0) return false;

    for (const entry of entries.slice()) {
      if (entry.once) this.removeEntry(event, entry);
      Reflect.apply(entry.listener, undefined, args);
    }
    return true;
  }

  on(event, listener) {
    return this.addListener(event, listener);
  }

  addListener(event, listener) {
    return this.addEntry(event, listener, false, false);
  }

  once(event, listener) {
    return this.addEntry(event, listener, true, false);
  }

  prependListener(event, listener) {
    return this.addEntry(event, listener, false, true);
  }

  prependOnceListener(event, listener) {
    return this.addEntry(event, listener, true, true);
  }

  addListenerBound(event, listener, bindTo = this) {
    const bound = listener.bind(bindTo);
    this.boundFuncs.set(listener, bound);
    return this.addListener(event, bound);
  }

  removeListenerBound(event, listener) {
    const bound = this.boundFuncs.get(listener);
    this.boundFuncs.delete(listener);
    return bound ? this.removeListener(event, bound) : this;
  }

  off(event, listener) {
    return this.removeListener(event, listener);
  }

  removeListener(event, listener) {
    const entries = this.events.get(event);
    if (!entries) return this;

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].listener === listener) {
        entries.splice(index, 1);
        break;
      }
    }
    if (entries.length === 0) this.events.delete(event);
    return this;
  }

  removeAllListeners(event) {
    if (event === undefined) {
      this.events.clear();
      this.boundFuncs.clear();
    } else {
      this.events.delete(event);
    }
    return this;
  }

  setMaxListeners(count) {
    this.maxListeners = count;
    return this;
  }

  getMaxListeners() {
    return this.maxListeners;
  }

  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  listeners(event) {
    return (this.events.get(event) || []).map(function (entry) {
      return entry.listener;
    });
  }

  rawListeners(event) {
    return this.listeners(event);
  }

  eventNames() {
    return Array.from(this.events.keys());
  }

  listenerCount(event) {
    return this.events.get(event)?.length || 0;
  }

  addEntry(event, listener, once, prepend) {
    if (typeof listener !== 'function') {
      throw new TypeError('The listener must be a function');
    }

    const entries = this.events.get(event) || [];
    const entry = { listener: listener, once: once };
    if (prepend) entries.unshift(entry);
    else entries.push(entry);
    this.events.set(event, entries);

    if (this.maxListeners !== Infinity && entries.length >= this.maxListeners) {
      console.warn('Maximum event listeners for "' + String(event) + '" event!');
    }
    return this;
  }

  removeEntry(event, entry) {
    const entries = this.events.get(event);
    if (!entries) return;
    const index = entries.indexOf(entry);
    if (index !== -1) entries.splice(index, 1);
    if (entries.length === 0) this.events.delete(event);
  }
}
