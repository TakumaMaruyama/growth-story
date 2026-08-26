'use client';

import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_MESSAGE = '保存していない変更があります。このページから移動しますか？';

export function useUnsavedChangesWarning(
    hasChanges: boolean,
    message = DEFAULT_MESSAGE,
): () => boolean {
    const allowNavigationRef = useRef(false);

    const confirmNavigation = useCallback(() => {
        if (!hasChanges) return true;
        if (!window.confirm(message)) return false;

        allowNavigationRef.current = true;
        window.setTimeout(() => {
            allowNavigationRef.current = false;
        }, 0);
        return true;
    }, [hasChanges, message]);

    useEffect(() => {
        if (!hasChanges) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (allowNavigationRef.current) return;
            event.preventDefault();
            event.returnValue = '';
        };

        const handleDocumentClick = (event: MouseEvent) => {
            if (
                event.defaultPrevented
                || event.button !== 0
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || event.altKey
            ) {
                return;
            }

            const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || target.hasAttribute('download')) {
                return;
            }

            const destination = new URL(target.href, window.location.href);
            const current = new URL(window.location.href);
            if (
                destination.origin === current.origin
                && destination.pathname === current.pathname
                && destination.search === current.search
            ) {
                return;
            }

            if (!confirmNavigation()) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('click', handleDocumentClick, true);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('click', handleDocumentClick, true);
        };
    }, [confirmNavigation, hasChanges]);

    return confirmNavigation;
}
