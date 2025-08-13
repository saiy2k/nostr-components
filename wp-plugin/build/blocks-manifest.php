<?php
// This file is generated. Do not modify it manually.
return array(
	'nostr-badge' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'create-block/nostr-badge',
		'version' => '0.1.0',
		'title' => 'Nostr Badge',
		'category' => 'nostr',
		'icon' => 'smiley',
		'description' => 'Integrate Nostr Badge into your WordPress site.',
		'supports' => array(
			'html' => false,
			'anchor' => true
		),
		'attributes' => array(
			'npub' => array(
				'type' => 'string',
				'default' => '',
				'pattern' => '^[a-f0-9]{64}$'
			)
		),
		'textdomain' => 'nostr-badge',
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScript' => 'file:./view.js'
	),
	'nostr-follow-button' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'create-block/nostr-follow-button',
		'version' => '0.1.0',
		'title' => 'Nostr Follow Button',
		'category' => 'nostr',
		'icon' => 'share-alt2',
		'description' => 'Integrate Nostr follow button into your WordPress site.',
		'keywords' => array(
			'nostr',
			'follow',
			'button',
			'social',
			'media'
		),
		'attributes' => array(
			'npub' => array(
				'type' => 'string',
				'default' => ''
			)
		),
		'supports' => array(
			'html' => false
		),
		'textdomain' => 'nostr-follow-button',
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScript' => 'file:./view.js'
	),
	'nostr-post' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'create-block/nostr-post',
		'version' => '0.1.0',
		'title' => 'Nostr Post',
		'category' => 'nostr',
		'icon' => 'smiley',
		'description' => 'Integrate Nostr post into your WordPress site.',
		'attributes' => array(
			'id' => array(
				'type' => 'string',
				'default' => '',
				'pattern' => '^[a-f0-9]{64}$'
			)
		),
		'supports' => array(
			'html' => false
		),
		'textdomain' => 'nostr-post',
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScript' => 'file:./view.js'
	),
	'nostr-profile' => array(
		'$schema' => 'https://schemas.wp.org/trunk/block.json',
		'apiVersion' => 3,
		'name' => 'create-block/nostr-profile',
		'version' => '0.1.0',
		'title' => 'Nostr Profile',
		'category' => 'nostr',
		'icon' => 'smiley',
		'description' => 'Integrate Nostr profile into your WordPress site.',
		'attributes' => array(
			'npub' => array(
				'type' => 'string',
				'default' => ''
			)
		),
		'supports' => array(
			'html' => false
		),
		'textdomain' => 'nostr-profile',
		'editorScript' => 'file:./index.js',
		'editorStyle' => 'file:./index.css',
		'style' => 'file:./style-index.css',
		'viewScript' => 'file:./view.js'
	)
);
