import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderCommentWidget, getCommentStyles } from './render';
import { NostrService } from '../common/nostr-service';

interface Comment {
    id: string;
    pubkey: string;
    content: string;
    created_at: number;
    replies: Comment[];
    userProfile?: NDKUserProfile;
    replyTo?: string; // Parent comment ID for replies
    depth?: number; // Nesting depth
}

export default class NostrComment extends HTMLElement {
    private rendered: boolean = false;
    private nostrService: NostrService = NostrService.getInstance();
    private shadow: ShadowRoot;

    private theme: Theme = 'light';
    private isLoading: boolean = true;
    private isError: boolean = false;
    private errorMessage: string = '';

    private comments: Comment[] = [];
    private baseUrl: string = '';
    private userPublicKey: string | null = null;
    private userPrivateKey: string | null = null;
    private currentUserProfile: NDKUserProfile | null = null;


    private isSubmitting: boolean = false;
    private replyingToComment: string | null = null; // ID of comment being replied to

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    getRelays = (): string[] => {
        const userRelays = this.getAttribute('relays');
        if (userRelays) {
            return userRelays.split(',').map(r => r.trim());
        }
        return DEFAULT_RELAYS;
    };

    getTheme = (): void => {
        this.theme = 'light';
        const userTheme = this.getAttribute('theme');

        if (userTheme) {
            const isValidTheme = ['light', 'dark'].includes(userTheme);

            if (!isValidTheme) {
                console.warn(
                    `Invalid theme '${userTheme}'. Accepted values are 'light', 'dark'`
                );
            } else {
                this.theme = userTheme as Theme;
            }
        }
    };

    getBaseUrl = (): string => {
        const urlAttr = this.getAttribute('url');
        if (urlAttr) {
            return this.normalizeURL(urlAttr);
        }
        return this.normalizeURL(window.location.href);
    };

    normalizeURL = (raw: string): string => {
        try {
            const url = new URL(raw);
            return (
                url.origin
                    .replace('://m.', '://') // remove known 'mobile' subdomains
                    .replace('://mobile.', '://')
                    .replace('http://', 'https://') // default everything to https
                    .replace(
                        /:\d+/,
                        // remove 443 and 80 ports
                        port => (port === ':443' || port === ':80' ? '' : port)
                    ) +
                url.pathname
                    .replace(/\/+/g, '/') // remove duplicated slashes in the middle of the path
                    .replace(/\/*$/, '') // remove slashes from the end of path
            );
        } catch (error) {
            console.error('Invalid URL:', raw);
            return raw;
        }
    };

    loadComments = async (): Promise<void> => {
        try {
            this.isLoading = true;
            this.isError = false;
            this.render();

            const relays = this.getRelays();
            await this.nostrService.connectToNostr(relays);

            // Search for comments related to this URL
            const filter = {
                kinds: [1], // text notes
                '#r': [this.baseUrl], // URL reference
                limit: 100
            };

            const events = await this.nostrService.getNDK().fetchEvents(filter);
            const commentsArray = Array.from(events);

            // Convert events to comment format and fetch user profiles
            const allComments: Comment[] = [];
            for (const event of commentsArray) {
                // Check if this is a reply to another comment
                const replyToTag = event.tags?.find(tag => tag[0] === 'e' && tag[3] === 'reply');
                const replyTo = replyToTag ? replyToTag[1] : undefined;

                const comment: Comment = {
                    id: event.id,
                    pubkey: event.pubkey,
                    content: event.content,
                    created_at: event.created_at!,
                    replies: [],
                    replyTo,
                    depth: 0
                };

                // Fetch user profile
                try {
                    const profile = await this.nostrService.getProfile({ pubkey: event.pubkey });
                    if (profile) {
                        comment.userProfile = profile;
                    }
                } catch (error) {
                    console.warn('Failed to fetch profile for:', event.pubkey);
                }

                allComments.push(comment);
            }

            // Build threaded comment structure
            this.comments = this.buildCommentTree(allComments);

        } catch (error) {
            this.isError = true;
            this.errorMessage = error instanceof Error ? error.message : 'Failed to load comments';
            console.error('Error loading comments:', error);
        } finally {
            this.isLoading = false;
            this.render();
        }
    };

    buildCommentTree = (allComments: Comment[]): Comment[] => {
        // Create a map for quick lookup
        const commentMap = new Map<string, Comment>();
        const rootComments: Comment[] = [];

        // First pass: create the map
        allComments.forEach(comment => {
            commentMap.set(comment.id, comment);
        });

        // Second pass: build the tree
        allComments.forEach(comment => {
            if (comment.replyTo && commentMap.has(comment.replyTo)) {
                // This is a reply to another comment
                const parent = commentMap.get(comment.replyTo)!;
                comment.depth = (parent.depth || 0) + 1;
                parent.replies.push(comment);
                // Sort replies by timestamp (oldest first for natural conversation flow)
                parent.replies.sort((a, b) => a.created_at - b.created_at);
            } else {
                // This is a root comment
                rootComments.push(comment);
            }
        });

        // Sort root comments by timestamp (newest first)
        return rootComments.sort((a, b) => b.created_at - a.created_at);
    };

    initializeUser = async (): Promise<void> => {
        // Check for NIP-07 extension (like nos2x, Alby, etc.)
        if ((window as any).nostr) {
            try {
                this.userPublicKey = await (window as any).nostr.getPublicKey();
                console.log('Connected to NIP-07 extension');
                return;
            } catch (error) {
                console.warn('NIP-07 extension available but failed to get public key');
            }
        }

        // Fall back to generating/storing local keys
        const storedKey = localStorage.getItem('nostr-comment-private-key');
        if (storedKey && storedKey.match(/^[a-f0-9]{64}$/)) {
            this.userPrivateKey = storedKey;
            // Generate public key from private key
            const { getPublicKey } = await import('nostr-tools/pure');
            this.userPublicKey = getPublicKey(Buffer.from(storedKey, 'hex'));
        } else {
            // Generate new key pair
            const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
            const privateKey = generateSecretKey();
            this.userPrivateKey = Buffer.from(privateKey).toString('hex');
            this.userPublicKey = getPublicKey(privateKey);
            localStorage.setItem('nostr-comment-private-key', this.userPrivateKey);
            console.log('Generated new Nostr key pair');
        }

        // Fetch current user's profile
        if (this.userPublicKey) {
            try {
                console.log('Fetching profile for user:', this.userPublicKey);
                const profile = await this.nostrService.getProfile({ pubkey: this.userPublicKey });
                if (profile) {
                    this.currentUserProfile = profile;
                    console.log('Profile loaded:', profile);
                } else {
                    console.log('No profile found, using default');
                    // Create a basic profile with the public key
                    this.currentUserProfile = {
                        name: `User ${this.userPublicKey.slice(0, 8)}`,
                        displayName: `User ${this.userPublicKey.slice(0, 8)}`,
                        image: './assets/default_dp.png'
                    };
                }
            } catch (error) {
                console.warn('Failed to fetch current user profile, using default');
                // Create a basic profile as fallback
                this.currentUserProfile = {
                    name: `User ${this.userPublicKey.slice(0, 8)}`,
                    displayName: `User ${this.userPublicKey.slice(0, 8)}`,
                    image: './assets/default_dp.png'
                };
            }
            this.render(); // Re-render to show user profile
        }
    };

    submitComment = async (content: string): Promise<void> => {
        if (!content.trim()) return;
        if (!this.userPublicKey) {
            await this.initializeUser();
        }

        this.isSubmitting = true;
        this.render();

        try {
            const tags: string[][] = [
                ['r', this.baseUrl], // URL reference
                ['client', 'nostr-components']
            ];

            // Add reply tag if this is a reply
            if (this.replyingToComment) {
                tags.push(['e', this.replyingToComment, '', 'reply']);
            }

            const event = {
                kind: 1,
                pubkey: this.userPublicKey!,
                content: content.trim(),
                created_at: Math.floor(Date.now() / 1000),
                tags
            };

            let signedEvent;
            if ((window as any).nostr && !this.userPrivateKey) {
                // Use NIP-07 extension to sign
                signedEvent = await (window as any).nostr.signEvent(event);
            } else if (this.userPrivateKey) {
                // Sign with local private key
                const { finalizeEvent } = await import('nostr-tools/pure');
                const privateKeyBytes = Buffer.from(this.userPrivateKey, 'hex');
                signedEvent = finalizeEvent(event, privateKeyBytes);
            } else {
                throw new Error('No signing method available');
            }

            // Publish to relays
            const ndkEvent = new NDKEvent(this.nostrService.getNDK(), signedEvent);
            await ndkEvent.publish();

            // Add to local comments immediately
            const newComment: Comment = {
                id: signedEvent.id,
                pubkey: signedEvent.pubkey,
                content: signedEvent.content,
                created_at: signedEvent.created_at,
                replies: [],
                replyTo: this.replyingToComment || undefined,
                depth: 0
            };

            // Use current user profile if available
            if (this.currentUserProfile) {
                newComment.userProfile = this.currentUserProfile;
            } else {
                // Try to fetch profile again for new comments
                try {
                    const profile = await this.nostrService.getProfile({ pubkey: signedEvent.pubkey });
                    if (profile) {
                        newComment.userProfile = profile;
                        this.currentUserProfile = profile; // Update for future comments
                    }
                } catch (error) {
                    console.warn('Could not fetch profile for new comment');
                }
            }

            // Add to appropriate location in comment tree
            if (this.replyingToComment) {
                // Find parent comment and add as reply
                this.addReplyToComment(newComment, this.replyingToComment);
            } else {
                // Add as root comment
                this.comments.unshift(newComment);
            }

            // Clear input and reset reply state
            const activeTextarea = this.shadow.querySelector('#comment-input') as HTMLTextAreaElement;
            if (activeTextarea) {
                activeTextarea.value = '';
            }
            this.replyingToComment = null;

        } catch (error) {
            console.error('Failed to submit comment:', error);
            alert('Failed to submit comment: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            this.isSubmitting = false;
            this.render();
        }
    };

    addReplyToComment = (newComment: Comment, parentId: string): void => {
        const findAndAddReply = (comments: Comment[]): boolean => {
            for (const comment of comments) {
                if (comment.id === parentId) {
                    newComment.depth = (comment.depth || 0) + 1;
                    comment.replies.push(newComment);
                    // Sort replies by timestamp (oldest first)
                    comment.replies.sort((a, b) => a.created_at - b.created_at);
                    return true;
                }
                if (comment.replies.length > 0 && findAndAddReply(comment.replies)) {
                    return true;
                }
            }
            return false;
        };

        findAndAddReply(this.comments);
    };

    startReply = (commentId: string): void => {
        // Cancel any existing reply first
        this.replyingToComment = null;
        this.render();

        // Then start new reply
        setTimeout(() => {
            this.replyingToComment = commentId;
            this.render();

            // Focus the textarea after render
            setTimeout(() => {
                const textarea = this.shadow.querySelector('#comment-input') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.focus();
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }, 10);
    };

    cancelReply = (): void => {
        this.replyingToComment = null;
        this.render();
    };

    async connectedCallback() {
        if (!this.rendered) {
            this.getTheme();
            this.baseUrl = this.getBaseUrl();
            // Load comments first (don't require user initialization)
            this.loadComments();
            // Initialize user separately for commenting functionality
            await this.initializeUser();
            this.rendered = true;
        }
    }

    static get observedAttributes() {
        return [
            'relays',
            'theme',
            'url',
            'readonly',
            'placeholder'
        ];
    }

    attributeChangedCallback(name: string, _oldValue: string, _newValue: string) {
        if (name === 'relays') {
            this.nostrService.connectToNostr(this.getRelays());
            this.loadComments();
        }

        if (name === 'theme') {
            this.getTheme();
            this.render();
        }

        if (name === 'url') {
            this.baseUrl = this.getBaseUrl();
            this.loadComments();
        }

        if (['readonly', 'placeholder'].includes(name)) {
            this.render();
        }
    }

    disconnectedCallback() {
        // Cleanup if needed
    }

    attachEventListeners() {
        // Handle both main form and inline form submit buttons
        this.shadow.querySelectorAll('#submit-comment').forEach(submitButton => {
            submitButton.addEventListener('click', (e) => {
                e.preventDefault();
                const form = (e.target as HTMLElement).closest('.comment-form, .inline-reply-form');
                const textarea = form?.querySelector('#comment-input') as HTMLTextAreaElement;
                if (textarea) {
                    this.submitComment(textarea.value);
                }
            });
        });

        // Handle textareas (main form and inline forms)
        this.shadow.querySelectorAll('#comment-input').forEach(textarea => {
            // Allow Ctrl+Enter to submit
            textarea.addEventListener('keydown', (e: Event) => {
                const keyEvent = e as KeyboardEvent;
                if (keyEvent.key === 'Enter' && (keyEvent.ctrlKey || keyEvent.metaKey)) {
                    keyEvent.preventDefault();
                    this.submitComment((textarea as HTMLTextAreaElement).value);
                }
            });
        });

        // Cancel reply buttons
        this.shadow.querySelectorAll('#cancel-reply').forEach(cancelButton => {
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.cancelReply();
            });
        });

        // Reply buttons for each comment
        this.shadow.querySelectorAll('.reply-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const commentId = (e.target as HTMLElement).getAttribute('data-comment-id');
                if (commentId) {
                    this.startReply(commentId);
                }
            });
        });
    }

    render() {
        // Update theme class on host element
        this.classList.toggle('dark', this.theme === 'dark');
        this.classList.toggle('loading', this.isLoading);
        this.classList.toggle('error-container', this.isError);

        // Get attribute values
        const readonly = this.getAttribute('readonly') === 'true';
        const placeholder = this.getAttribute('placeholder') || 'Write a comment...';

        // Generate the HTML content
        const contentHTML = renderCommentWidget(
            this.isLoading,
            this.isError,
            this.errorMessage,
            this.comments,
            readonly,
            placeholder,
            this.isSubmitting,
            this.currentUserProfile,
            this.replyingToComment
        );

        // Combine styles and content for shadow DOM
        this.shadow.innerHTML = `
      ${getCommentStyles(this.theme)}
      <div class="nostr-comment-wrapper">
        ${contentHTML}
      </div>
    `;

        this.attachEventListeners();
    }
}

customElements.define('nostr-comment', NostrComment);
