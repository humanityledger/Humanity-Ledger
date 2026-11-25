'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { t } from '@/lib/i18n/client';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SafeErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error in SafeErrorBoundary:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-900 text-sm">
                    <div className="font-bold mb-1">{t("Component Error")}</div>
                    <p className="opacity-80">
                        {this.state.error?.message || t("Something went wrong while rendering this component.")}
                    </p>
                    <button 
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-3 text-xs font-bold underline hover:text-red-700"
                    >
                        {t("Try again")}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

