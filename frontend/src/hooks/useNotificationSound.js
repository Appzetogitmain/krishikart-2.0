import { useCallback, useEffect, useRef } from 'react';
import sellerAlert from '@/assets/sounds/seller_alert.mp3';

// How often the beep fallback repeats while ringing (used only if the mp3 can't play)
const RING_FALLBACK_INTERVAL_MS = 2000;

// Synthesised two-tone buzzer, used when the mp3 is blocked or fails to play
function playFallbackBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playBeep = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
            gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + startTime);
            osc.stop(ctx.currentTime + startTime + duration);
        };

        // Buzzer-like pattern
        playBeep(880, 0, 0.15);
        playBeep(1108.73, 0.15, 0.25);

        setTimeout(() => {
            playBeep(880, 0, 0.15);
            playBeep(1108.73, 0.15, 0.25);
        }, 800);

        if (ctx.state === 'suspended') ctx.resume();
        // Each beep gets its own context; release it once the pattern is done
        setTimeout(() => ctx.close?.(), 2000);
    } catch (_) {
        // Silent fallback
    }
}

/**
 * Hook to manage notification sound alerts with browser autoplay priming.
 * @returns {Object} { playNotificationSound, startRinging, stopRinging }
 */
export function useNotificationSound() {
    const audioRef = useRef(null);
    const hasPrimedAudioRef = useRef(false);
    const ringAudioRef = useRef(null);
    const ringFallbackTimerRef = useRef(null);
    const isRingingRef = useRef(false);

    // Initialise audio on mount if not already done
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(sellerAlert);
        }
    }, []);

    // Prime audio on first user interaction so browser autoplay policies don't block alerts later.
    useEffect(() => {
        if (hasPrimedAudioRef.current) return;

        const prime = () => {
            if (hasPrimedAudioRef.current) return;
            try {
                const audio = audioRef.current || new Audio(sellerAlert);
                audioRef.current = audio;
                
                // Mute and play/pause immediately to "prime" the audio context
                audio.muted = true;
                const p = audio.play();
                
                if (p && typeof p.then === 'function') {
                    p.then(() => {
                        audio.pause();
                        audio.muted = false;
                        audio.currentTime = 0;
                        hasPrimedAudioRef.current = true;
                    }).catch(() => {
                        // Priming failed, will try oscillator fallback in playNotificationSound
                    });
                } else {
                    audio.pause();
                    audio.muted = false;
                    audio.currentTime = 0;
                    hasPrimedAudioRef.current = true;
                }
            } catch (_) {
                // Silently fail priming
            } finally {
                window.removeEventListener('click', prime);
                window.removeEventListener('touchstart', prime);
                window.removeEventListener('keydown', prime);
            }
        };

        window.addEventListener('click', prime, { once: true });
        window.addEventListener('touchstart', prime, { once: true });
        window.addEventListener('keydown', prime, { once: true });

        return () => {
            window.removeEventListener('click', prime);
            window.removeEventListener('touchstart', prime);
            window.removeEventListener('keydown', prime);
        };
    }, []);

    const playNotificationSound = useCallback(() => {
        const fallbackBeep = playFallbackBeep;

        try {
            const audio = audioRef.current || new Audio(sellerAlert);
            audioRef.current = audio;
            audio.volume = 1.0;
            audio.currentTime = 0;
            const playPromise = audio.play();

            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => fallbackBeep());
            }
        } catch (_) {
            fallbackBeep();
        }
    }, []);

    /** Keep the alert sound repeating until stopRinging() is called. Safe to call more than once. */
    const startRinging = useCallback(() => {
        if (isRingingRef.current) return;
        isRingingRef.current = true;

        const startFallbackLoop = () => {
            if (ringFallbackTimerRef.current || !isRingingRef.current) return;
            playFallbackBeep();
            ringFallbackTimerRef.current = setInterval(playFallbackBeep, RING_FALLBACK_INTERVAL_MS);
        };

        try {
            // A separate element, so one-off alerts played meanwhile don't restart or stop the ring
            const audio = ringAudioRef.current || new Audio(sellerAlert);
            ringAudioRef.current = audio;
            audio.loop = true;
            audio.volume = 1.0;
            audio.currentTime = 0;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(startFallbackLoop);
            }
        } catch (_) {
            startFallbackLoop();
        }
    }, []);

    const stopRinging = useCallback(() => {
        isRingingRef.current = false;
        if (ringFallbackTimerRef.current) {
            clearInterval(ringFallbackTimerRef.current);
            ringFallbackTimerRef.current = null;
        }
        const audio = ringAudioRef.current;
        if (audio) {
            audio.loop = false;
            audio.pause();
            audio.currentTime = 0;
        }
    }, []);

    // Never keep ringing after the screen that started it is gone
    useEffect(() => () => {
        isRingingRef.current = false;
        if (ringFallbackTimerRef.current) clearInterval(ringFallbackTimerRef.current);
        if (ringAudioRef.current) ringAudioRef.current.pause();
    }, []);

    return { playNotificationSound, startRinging, stopRinging };
}
