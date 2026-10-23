import * as React from 'react';
import { getInstance } from '@module-federation/enhanced/runtime';

const MessageLazy = React.lazy(() => {
    const mf = getInstance();
    console.log('[debug] MF instance:', mf);
    console.log('[debug] MF plugins:', mf?.options?.plugins?.map(p => p.name));
    return mf.loadRemote('viteRemote2/Message')
        .then((m) => {
            // React.lazy requires { default: Component }
            if (m?.default) return m;
            return { default: m };
        })
        .catch((error) => {
            console.error('[debug] loadRemote failed:', error.message);
            throw new Error(`Message Remote Error: ${error.message}`);
        });
});

const MessageRemote = () => {
    return (
        <React.Suspense fallback={<div>loading...</div>}>
            <MessageLazy />
        </React.Suspense>
    );
};

export default MessageRemote;