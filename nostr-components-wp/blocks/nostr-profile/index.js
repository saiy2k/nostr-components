(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, ToggleControl, SelectControl } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-profile', {
		title: 'Nostr Profile',
		icon: 'admin-users',
		category: 'widgets',
		attributes: {
			npub: { type: 'string', default: '' },
			pubkey: { type: 'string', default: '' },
			nip05: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
			relays: { type: 'string', default: '' },
			'show-npub': { type: 'boolean', default: true },
			'show-follow': { type: 'boolean', default: true }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Profile Settings' },
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
						}),
						wp.element.createElement(ToggleControl, {
							label: 'Show NPUB',
							checked: attributes['show-npub'],
							onChange: (value) => setAttributes({ 'show-npub': value })
						}),
						wp.element.createElement(ToggleControl, {
							label: 'Show Follow Button',
							checked: attributes['show-follow'],
							onChange: (value) => setAttributes({ 'show-follow': value })
						})
					)
				),
				wp.element.createElement('div', props,
					wp.element.createElement('div', { 
						style: { 
							border: '2px dashed #007cba',
							borderRadius: '8px',
							padding: '16px',
							backgroundColor: '#f8f9fa',
							fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
						} 
					},
						wp.element.createElement('div', { 
							style: { 
								display: 'flex',
								alignItems: 'center',
								gap: '12px',
								marginBottom: '8px'
							} 
						},
							wp.element.createElement('div', { 
								style: { 
									width: '40px',
									height: '40px',
									borderRadius: '50%',
									backgroundColor: '#28a745',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '18px',
									fontWeight: 'bold'
								} 
							}, '👨‍💼'),
							wp.element.createElement('div', { 
								style: { 
									fontWeight: '600',
									fontSize: '14px',
									color: '#1e1e1e'
								} 
							}, attributes.nip05 || attributes.npub || attributes.pubkey || 'No profile specified')
						),
						wp.element.createElement('div', { 
							style: { 
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic'
							} 
						}, 'Nostr Profile')
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
