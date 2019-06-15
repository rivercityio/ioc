import {NOCACHE} from "../ioc/inject";

type Listener = () => void;
type Unsubscribe = () => void;

interface Subscriber {
    [name: string]: Listener | undefined;
}

interface Subscribable {
    [name: string]: ((listener: Listener) => Unsubscribe | undefined) | undefined;
}

interface ListenerConfig {
    trigger: string;
    unsubscribe: string;
}

export const SUBSCRIBE = Symbol("subscribe");

function plugin(target: Subscriber | null, value: Subscribable, args: symbol[], subscribeTo: string[], configs: ListenerConfig[]) {

    // We need a target and a value
    if (!target || typeof target !== "object") return;
    if (!value || typeof value !== "object") return;

    // Only if SUBSCRIBE is passed and do not subscribe with NOCACHE flag
    if (args.indexOf(SUBSCRIBE) === -1 || args.indexOf(NOCACHE) !== -1) return;

    // The dependent needs a function to listen with
    let listener: (() => void) | undefined;
    let unsubscribeWith: string | undefined;
    for (const config of configs) {
        const trigger = target[config.trigger];
        if (typeof trigger === "function") {
            listener = trigger;
            unsubscribeWith = config.unsubscribe;
            break;
        }
    }

    if (!listener) return;

    // The dependency needs to have a function to subscribe to
    let unsubscribe: (() => void) | undefined;
    for (const sub of subscribeTo) {
        const fn = value[sub];
        if (typeof fn === "function") {
            unsubscribe = fn(listener);
        }
    }

    if (!unsubscribe) return;
    if (!unsubscribeWith) return;

    const unlink = target[unsubscribeWith];
    if (typeof unlink === "function") {
        target[unsubscribeWith] = () => {
            unlink();
            unsubscribe && unsubscribe();
        };
    } else {
        target[unsubscribeWith] = unsubscribe;
    }
}

export function createSubescribePlugin(subscribeTo: string[], configs: ListenerConfig[]) {
    return (target: Subscriber | null, _property: string | null, value: Subscribable, _type: symbol, args: symbol[]) => {
        plugin(target, value, args, subscribeTo, configs)
    }
}
