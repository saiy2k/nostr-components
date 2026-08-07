(function () {
  const REQUEST_SOURCE = 'nostr-competency-extension';
  const RESPONSE_SOURCE = 'nostr-competency-bridge';

  async function getNostrProvider() {
    const nostr = window.nostr;

    if (!nostr) {
      throw new Error('No NIP-07 signer found on window.nostr');
    }

    return nostr;
  }

  window.addEventListener('message', async function (event) {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== REQUEST_SOURCE || !data.type || !data.requestId) {
      return;
    }

    try {
      const nostr = await getNostrProvider();

      if (data.type === 'GET_PUBLIC_KEY') {
        if (typeof nostr.getPublicKey !== 'function') {
          throw new Error('The signer does not support getPublicKey()');
        }

        const pubkey = await nostr.getPublicKey();

        window.postMessage(
          {
            source: RESPONSE_SOURCE,
            requestId: data.requestId,
            ok: true,
            pubkey: pubkey
          },
          '*'
        );

        return;
      }

      if (data.type === 'SIGN_EVENT') {
        if (typeof nostr.signEvent !== 'function') {
          throw new Error('The signer does not support signEvent()');
        }

        const signedEvent = await nostr.signEvent(data.payload.event);

        window.postMessage(
          {
            source: RESPONSE_SOURCE,
            requestId: data.requestId,
            ok: true,
            signedEvent: signedEvent
          },
          '*'
        );

        return;
      }

      throw new Error('Unsupported bridge request: ' + data.type);
    } catch (error) {
      window.postMessage(
        {
          source: RESPONSE_SOURCE,
          requestId: data.requestId,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown bridge error'
        },
        '*'
      );
    }
  });
})();
