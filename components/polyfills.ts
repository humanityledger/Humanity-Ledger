/* eslint-disable */
"use client";

import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
    if (!window.Buffer) {
        window.Buffer = Buffer;
    }
    if (!window.global) {
        window.global = window as any;
    }
    if (!window.process) {
        window.process = { env: {} } as any;
    }
}

