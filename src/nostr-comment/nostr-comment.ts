import { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from '../common/constants';
import { Theme } from '../common/types';
import { renderCommentWidget, getCommentStyles } from './render';
import { NostrService } from '../common/nostr-service';
import { normalizeURL } from './utils';
import DOMPurify from 'dompurify';

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
    private commentAs: 'user' | 'anon' = 'user'; // Default to user mode when logged in
    private hasNip07: boolean = false;
    private anonPrivateKeyHex: string | null = null;
    private eventListeners: Array<{ element: Element; type: string; handler: EventListener }> = [];
    private nip07MonitoringInterval: ReturnType<typeof setInterval> | null = null;

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
            return normalizeURL(urlAttr);
        }
        return normalizeURL(window.location.href);
    };

    // Helper method to detect and validate NIP-07 extension
    private detectNip07Extension = (): boolean => {
        const nostr = (window as any).nostr;
        if (!nostr) {
            return false;
        }

        // Check if the extension has the required methods
        const hasRequiredMethods = typeof nostr.getPublicKey === 'function' &&
            typeof nostr.signEvent === 'function';

        if (!hasRequiredMethods) {
            console.warn('NIP-07 extension detected but missing required methods');
            return false;
        }

        return true;
    };

    // Method to handle NIP-07 extension state changes
    private handleNip07StateChange = async (): Promise<void> => {
        const wasNip07Available = this.hasNip07;
        const isNip07Available = this.detectNip07Extension();

        if (wasNip07Available !== isNip07Available) {
            console.log('NIP-07 extension state changed:', isNip07Available);
            this.hasNip07 = isNip07Available;

            // If NIP-07 became available and we're in user mode, try to reconnect
            if (isNip07Available && this.commentAs === 'user') {
                try {
                    await this.initializeUser();
                    this.render();
                } catch (error) {
                    console.warn('Failed to reconnect to NIP-07 extension:', error);
                }
            }
        }
    };

    // Set up periodic monitoring of NIP-07 extension state
    private setupNip07StateMonitoring = (): void => {
        // Check for NIP-07 state changes every 2 seconds
        const intervalId = setInterval(async () => {
            if (this.isConnected) {
                await this.handleNip07StateChange();
            } else {
                clearInterval(intervalId);
            }
        }, 2000);

        // Store the interval ID for cleanup
        this.nip07MonitoringInterval = intervalId;
    };

    loadComments = async (): Promise<void> => {
        try {
            this.isLoading = true;
            this.isError = false;
            this.render();

            const relays = this.getRelays();
            await this.nostrService.connectToNostr(relays);

            // Search for comments related to this URL (custom kind 1111, tagged by URL with #I)
            const filter = {
                kinds: [1111],
                '#I': [this.baseUrl],
                limit: 200
            } as any;

            const events = await this.nostrService.getNDK().fetchEvents(filter as any);
            const commentsArray = Array.from(events);

            // Temporary map for debugging to resolve content by id
            const idToRaw = new Map<string, { content: string; id: string; tags: string[][] }>();
            commentsArray.forEach(ev => idToRaw.set(ev.id, { content: ev.content, id: ev.id, tags: ev.tags as any }));

            // Convert events to comment format
            const allComments: Comment[] = [];
            const uniquePubkeys = new Set<string>();

            for (const event of commentsArray) {
                // Determine immediate parent (reply) robustly
                let replyTo: string | undefined = undefined;
                const eTags = (event.tags || []).filter((t: string[]) => t[0] === 'e');

                // 1) Prefer explicit marker 'reply'
                for (let i = eTags.length - 1; i >= 0; i--) {
                    const t = eTags[i];
                    if (t[3] === 'reply') {
                        replyTo = t[1];
                        break;
                    }
                }
                // 2) Fallback: if no marker, use the last e tag (most clients order root first, then reply)
                if (!replyTo && eTags.length > 0) {
                    // If any e tag has marker 'root', prefer the last e tag that is not marked 'root'
                    const nonRoot = eTags.filter((t: any) => t[3] !== 'root');
                    if (nonRoot.length > 0) {
                        replyTo = nonRoot[nonRoot.length - 1][1];
                    } else {
                        replyTo = eTags[eTags.length - 1][1];
                    }
                }

                const comment: Comment = {
                    id: event.id,
                    pubkey: event.pubkey,
                    content: event.content,
                    created_at: event.created_at!,
                    replies: [],
                    replyTo,
                    depth: 0
                };

                uniquePubkeys.add(event.pubkey);
                allComments.push(comment);
            }

            // Fetch all unique profiles in parallel
            const profilePromises = Array.from(uniquePubkeys).map(async (pubkey) => {
                try {
                    console.log('Fetching profile for pubkey:', pubkey);
                    const profile = await this.nostrService.getProfile({ pubkey });
                    console.log('Profile fetched for', pubkey, ':', profile);
                    return { pubkey, profile };
                } catch (error) {
                    console.warn('Failed to fetch profile for:', pubkey, error);
                    return { pubkey, profile: null };
                }
            });

            const profileResults = await Promise.allSettled(profilePromises);
            const pubkeyToProfile = new Map<string, NDKUserProfile | null>();

            profileResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    const { pubkey, profile } = result.value;
                    pubkeyToProfile.set(pubkey, profile);
                }
            });

            // Attach profiles to comments
            allComments.forEach(comment => {
                comment.userProfile = pubkeyToProfile.get(comment.pubkey) || undefined;
                console.log('Attached profile to comment:', comment.pubkey, 'Profile:', comment.userProfile);
            });

            // Build threaded comment structure
            this.comments = this.buildCommentTree(allComments);

            // Debug: log resolved parent chains
            const idToComment = new Map<string, Comment>();
            this.comments.forEach(root => {
                const stack: Comment[] = [root];
                while (stack.length) {
                    const c = stack.pop()!;
                    idToComment.set(c.id, c);
                    c.replies.forEach(r => stack.push(r));
                }
            });

            allComments.forEach(c => {
                const parent = c.replyTo ? idToComment.get(c.replyTo) : undefined;
                const parentContent = parent ? parent.content : '(no parent)';
                console.log(`[nostr-comment] recv: "${c.content}" -> parent: ${parentContent}`);
            });

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

        // Second pass: build the tree (link replies)
        allComments.forEach(comment => {
            if (comment.replyTo && commentMap.has(comment.replyTo)) {
                // This is a reply to another comment
                const parent = commentMap.get(comment.replyTo)!;
                parent.replies.push(comment);
                // Sort replies by timestamp (oldest first for natural conversation flow)
                parent.replies.sort((a, b) => a.created_at - b.created_at);
            } else {
                // This is a root comment
                rootComments.push(comment);
            }
        });

        // Third pass: compute depths from roots to ensure correct indentation
        const assignDepths = (nodes: Comment[], depth: number) => {
            for (const n of nodes) {
                n.depth = depth;
                if (n.replies && n.replies.length) assignDepths(n.replies, depth + 1);
            }
        };
        assignDepths(rootComments, 0);

        // Sort root comments by timestamp (newest first)
        return rootComments.sort((a, b) => b.created_at - a.created_at);
    };

    initializeUser = async (): Promise<void> => {
        // Detect NIP-07 extension (nos2x, Alby, etc.)
        this.hasNip07 = this.detectNip07Extension();
        console.log('NIP-07 extension detected:', this.hasNip07);

        // If NIP-07 is available and we're in user mode, try to connect
        if (this.hasNip07 && this.commentAs === 'user') {
            try {
                // Test the extension by getting the public key
                this.userPublicKey = await (window as any).nostr.getPublicKey();
                console.log('Successfully connected to NIP-07 extension, public key:', this.userPublicKey);

                // Clear any stored private keys when using NIP-07
                this.userPrivateKey = null;
                this.anonPrivateKeyHex = null;
            } catch (error) {
                console.warn('NIP-07 extension available but failed to get public key:', error);
                // Fall back to anon identity if NIP-07 fails
                this.commentAs = 'anon';
                this.userPublicKey = null;
                this.userPrivateKey = null;
            }
        }

        // If not using extension or we fell back to anon, generate/use anon key
        if (!this.userPublicKey) {
            const anonKey = await this.ensureAnonKey();
            this.anonPrivateKeyHex = anonKey;
            this.userPrivateKey = anonKey;
            const { getPublicKey } = await import('nostr-tools/pure');
            this.userPublicKey = getPublicKey(new Uint8Array(anonKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))));
            console.log('Using anonymous key for user:', this.userPublicKey);
        }

        // Ensure anonymous key is available when in anonymous mode
        if (this.commentAs === 'anon' && !this.anonPrivateKeyHex) {
            const anonKey = await this.ensureAnonKey();
            this.anonPrivateKeyHex = anonKey;
            console.log('Ensured anonymous key is available');
        }

        // Fetch current identity profile (or fallback)
        if (this.userPublicKey) {
            try {
                console.log('Fetching profile for user:', this.userPublicKey);
                const profile = await this.nostrService.getProfile({ pubkey: this.userPublicKey });
                console.log('Profile fetched for current user:', profile);

                if (profile) {
                    this.currentUserProfile = profile;
                    console.log('Set currentUserProfile to:', this.currentUserProfile);
                } else {
                    this.currentUserProfile = {
                        name: this.commentAs === 'anon' ? 'Anonymous' : `User ${this.userPublicKey.slice(0, 8)}`,
                        displayName: this.commentAs === 'anon' ? 'Anonymous' : `User ${this.userPublicKey.slice(0, 8)}`,
                        image: './assets/default_dp.png'
                    };
                    console.log('Set fallback currentUserProfile to:', this.currentUserProfile);
                }
            } catch (error) {
                console.error('Error fetching current user profile:', error);
                this.currentUserProfile = {
                    name: this.commentAs === 'anon' ? 'Anonymous' : `User ${this.userPublicKey.slice(0, 8)}`,
                    displayName: this.commentAs === 'anon' ? 'Anonymous' : `User ${this.userPublicKey.slice(0, 8)}`,
                    image: './assets/default_dp.png'
                };
                console.log('Set error fallback currentUserProfile to:', this.currentUserProfile);
            }
            this.render();
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
            // Build tags using NoComment-like structure
            const tags: string[][] = [];

            // Root/thread identification tag for URL thread root used on read (#I)
            tags.push(['I', this.baseUrl]);

            if (this.replyingToComment) {
                // Walk the current in-memory tree to find the immediate parent and its root
                const { rootId } = this.findRootAndParent(this.replyingToComment);
                // Root reference
                tags.push(['e', rootId || this.replyingToComment, '', 'root']);
                // Immediate parent reference
                tags.push(['e', this.replyingToComment, '', 'reply']);
                // Parent kind hint
                tags.push(['k', '1111']);
            }

            // Construct the custom comment event (kind 1111)
            const event = {
                kind: 1111,
                pubkey: this.userPublicKey!,
                content: content.trim(),
                created_at: Math.floor(Date.now() / 1000),
                tags
            };

            let signedEvent;
            console.log(`[nostr-comment] Signing attempt - commentAs: ${this.commentAs}, hasNip07: ${!!(window as any).nostr}, anonKey: ${!!this.anonPrivateKeyHex}, userKey: ${!!this.userPrivateKey}`);

            if (this.commentAs === 'user' && this.hasNip07 && (window as any).nostr) {
                // Use NIP-07 extension to sign
                console.log('[nostr-comment] Using NIP-07 extension to sign');
                try {
                    signedEvent = await (window as any).nostr.signEvent(event);
                    console.log('[nostr-comment] Successfully signed with NIP-07 extension');
                } catch (error) {
                    console.error('[nostr-comment] Failed to sign with NIP-07 extension:', error);
                    throw new Error('Failed to sign with NIP-07 extension. Please check if your extension is unlocked.');
                }
            } else if (this.commentAs === 'anon' && this.anonPrivateKeyHex) {
                // Sign with anonymous private key
                console.log('[nostr-comment] Using anonymous private key to sign');
                const { finalizeEvent } = await import('nostr-tools/pure');
                const privateKeyBytes = new Uint8Array(this.anonPrivateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                signedEvent = finalizeEvent(event, privateKeyBytes);
            } else if (this.userPrivateKey) {
                // Sign with local private key (fallback)
                console.log('[nostr-comment] Using local private key to sign (fallback)');
                const { finalizeEvent } = await import('nostr-tools/pure');
                const privateKeyBytes = new Uint8Array(this.userPrivateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
                signedEvent = finalizeEvent(event, privateKeyBytes);
            } else {
                console.error('[nostr-comment] No signing method available - commentAs:', this.commentAs, 'hasNip07:', this.hasNip07, 'anonKey:', !!this.anonPrivateKeyHex, 'userKey:', !!this.userPrivateKey);
                throw new Error('No signing method available. Please check your NIP-07 extension or switch to anonymous mode.');
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

            // Debug: log what we sent
            const rootTag = tags.find(t => t[0] === 'e' && t[3] === 'root');
            const replyTag = tags.find(t => t[0] === 'e' && t[3] === 'reply');
            console.log(`[nostr-comment] send: "${event.content}" root=${rootTag ? rootTag[1] : '(none)'} parent=${replyTag ? replyTag[1] : '(none)'} `);

            // Clear the active textarea and reset reply state
            if (this.replyingToComment) {
                // Clear inline reply textarea
                const inlineForm = this.shadow.querySelector('.inline-reply-form');
                const inlineTextarea = inlineForm?.querySelector('[data-role="comment-input"]') as HTMLTextAreaElement;
                if (inlineTextarea) {
                    inlineTextarea.value = '';
                }
            } else {
                // Clear main form textarea
                const mainForm = this.shadow.querySelector('.comment-form');
                const mainTextarea = mainForm?.querySelector('[data-role="comment-input"]') as HTMLTextAreaElement;
                if (mainTextarea) {
                    mainTextarea.value = '';
                }
            }
            this.replyingToComment = null;

        } catch (error) {
            console.error('Failed to submit comment:', error);
            let errorMessage = 'Failed to submit comment: ' + (error instanceof Error ? error.message : 'Unknown error');

            // Provide more helpful error messages for NIP-07 issues
            if (error instanceof Error) {
                if (error.message.includes('NIP-07')) {
                    if (error.message.includes('extension is unlocked')) {
                        errorMessage = 'Please unlock your Nostr extension (nos2x/Alby) and try again.';
                    } else if (error.message.includes('getPublicKey')) {
                        errorMessage = 'Please authorize this website in your Nostr extension.';
                    } else {
                        errorMessage = 'Nostr extension error. Please check if your extension is working properly.';
                    }
                }
            }

            this.showError(errorMessage);
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

    // Find the root id for a given comment id by walking up the tree
    private findRootAndParent(targetId: string): { rootId?: string; parentId?: string } {
        let rootId: string | undefined;
        let parentId: string | undefined;

        const dfs = (nodes: Comment[], currentRoot?: string, currentParent?: string): boolean => {
            for (const node of nodes) {
                const thisRoot = currentRoot ?? node.id;
                if (node.id === targetId) {
                    rootId = thisRoot;
                    parentId = currentParent;
                    return true;
                }
                if (node.replies?.length) {
                    if (dfs(node.replies, thisRoot, node.id)) return true;
                }
            }
            return false;
        };
        dfs(this.comments);
        return { rootId, parentId };
    }

    startReply = (commentId: string): void => {
        // Cancel any existing reply first
        this.replyingToComment = null;
        this.render();

        // Then start new reply
        setTimeout(() => {
            this.replyingToComment = commentId;
            this.render();

            // Focus the textarea in the inline reply form after render (but don't scroll)
            setTimeout(() => {
                // Find the inline reply form textarea, not the main form one
                const inlineForm = this.shadow.querySelector('.inline-reply-form');
                const textarea = inlineForm?.querySelector('[data-role="comment-input"]') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.focus();
                    // Don't scroll - let the user stay where they are
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

            // Initialize user first to set up identity properly
            await this.initializeUser();

            // Load comments after user initialization
            this.loadComments();

            // Set up periodic check for NIP-07 extension state changes
            this.setupNip07StateMonitoring();

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
        // Clean up event listeners to prevent memory leaks
        this.removeEventListeners();

        // Clean up NIP-07 monitoring interval
        if (this.nip07MonitoringInterval) {
            clearInterval(this.nip07MonitoringInterval);
            this.nip07MonitoringInterval = null;
        }
    }

    attachEventListeners() {
        // Clear existing listeners first
        this.removeEventListeners();

        // Handle both main form and inline form submit buttons
        this.shadow.querySelectorAll('[data-role="submit-comment"]').forEach(submitButton => {
            const handler = (e: Event) => {
                e.preventDefault();
                const form = (e.target as HTMLElement).closest('.comment-form, .inline-reply-form');
                const textarea = form?.querySelector('[data-role="comment-input"]') as HTMLTextAreaElement;
                if (textarea) {
                    this.submitComment(textarea.value);
                }
            };
            submitButton.addEventListener('click', handler);
            this.eventListeners.push({ element: submitButton, type: 'click', handler });
        });

        // Handle textareas (main form and inline forms)
        this.shadow.querySelectorAll('[data-role="comment-input"]').forEach(textarea => {
            // Allow Ctrl+Enter to submit
            const handler = (e: Event) => {
                const keyEvent = e as KeyboardEvent;
                if (keyEvent.key === 'Enter' && (keyEvent.ctrlKey || keyEvent.metaKey)) {
                    keyEvent.preventDefault();
                    this.submitComment((textarea as HTMLTextAreaElement).value);
                }
            };
            textarea.addEventListener('keydown', handler);
            this.eventListeners.push({ element: textarea, type: 'keydown', handler });
        });

        // Cancel reply buttons
        this.shadow.querySelectorAll('[data-role="cancel-reply"]').forEach(cancelButton => {
            const handler = (e: Event) => {
                e.preventDefault();
                this.cancelReply();
            };
            cancelButton.addEventListener('click', handler);
            this.eventListeners.push({ element: cancelButton, type: 'click', handler });
        });

        // Reply buttons for each comment
        this.shadow.querySelectorAll('.reply-button').forEach(button => {
            const handler = (e: Event) => {
                e.preventDefault();
                const commentId = (e.currentTarget as HTMLElement).getAttribute('data-comment-id');
                if (commentId) {
                    this.startReply(commentId);
                }
            };
            button.addEventListener('click', handler);
            this.eventListeners.push({ element: button, type: 'click', handler });
        });

        // Identity toggle buttons (handle all buttons, both main form and inline forms)
        this.shadow.querySelectorAll('[data-role="toggle-as-user"]').forEach(btnUser => {
            if (!this.hasNip07) {
                (btnUser as HTMLButtonElement).disabled = true;
                (btnUser as HTMLButtonElement).title = 'NIP-07 extension not detected';
            } else {
                const handler = async (e: Event) => {
                    e.preventDefault();
                    if (this.commentAs !== 'user') {
                        this.commentAs = 'user';
                        this.userPrivateKey = null; // ensure nip07 signing path
                        this.anonPrivateKeyHex = null; // clear anon key when switching to user
                        await this.initializeUser();
                    }
                };
                btnUser.addEventListener('click', handler);
                this.eventListeners.push({ element: btnUser, type: 'click', handler });
            }
        });

        this.shadow.querySelectorAll('[data-role="toggle-as-anon"]').forEach(btnAnon => {
            // Anonymous toggle is always enabled
            (btnAnon as HTMLButtonElement).disabled = false;
            const handler = async (e: Event) => {
                e.preventDefault();
                if (this.commentAs !== 'anon') {
                    this.commentAs = 'anon';
                    this.userPublicKey = null; // Clear so initializeUser will set up anon identity
                    this.userPrivateKey = null; // Clear user key to force anon path
                    await this.initializeUser();
                }
            };
            btnAnon.addEventListener('click', handler);
            this.eventListeners.push({ element: btnAnon, type: 'click', handler });
        });
    }

    attachAvatarErrorHandlers() {
        // Add error handlers for all avatar images to provide fallbacks
        this.shadow.querySelectorAll('img[src]').forEach(img => {
            const handler = (e: Event) => {
                const target = e.target as HTMLImageElement;
                target.src = './assets/default_dp.png';
            };
            img.addEventListener('error', handler);
            this.eventListeners.push({ element: img, type: 'error', handler });
        });
    }

    private removeEventListeners() {
        this.eventListeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.eventListeners = [];
    }

    private showError(message: string) {
        // Create a user-friendly error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'nostr-comment-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;
        errorDiv.textContent = message;

        document.body.appendChild(errorDiv);

        // Auto-remove after 8 seconds for NIP-07 errors
        const timeout = message.includes('NIP-07') ? 8000 : 5000;
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, timeout);
    }

    private async ensureAnonKey(): Promise<string> {
        const storageKey = 'nostr-comment-anon-private-key';

        try {
            // Try to read existing key from localStorage
            const stored = localStorage.getItem(storageKey);
            if (stored && stored.match(/^[a-f0-9]{64}$/)) {
                return stored;
            }
        } catch (error) {
            console.warn('Failed to read from localStorage:', error);
        }

        // Generate new key
        const { generateSecretKey } = await import('nostr-tools/pure');
        const newKey = Array.from(generateSecretKey()).map(b => b.toString(16).padStart(2, '0')).join('');

        try {
            // Try to persist to localStorage
            localStorage.setItem(storageKey, newKey);
        } catch (error) {
            console.warn('Failed to write to localStorage, using ephemeral key:', error);
        }

        return newKey;
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
            this.replyingToComment,
            this.commentAs,
            this.hasNip07
        );

        // Sanitize only the dynamic content to prevent XSS attacks
        const sanitizedContent = DOMPurify.sanitize(contentHTML, {
            ALLOWED_TAGS: ['div', 'span', 'button', 'textarea', 'img', 'a', 'h3', 'h4', 'p', 'ul', 'li', 'small', 'strong', 'em'],
            ALLOWED_ATTR: ['class', 'id', 'data-role', 'data-comment-id', 'data-depth', 'style', 'src', 'alt', 'href', 'target', 'rel', 'placeholder', 'rows', 'disabled'],
            ALLOW_DATA_ATTR: true
        });

        // Combine styles and sanitized content for shadow DOM
        this.shadow.innerHTML = `
      ${getCommentStyles(this.theme)}
      <div class="nostr-comment-wrapper">
        ${sanitizedContent}
      </div>
    `;

        this.attachEventListeners();
        this.attachAvatarErrorHandlers();
    }
}

// Guard against duplicate registration
if (!customElements.get('nostr-comment')) {
    customElements.define('nostr-comment', NostrComment);
}
