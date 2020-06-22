interface IConfig<T> {
    object?: INewAble<T>;
    factory?: Factory<T>;
    value?: Value<T>;
    singleton: boolean;
}

interface INewAble<T> {
    new (container: Container, ...args: any[]): T;
}

type Registry = Map<symbol, IConfig<any>>;
type Cache = Map<symbol, any>;

type Factory<T> = (container: Container) => T;
type Value<T> = T;

class Options<T> {
    constructor(private _target: IConfig<T>) {}

    inSingletonScope() {
        this._target.singleton = true;
    }
}

class Bind<T> {
    constructor(private _target: IConfig<T>) {}

    to(object: INewAble<T>): Options<T> {
        this._target.object = object;
        return new Options<T>(this._target);
    }

    toFactory(factory: Factory<T>): Options<T> {
        this._target.factory = factory;
        return new Options<T>(this._target);
    }

    toValue(value: Value<T>): void {
        if (typeof value === "undefined") {
            throw "cannot bind a value of type undefined";
        }
        this._target.value = value;
    }
}

export class Container {
    private _registry: Registry = new Map<symbol, IConfig<any>>();
    private _snapshots: Registry[] = [];
    private _cache: Cache = new Map<symbol, any>();
    private _parent: Container | null = null;

    bind<T = never>(type: symbol): Bind<T> {
        return new Bind<T>(this._add<T>(type));
    }

    rebind<T = never>(type: symbol): Bind<T> {
        return this.remove(type).bind<T>(type);
    }

    remove(type: symbol): Container {
        if (this._registry.get(type) === undefined) {
            throw `${type.toString()} was never bound`;
        }

        this._registry.delete(type);
        this._cache.delete(type);

        return this;
    }

    get<T = never>(type: symbol, targetContainer = this): T {
        const regItem = this._registry.get(type);

        if ((regItem === undefined) && this._parent !== null) {
            return this._parent.get(type, targetContainer);
        }

        if (regItem === undefined) {
            throw `nothing bound to ${type.toString()}`;
        }

        const {object, factory, value, singleton} = regItem;

        const cacheItem = (creator: () => T): T => {

            if (singleton && typeof targetContainer._cache.get(type) !== "undefined") return targetContainer._cache.get(type);
            if (!singleton) return creator();
            targetContainer._cache.set(type, creator());
            return targetContainer._cache.get(type);
        };

        if (typeof value !== "undefined") return value;
        if (typeof object !== "undefined") return cacheItem(() => new object(targetContainer));
        if (typeof factory !== "undefined") return cacheItem(() => factory(targetContainer));

        throw `nothing is bound to ${type.toString()}`;
    }

    snapshot(): Container {
        this._snapshots.push(new Map(this._registry));
        return this;
    }

    restore(): Container {
        this._registry = this._snapshots.pop() || this._registry;
        return this;
    }

    private _add<T>(type: symbol): IConfig<T> {
        if (this._registry.get(type) !== undefined) {
            throw `object can only bound once: ${type.toString()}`;
        }

        const conf = {singleton: false};
        this._registry.set(type, conf);

        return conf;
    }

    public createChild(): Container {
        const child = new Container();
        child._parent = this;
        return child;
    }

    public createParent(): Container {
        const parent = new Container();
        this._parent = parent;
        return parent;
    }

    public getParent(): Container | null {
        return this._parent;
    }

    public removeParent(): Container {
        this._parent = null;

        return this;
    }
}
