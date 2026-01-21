(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, ToggleControl, SelectControl } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-livestream', {
		title: 'Nostr Livestream',
		icon: 'video-alt3',
		category: 'nostr',
		attributes: {
			naddr: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['', 'light', 'dark'], default: '' },
			relays: { type: 'string', default: '' },
			'show-participants': { type: 'boolean', default: true },
			'show-participant-count': { type: 'boolean', default: true },
			'auto-play': { type: 'boolean', default: false }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Livestream Settings' },
						wp.element.createElement(TextControl, {
							label: 'Naddr (NIP-19)',
							value: attributes.naddr,
							onChange: (value) => setAttributes({ naddr: value }),
							help: 'NIP-19 addressable event code for the livestream',
							placeholder: 'naddr1...'
						}),
						wp.element.createElement(TextControl, {
							label: 'Relays',
							value: attributes.relays,
							onChange: (value) => setAttributes({ relays: value }),
							placeholder: 'wss://relay.example.com,wss://relay2.example.com',
							help: 'Comma-separated list of Nostr relay URLs'
						}),
						wp.element.createElement(SelectControl, {
							label: 'Theme',
							value: attributes.theme || '',
							options: [
								{ label: 'Use Site Default', value: '' },
								{ label: 'Light', value: 'light' },
								{ label: 'Dark', value: 'dark' }
							],
							onChange: (value) => setAttributes({ theme: value })
						}),
						wp.element.createElement(ToggleControl, {
							label: 'Show Participants',
							checked: attributes['show-participants'],
							onChange: (value) => setAttributes({ 'show-participants': value }),
							help: 'Display participant list'
						}),
						wp.element.createElement(ToggleControl, {
							label: 'Show Participant Count',
							checked: attributes['show-participant-count'],
							onChange: (value) => setAttributes({ 'show-participant-count': value }),
							help: 'Display current/total participant counts'
						}),
						wp.element.createElement(ToggleControl, {
							label: 'Auto-play Video',
							checked: attributes['auto-play'],
							onChange: (value) => setAttributes({ 'auto-play': value }),
							help: 'Autoplay video when status is "live"'
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
									backgroundColor: '#dc3545',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '18px',
									fontWeight: 'bold'
								} 
							}, '📹'),
							wp.element.createElement('div', { 
								style: { 
									fontWeight: '600',
									fontSize: '14px',
									color: '#1e1e1e'
								} 
							}, attributes.naddr || 'No naddr specified')
						),
						wp.element.createElement('div', { 
							style: { 
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic'
							} 
						}, 'Nostr Livestream')
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
