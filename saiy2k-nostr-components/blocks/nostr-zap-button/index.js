(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps, InspectorControls } = wp.blockEditor || wp.editor;
	const { PanelBody, TextControl, SelectControl, Notice } = wp.components;
	const { Fragment } = wp.element;

	registerBlockType('nostr/nostr-zap-button', {
		title: 'Nostr Zap Button',
		icon: 'money-alt',
		category: 'nostr',
		attributes: {
			npub: { type: 'string', default: '' },
			pubkey: { type: 'string', default: '' },
			nip05: { type: 'string', default: '' },
			theme: { type: 'string', enum: ['', 'light', 'dark'], default: '' },
			relays: { type: 'string', default: '' },
			text: { type: 'string', default: 'Zap' },
			amount: { type: 'number' },
			'default-amount': { type: 'number' },
			url: { type: 'string', default: '' }
		},
		edit: function Edit({ attributes, setAttributes }) {
			const props = useBlockProps ? useBlockProps() : {};
			
			// Validation helpers
			const validateAmount = (value) => {
				if (!value) return undefined;
				const num = parseInt(value, 10);
				if (isNaN(num)) return undefined;
				return Math.max(0, Math.min(210000, num));
			};
			
			const validateDefaultAmount = (value) => {
				if (!value) return undefined;
				const num = parseInt(value, 10);
				if (isNaN(num)) return undefined;
				return Math.max(1, Math.min(210000, num));
			};
			
			const hasAmountError = attributes.amount && (attributes.amount < 0 || attributes.amount > 210000);
			const hasDefaultAmountError = attributes['default-amount'] && (attributes['default-amount'] < 1 || attributes['default-amount'] > 210000);
			
			return wp.element.createElement(Fragment, null,
				wp.element.createElement(InspectorControls, null,
					wp.element.createElement(PanelBody, { title: 'Zap Button Settings' },
						wp.element.createElement(TextControl, {
							label: 'NPUB (bech32)',
							value: attributes.npub,
							onChange: (value) => setAttributes({ npub: value }),
							placeholder: 'npub1...'
						}),
						wp.element.createElement(TextControl, {
							label: 'Public Key (hex)',
							value: attributes.pubkey,
							onChange: (value) => setAttributes({ pubkey: value }),
							placeholder: 'hex: 64 chars'
						}),
						wp.element.createElement(TextControl, {
							label: 'NIP-05 Identifier',
							value: attributes.nip05,
							onChange: (value) => setAttributes({ nip05: value }),
							placeholder: 'name@example.com'
						}),
						wp.element.createElement(TextControl, {
							label: 'Relays',
							value: attributes.relays,
							onChange: (value) => setAttributes({ relays: value }),
							placeholder: 'wss://relay.example.com,wss://relay2.example.com',
							help: 'Comma-separated list of Nostr relay URLs'
						}),
						wp.element.createElement(TextControl, {
							label: 'Button Text',
							value: attributes.text,
							onChange: (value) => setAttributes({ text: value }),
							placeholder: 'Zap',
							help: 'Custom text for the zap button'
						}),
						hasAmountError && wp.element.createElement(Notice, {
							status: 'error',
							isDismissible: false
						}, 'Fixed amount must be between 0 and 210,000 sats'),
						wp.element.createElement(TextControl, {
							label: 'Fixed Amount (sats)',
							type: 'number',
							value: attributes.amount || '',
							onChange: (value) => setAttributes({ amount: validateAmount(value) }),
							placeholder: 'Leave empty for user to choose',
							help: 'Pre-defined zap amount in sats (empty = user chooses). Max: 210,000',
							min: 0,
							max: 210000
						}),
						hasDefaultAmountError && wp.element.createElement(Notice, {
							status: 'error',
							isDismissible: false
						}, 'Default amount must be between 1 and 210,000 sats'),
						wp.element.createElement(TextControl, {
							label: 'Default Amount (sats)',
							type: 'number',
							value: attributes['default-amount'] || '',
							onChange: (value) => setAttributes({ 'default-amount': validateDefaultAmount(value) }),
							placeholder: '21 (component default)',
							help: 'Default amount shown in zap dialog (empty = 21 sats). Min: 1, Max: 210,000',
							min: 1,
							max: 210000
						}),
						wp.element.createElement(TextControl, {
							label: 'URL (optional)',
							value: attributes.url,
							onChange: (value) => setAttributes({ url: value }),
							placeholder: 'https://example.com',
							help: 'URL to associate with this zap (for URL-based zaps)'
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
									backgroundColor: '#f7931a',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'white',
									fontSize: '18px',
									fontWeight: 'bold'
								} 
							}, '⚡'),
							wp.element.createElement('div', null,
								wp.element.createElement('div', { 
									style: { 
										fontWeight: '600',
										fontSize: '14px',
										color: '#1e1e1e'
									} 
								}, attributes.nip05 || attributes.npub || attributes.pubkey || 'No profile specified'),
								wp.element.createElement('div', { 
									style: { 
										fontSize: '12px',
										color: '#666',
										marginTop: '4px'
									} 
								}, 
									attributes.text || 'Zap',
									attributes.amount > 0 ? ' • ' + attributes.amount + ' sats' : ''
								)
							)
						),
						wp.element.createElement('div', { 
							style: { 
								fontSize: '12px',
								color: '#666',
								fontStyle: 'italic'
							} 
						}, 'Nostr Zap Button')
					)
				)
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();

