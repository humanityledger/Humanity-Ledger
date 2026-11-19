'use client';
/**
 * One motion vocabulary for the island and the call window. Springs close to iOS: a capsule that
 * grows settles in about 0.4 s with no visible bounce; a thrown window lands with a soft one.
 * With "reduce motion" every change is a 120 ms cross-fade and nothing moves.
 */
import { useReducedMotion, type Transition } from 'framer-motion';

export const SPRING_MORPH: Transition = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 };
export const SPRING_THROW: Transition = { type: 'spring', stiffness: 360, damping: 30, mass: 1 };
export const FADE: Transition = { duration: 0.12, ease: [0.4, 0, 0.2, 1] };

export interface MotionPreset {
  reduced: boolean;
  morph: Transition;
  throw: Transition;
  /** enter/exit for whole surfaces */
  appear: { initial: object; animate: object; exit: object; transition: Transition };
}

export function useMotionPreset(): MotionPreset {
  const reduced = !!useReducedMotion();
  return reduced
    ? {
        reduced,
        morph: FADE,
        throw: FADE,
        appear: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: FADE },
      }
    : {
        reduced,
        morph: SPRING_MORPH,
        throw: SPRING_THROW,
        appear: {
          initial: { opacity: 0, scale: 0.9, filter: 'blur(4px)' },
          animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, scale: 0.92, filter: 'blur(4px)' },
          transition: SPRING_MORPH,
        },
      };
}
