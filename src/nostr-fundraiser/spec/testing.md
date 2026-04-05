# Nostr Fundraiser Component – Testing Guide

## Goal

Validate that:

- a NIP-75 goal event renders correctly
- event zaps target the fundraiser event
- donor totals and donor list update from zap receipts
- the flow works with a browser extension

## Recommended Setup

- In Storybook, open `Fundraiser > Manual Event Input` for a preview-first playground, `Fundraiser/Testing/Valid` for fixture-based happy paths, and `Fundraiser/Testing/Invalid > Missing identifier` for the validation state
- Run the local app or Storybook so you can render `<nostr-fundraiser>`
- Use a NIP-07 browser extension such as Alby or nos2x
- Use the local `nostr-fundraiser` component as the primary test surface
- Optional: the only external NIP-75-specific app I could confirm is ZapGoals (`https://zapgoals.turiz.space`). Treat it as a secondary cross-check if it is available to you.

## 1. Publish A Test Goal Event

Publish a goal from the browser console on your local page:

```js
const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

const goal = {
  kind: 9041,
  created_at: Math.floor(Date.now() / 1000),
  content: 'QA fundraiser for nostr-components',
  tags: [
    ['amount', '21000000'],
    ['relays', ...relays],
    ['summary', 'Manual fundraiser test'],
    ['image', 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?auto=format&fit=crop&w=1200&q=80'],
    ['r', 'https://github.com/saiy2k/nostr-components/issues/11']
  ]
};

const signed = await window.nostr.signEvent(goal);

await Promise.all(relays.map(url => new Promise((resolve, reject) => {
  const ws = new WebSocket(url);
  const timeout = setTimeout(() => {
    ws.close();
    reject(new Error(`Timed out publishing to ${url}`));
  }, 8000);

  ws.onopen = () => ws.send(JSON.stringify(['EVENT', signed]));
  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data[0] === 'OK' && data[1] === signed.id) {
      clearTimeout(timeout);
      ws.close();
      resolve(data);
    }
  };
  ws.onerror = reject;
})));

console.log('Fundraiser hex id:', signed.id);
```

Use the printed hex id directly in the component, or convert it to `noteid` / `eventid` if you prefer:

```html
<nostr-fundraiser hex="PUT_THE_HEX_ID_HERE"></nostr-fundraiser>
```

```html
<nostr-fundraiser noteid="PUT_THE_NOTE_ID_HERE"></nostr-fundraiser>
```

```html
<nostr-fundraiser eventid="PUT_THE_NEVENT_ID_HERE"></nostr-fundraiser>
```

## 2. Verify Rendering

- Banner image renders when `image` is present
- Title and description map correctly from the goal data
- Goal amount starts at `0 / target`
- Donor count starts at `0 donors`
- “Learn more” appears when the `r` tag exists

## 3. Optional External Cross-Check

- If ZapGoals is available to you, use it as a secondary cross-check for the same fundraiser event
- Keep the local `nostr-fundraiser` component as the primary renderer and verification surface
- Do not rely on mainstream clients unless they explicitly document `kind: 9041` / NIP-75 support

## 4. Verify Zap Flow

- Click the fundraiser zap button
- Confirm the invoice modal opens
- Pay the invoice from your wallet or wallet extension
- Wait a few seconds for the zap receipt to reach relays
- Refresh the fundraiser card if needed

Expected result:

- the raised amount increases
- donor count increases
- donor dialog shows the zapper and amount

## 5. Edge Cases

- Goal with no `image`
- Goal with `closed_at` in the past
- Goal with multiple `zap` tags
- Goal published to custom relays via the component `relays` attribute
- Missing required `amount` or `relays` tags should fail cleanly
