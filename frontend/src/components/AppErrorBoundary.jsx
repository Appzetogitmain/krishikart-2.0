import { Component } from 'react';

/*
 * After a deploy, a tab or app that was already open still runs the old code. Opening another page then
 * asks for a code file that no longer exists and the page fails to load. In that case reload once to get
 * the new version. Any other error shows a "Reload" screen instead of a blank page.
 */

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|is not a valid JavaScript MIME type|ChunkLoadError|Loading chunk .* failed/i;
const RELOAD_KEY = 'kk:chunkReloadAt';

export const isChunkError = (error) => CHUNK_ERROR.test(String(error?.message || error || ''));

/** Reload once to pick up the new version; returns false if we already did that in the last 30 seconds. */
export function reloadForNewVersion() {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < 30000) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
        // storage blocked: still reload once
    }
    window.location.reload();
    return true;
}

export default class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        console.error('[app] page crashed:', error);
        if (isChunkError(error)) reloadForNewVersion();
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
                <div style={{ maxWidth: 360, textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Something went wrong</p>
                    <p style={{ fontSize: 15, color: '#475569', margin: '0 0 20px' }}>Please reload the page. If you just got an update, this loads the latest version.</p>
                    <button type="button" onClick={() => window.location.reload()}
                        style={{ height: 48, padding: '0 28px', borderRadius: 12, border: 0, background: '#15803d', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}
