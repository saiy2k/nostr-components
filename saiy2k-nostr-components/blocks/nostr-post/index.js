(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, ToggleControl, SelectControl } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-post', {
		title: 'Nostr Post',
		icon: 'format-quote',
		category: 'nostr',
		attributes: {
			eventid: { type: 'string', default: '' },
			hex: { type: 'string', default: '' },
			noteid: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['', 'light', 'dark'], default: '' },
			relays: { type: 'string', default: '' },
			'show-stats': { type: 'boolean', default: false }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Post Settings' },
						wp.element.createElement(TextControl, {
							label: 'Event ID',
							value: attributes.eventid,
							onChange: (value) => setAttributes({ eventid: value }),
							help: 'Event ID as nevent1...',
							placeholder: 'nevent1'
						}),
						wp.element.createElement(TextControl, {
							label: 'Hex',
							value: attributes.hex,
							onChange: (value) => setAttributes({ hex: value }),
							help: 'Alternative: Event ID in hex format',
							placeholder: '64 character hex string'
						}),
						wp.element.createElement(TextControl, {
							label: 'Note ID',
							value: attributes.noteid,
							onChange: (value) => setAttributes({ noteid: value }),
							help: 'Note ID in note1... format',
							placeholder: 'note1...'
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
							label: 'Show Stats',
							checked: attributes['show-stats'],
							onChange: (value) => setAttributes({ 'show-stats': value }),
							help: 'Show likes, replies, and other engagement stats'
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
									backgroundColor: '#6f42c1',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '18px',
									fontWeight: 'bold'
								} 
							}, '📝'),
							wp.element.createElement('div', { 
								style: { 
									fontWeight: '600',
									fontSize: '14px',
									color: '#1e1e1e'
								} 
							}, attributes.eventid || 'No event ID specified')
						),
						wp.element.createElement('div', { 
							style: { 
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic'
							} 
						}, 'Nostr Post')
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
