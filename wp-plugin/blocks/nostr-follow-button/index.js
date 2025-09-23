(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, SelectControl } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-follow-button', {
		title: 'Nostr Follow Button',
		icon: 'heart',
		category: 'widgets',
		attributes: {
			npub: { type: 'string', default: '' },
			pubkey: { type: 'string', default: '' },
			nip05: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
			relays: { type: 'string', default: '' }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Follow Button Settings' },
						wp.element.createElement(TextControl, {
							label: 'NPUB (bech32)',
							value: attributes.npub,
							onChange: (value) => setAttributes({ npub: value })
						}),
						wp.element.createElement(TextControl, {
							label: 'Public Key (hex)',
							value: attributes.pubkey,
							onChange: (value) => setAttributes({ pubkey: value })
						}),
						wp.element.createElement(TextControl, {
							label: 'NIP-05 Identifier',
							value: attributes.nip05,
							onChange: (value) => setAttributes({ nip05: value })
						}),
						wp.element.createElement(SelectControl, {
							label: 'Theme',
							value: attributes.theme,
							options: [
								{ label: 'Light', value: 'light' },
								{ label: 'Dark', value: 'dark' }
							],
							onChange: (value) => setAttributes({ theme: value })
						})
					)
				),
				wp.element.createElement('div', props,
					wp.element.createElement('p', null, 'Nostr Follow Button'),
					wp.element.createElement('p', { style: { fontSize: '12px', color: '#666' } },
						attributes.nip05 || attributes.npub || attributes.pubkey || 'No profile specified'
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
