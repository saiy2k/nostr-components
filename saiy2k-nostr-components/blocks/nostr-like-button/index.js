(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, SelectControl } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-like-button', {
		title: 'Nostr Like Button',
		icon: 'thumbs-up',
		category: 'nostr',
		attributes: {
			url: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['', 'light', 'dark'], default: '' },
			relays: { type: 'string', default: '' },
			text: { type: 'string', default: 'Like' }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Like Button Settings' },
						wp.element.createElement(TextControl, {
							label: 'URL (optional)',
							value: attributes.url,
							onChange: (value) => setAttributes({ url: value }),
							placeholder: 'https://example.com/article',
							help: 'URL to like (leave empty to like current page)'
						}),
						wp.element.createElement(TextControl, {
							label: 'Button Text',
							value: attributes.text,
							onChange: (value) => setAttributes({ text: value }),
							placeholder: 'Like',
							help: 'Custom text for the like button'
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
									backgroundColor: '#1877f2',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '18px',
									fontWeight: 'bold'
								} 
							}, '👍'),
							wp.element.createElement('div', null,
								wp.element.createElement('div', { 
									style: { 
										fontWeight: '600',
										fontSize: '14px',
										color: '#1e1e1e'
									} 
								}, attributes.url || 'Current page'),
								wp.element.createElement('div', { 
									style: { 
										fontSize: '12px',
										color: '#666',
										marginTop: '4px'
									} 
								}, 
									attributes.text || 'Like',
									' • 0 likes'
								)
							)
						),
						wp.element.createElement('div', { 
							style: { 
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic'
							} 
						}, 'Nostr Like Button')
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
