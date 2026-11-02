"use client";

import React, { useEffect, useRef, useMemo } from 'react';

interface LottiePlayerProps {
    animationData: any;
    className?: string;
    loop?: boolean;
    autoplay?: boolean;
    style?: React.CSSProperties;
    width?: string | number;
    height?: string | number;
    speed?: number;
}

export const LottiePlayer = ({
    animationData,
    className,
    loop = true,
    autoplay = true,
    style,
    width = '100%',
    height = '100%',
    speed
}: LottiePlayerProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<any>(null);

    const lottieStyle = useMemo(() => ({
        width,
        height,
        ...style
    }), [width, height, style]);

    useEffect(() => {
        if (!containerRef.current || !animationData) return;

        let isMounted = true;
        let localInstance: any = null;

        import('lottie-web').then((lottieModule) => {
            if (!isMounted) return;
            const lottie = lottieModule.default || lottieModule;
            
            try {
                localInstance = lottie.loadAnimation({
                    container: containerRef.current!,
                    renderer: 'svg',
                    loop,
                    autoplay,
                    animationData,
                    rendererSettings: {
                        preserveAspectRatio: 'xMidYMid meet',
                        progressiveLoad: true,
                        hideOnTransparent: true
                    }
                });
                
                if (speed !== undefined) {
                    localInstance.setSpeed(speed);
                }
                
                instanceRef.current = localInstance;
            } catch (err) {
                console.error('Lottie init error:', err);
            }
        });

        return () => {
            isMounted = false;
            try {
                if (instanceRef.current) {
                    instanceRef.current.destroy();
                } else if (localInstance) {
                    localInstance.destroy();
                }
            } catch (e) {
                // Suppresses React 18 strict-mode double-invoke destroy crash.
            } finally {
                instanceRef.current = null;
            }
        };
    // speed intentionally excluded  handled by dedicated effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animationData, loop, autoplay]);

    // Dedicated effect: update playback speed without re-creating the animation.
    useEffect(() => {
        if (instanceRef.current && speed !== undefined) {
            instanceRef.current.setSpeed(speed);
        }
    }, [speed]);

    if (!animationData) return null;

    return <div ref={containerRef} className={className} style={lottieStyle} />;
};
