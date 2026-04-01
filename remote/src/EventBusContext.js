import { createContext, useContext } from 'react';

export const EventBusContext = createContext(null);

export const useEventBus = () => useContext(EventBusContext);
