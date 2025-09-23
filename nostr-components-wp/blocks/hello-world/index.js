(function() {
	const { registerBlockType } = wp.blocks;
	const { useBlockProps } = wp.blockEditor || wp.editor;

	registerBlockType('nostr/hello-world', {
		title: 'Hello World',
		icon: 'smiley',
		category: 'widgets',
		edit: function Edit() {
			const props = useBlockProps ? useBlockProps() : {};
			return wp.element.createElement(
				'p',
				props,
				'Hello World'
			);
		},
		save: function Save() {
			return null; // server rendered
		}
	});
})();
