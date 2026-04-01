import * as React from 'react';
import { emitter } from './utils/bus';

const ButtonLazy = React.lazy(() => {
    return import('viteRemote/Button')
        .then((m) => {
            emitter.emit('remote:loaded', { name: 'viteRemote/Button' });
            if (m?.default) return m;
            return { default: m };
        })
        .catch((error) => {
            console.error('[debug] loadRemote failed:', error.message);
            throw new Error(`Button Remote Error: ${error.message}`);
        });
});

const ButtonRemote = () => {
    return (
        <React.Suspense fallback={<div>loading...</div>}>
            <ButtonLazy emitter={emitter} />
        </React.Suspense>
    );
};

export default ButtonRemote;