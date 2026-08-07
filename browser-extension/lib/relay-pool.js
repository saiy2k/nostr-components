// SPDX-License-Identifier: MIT

(function () {
  const extension = (globalThis.NostrLikeExtension =
    globalThis.NostrLikeExtension || {});
  const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://nostr.wine",
    "wss://relay.nostr.net",
    "wss://relay.nostr.band",
    "wss://nos.lol",
    "wss://nostr-pub.wellorder.net",
    "wss://relay.getalby.com",
    "wss://relay.primal.net",
  ];

  class RelayPool {
    /** Create a relay manager that multiplexes all post activity over shared sockets. */
    constructor(relayUrls, options) {
      const config = options || {};
      this.relayUrls = [...new Set(relayUrls || [])];
      this.WebSocketCtor = config.WebSocketCtor || globalThis.WebSocket;
      this.connectionTimeoutMs = config.connectionTimeoutMs || 3000;
      this.queryTimeoutMs = config.queryTimeoutMs || 2200;
      this.publishTimeoutMs = config.publishTimeoutMs || 2200;
      this.connections = new Map();
      this.subscriptions = new Map();
      this.publishes = new Map();
      this.sequence = 0;
    }

    /** Return the injected WebSocket implementation's OPEN state value. */
    openState() {
      return this.WebSocketCtor.OPEN === undefined
        ? 1
        : this.WebSocketCtor.OPEN;
    }

    /** Reuse or establish one connection for a configured relay URL. */
    async connect(relayUrl) {
      const current = this.connections.get(relayUrl);
      if (current && current.ws && current.ws.readyState === this.openState()) {
        return current;
      }
      if (current && current.promise) {
        return current.promise;
      }

      const state = { relayUrl: relayUrl, ws: null, promise: null };
      state.promise = new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = null;
        let ws;

        try {
          ws = new this.WebSocketCtor(relayUrl);
        } catch (error) {
          this.connections.delete(relayUrl);
          reject(error);
          return;
        }

        state.ws = ws;

        const failConnect = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          state.promise = null;
          this.connections.delete(relayUrl);
          reject(
            error instanceof Error
              ? error
              : new Error("Relay connection failed"),
          );
        };

        ws.addEventListener("open", () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          state.promise = null;
          resolve(state);
        });

        ws.addEventListener("message", (event) => {
          this.handleMessage(state, event.data);
        });

        ws.addEventListener("error", () => {
          failConnect(new Error("Failed to connect to " + relayUrl));
        });

        ws.addEventListener("close", () => {
          if (this.connections.get(relayUrl) === state) {
            this.connections.delete(relayUrl);
          }
          failConnect(new Error("Relay closed before connecting: " + relayUrl));
        });

        timeoutId = setTimeout(function () {
          failConnect(new Error("Timed out connecting to " + relayUrl));
          try {
            ws.close();
          } catch (_error) {
            // Best-effort cleanup.
          }
        }, this.connectionTimeoutMs);
      });

      this.connections.set(relayUrl, state);
      return state.promise;
    }

    /** Resolve every currently reachable configured relay connection. */
    async connectedStates() {
      const results = await Promise.allSettled(
        this.relayUrls.map((relayUrl) => this.connect(relayUrl)),
      );
      return results
        .filter(function (result) {
          return result.status === "fulfilled";
        })
        .map(function (result) {
          return result.value;
        });
    }

    /** Run a multiplexed Nostr subscription and collect de-duplicated events. */
    async query(filter) {
      const states = await this.connectedStates();
      if (states.length === 0) {
        return [];
      }

      const subscriptionId = "nostr-like-" + Date.now() + "-" + ++this.sequence;

      return new Promise((resolve) => {
        const record = {
          events: new Map(),
          expectedRelays: new Set(states.map((state) => state.relayUrl)),
          completedRelays: new Set(),
          settled: false,
          timeoutId: null,
          settle: null,
        };

        record.settle = () => {
          if (record.settled) {
            return;
          }
          record.settled = true;
          clearTimeout(record.timeoutId);
          this.subscriptions.delete(subscriptionId);

          for (const state of states) {
            if (state.ws.readyState !== this.openState()) {
              continue;
            }
            try {
              state.ws.send(JSON.stringify(["CLOSE", subscriptionId]));
            } catch (_error) {
              // The shared connection will be recreated on its next use.
            }
          }

          resolve(Array.from(record.events.values()));
        };

        this.subscriptions.set(subscriptionId, record);
        record.timeoutId = setTimeout(record.settle, this.queryTimeoutMs);

        for (const state of states) {
          try {
            state.ws.send(JSON.stringify(["REQ", subscriptionId, filter]));
          } catch (_error) {
            record.expectedRelays.delete(state.relayUrl);
          }
        }

        if (record.expectedRelays.size === 0) {
          record.settle();
        }
      });
    }

    /** Publish an event and require at least one explicit relay OK response. */
    async publish(event) {
      const states = await this.connectedStates();
      if (states.length === 0) {
        return { ok: false, openCount: 0, okCount: 0, explicitFailureCount: 0 };
      }

      return new Promise((resolve) => {
        const record = {
          acceptedRelays: new Set(),
          rejectedRelays: new Set(),
          expectedRelays: new Set(states.map((state) => state.relayUrl)),
          settled: false,
          timeoutId: null,
          settle: null,
        };

        record.settle = () => {
          if (record.settled) {
            return;
          }
          record.settled = true;
          clearTimeout(record.timeoutId);
          this.publishes.delete(event.id);
          resolve({
            ok: record.acceptedRelays.size > 0,
            openCount: record.expectedRelays.size,
            okCount: record.acceptedRelays.size,
            explicitFailureCount: record.rejectedRelays.size,
          });
        };

        this.publishes.set(event.id, record);
        record.timeoutId = setTimeout(record.settle, this.publishTimeoutMs);
        const payload = JSON.stringify(["EVENT", event]);

        for (const state of states) {
          try {
            state.ws.send(payload);
          } catch (_error) {
            record.rejectedRelays.add(state.relayUrl);
          }
        }

        if (record.rejectedRelays.size >= record.expectedRelays.size) {
          record.settle();
        }
      });
    }

    /** Route relay messages to active subscriptions and publish acknowledgments. */
    handleMessage(state, rawData) {
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (_error) {
        return;
      }

      if (!Array.isArray(data)) {
        return;
      }

      if (data[0] === "EVENT" && data[1] && data[2]) {
        const subscription = this.subscriptions.get(data[1]);
        if (!subscription) {
          return;
        }
        const event = data[2];
        const key = event.id || event.pubkey + ":" + event.created_at;
        const existing = subscription.events.get(key);
        if (
          !existing ||
          Number(existing.created_at || 0) < Number(event.created_at || 0)
        ) {
          subscription.events.set(key, event);
        }
        return;
      }

      if (data[0] === "EOSE" && data[1]) {
        const subscription = this.subscriptions.get(data[1]);
        if (!subscription) {
          return;
        }
        subscription.completedRelays.add(state.relayUrl);
        if (
          subscription.completedRelays.size >= subscription.expectedRelays.size
        ) {
          subscription.settle();
        }
        return;
      }

      if (data[0] === "OK" && data[1]) {
        const publish = this.publishes.get(data[1]);
        if (!publish) {
          return;
        }
        if (data[2] === true) {
          publish.acceptedRelays.add(state.relayUrl);
        } else {
          publish.rejectedRelays.add(state.relayUrl);
        }
        if (
          publish.acceptedRelays.size + publish.rejectedRelays.size >=
          publish.expectedRelays.size
        ) {
          publish.settle();
        }
      }
    }

    /** Close every shared socket and clear the connection pool. */
    close() {
      for (const state of this.connections.values()) {
        try {
          state.ws.close();
        } catch (_error) {
          // Best-effort cleanup.
        }
      }
      this.connections.clear();
    }
  }

  extension.RelayPool = RelayPool;
  extension.relayPool = new RelayPool(DEFAULT_RELAYS);
})();
