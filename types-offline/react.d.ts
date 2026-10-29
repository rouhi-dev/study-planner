/**
 * Minimal offline type declarations for React 19.
 *
 * The build environment for this project had no access to the npm registry,
 * so `@types/react` could not be installed. This shim covers exactly the React
 * API surface the app uses so that `npm run typecheck:offline` gives strict
 * type checking. With network access, install the real `@types/react` and
 * `@types/react-dom` and run `npm run typecheck` instead (this folder is then
 * unused).
 */
declare module 'react' {
  export type Key = string | number | bigint;
  export interface ReactElement<P = unknown> {
    type: unknown;
    props: P;
    key: string | null;
  }
  export type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export interface RefObject<T> {
    current: T;
  }
  export type RefCallback<T> = (instance: T | null) => void | (() => void);
  export type Ref<T> = RefObject<T | null> | RefCallback<T> | null;

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: never[]) => unknown>(cb: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useRef<T = undefined>(): RefObject<T | undefined>;
  export function useId(): string;
  export function useSyncExternalStore<T>(
    subscribe: (cb: () => void) => () => void,
    getSnapshot: () => T,
  ): T;

  export interface ProviderProps<T> {
    value: T;
    children?: ReactNode;
  }
  export interface Context<T> {
    Provider: (props: ProviderProps<T>) => ReactNode;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;

  export type ComponentType<P = object> = (props: P) => ReactNode;
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  export const Fragment: (props: { children?: ReactNode; key?: Key }) => ReactNode;
  export const StrictMode: (props: { children?: ReactNode }) => ReactNode;

  // ---- events ---------------------------------------------------------
  export interface SyntheticEvent<T = Element, E = Event> {
    currentTarget: T;
    target: EventTarget;
    nativeEvent: E;
    defaultPrevented: boolean;
    preventDefault(): void;
    stopPropagation(): void;
  }
  export interface MouseEvent<T = Element> extends SyntheticEvent<T, globalThis.MouseEvent> {
    clientX: number;
    clientY: number;
    button: number;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }
  export interface PointerEvent<T = Element> extends MouseEvent<T> {
    pointerId: number;
  }
  export interface DragEvent<T = Element> extends MouseEvent<T> {
    dataTransfer: DataTransfer;
  }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, globalThis.KeyboardEvent> {
    key: string;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }
  export interface FocusEvent<T = Element> extends SyntheticEvent<T, globalThis.FocusEvent> {
    relatedTarget: EventTarget | null;
  }
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & T;
  }
  export type FormEvent<T = Element> = SyntheticEvent<T>;

  type Handler<E> = (event: E) => void;

  export type CSSProperties = { [property: string]: string | number | undefined };

  export interface DOMAttributes<T> {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    onClick?: Handler<MouseEvent<T>>;
    onDoubleClick?: Handler<MouseEvent<T>>;
    onMouseDown?: Handler<MouseEvent<T>>;
    onMouseEnter?: Handler<MouseEvent<T>>;
    onMouseLeave?: Handler<MouseEvent<T>>;
    onPointerDown?: Handler<PointerEvent<T>>;
    onPointerUp?: Handler<PointerEvent<T>>;
    onKeyDown?: Handler<KeyboardEvent<T>>;
    onKeyUp?: Handler<KeyboardEvent<T>>;
    onFocus?: Handler<FocusEvent<T>>;
    onBlur?: Handler<FocusEvent<T>>;
    onChange?: Handler<ChangeEvent<T>>;
    onInput?: Handler<FormEvent<T>>;
    onSubmit?: Handler<FormEvent<T>>;
    onDragStart?: Handler<DragEvent<T>>;
    onDragEnd?: Handler<DragEvent<T>>;
    onDragOver?: Handler<DragEvent<T>>;
    onDragEnter?: Handler<DragEvent<T>>;
    onDragLeave?: Handler<DragEvent<T>>;
    onDrop?: Handler<DragEvent<T>>;
  }

  export interface AriaAttributes {
    [aria: `aria-${string}`]: string | number | boolean | undefined;
  }
  export interface DataAttributes {
    [data: `data-${string}`]: string | number | boolean | undefined;
  }

  export interface HTMLAttributes<T> extends DOMAttributes<T>, AriaAttributes, DataAttributes {
    key?: Key | null;
    ref?: Ref<T>;
    id?: string;
    className?: string;
    style?: CSSProperties;
    title?: string;
    role?: string;
    tabIndex?: number;
    dir?: 'rtl' | 'ltr' | 'auto';
    lang?: string;
    hidden?: boolean;
    draggable?: boolean;
    inert?: boolean;
    // form / media / link attributes (kept loose on purpose: one shared bag)
    type?: string;
    name?: string;
    value?: string | number | readonly string[];
    defaultValue?: string | number;
    checked?: boolean;
    disabled?: boolean;
    placeholder?: string;
    required?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    autoComplete?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    maxLength?: number;
    rows?: number;
    htmlFor?: string;
    href?: string;
    target?: string;
    rel?: string;
    accept?: string;
    form?: string;
    inputMode?: 'none' | 'text' | 'numeric' | 'decimal' | 'search' | 'email' | 'tel' | 'url';
    spellCheck?: boolean;
    open?: boolean;
    colSpan?: number;
    scope?: string;
    list?: string;
    pattern?: string;
    noValidate?: boolean;
  }

  export type ButtonHTMLAttributes<T> = HTMLAttributes<T>;
  export type InputHTMLAttributes<T> = HTMLAttributes<T>;
  export type TextareaHTMLAttributes<T> = HTMLAttributes<T>;
  export type SelectHTMLAttributes<T> = HTMLAttributes<T>;
  export type AnchorHTMLAttributes<T> = HTMLAttributes<T>;

  export interface SVGAttributes<T> extends DOMAttributes<T>, AriaAttributes, DataAttributes {
    key?: Key | null;
    ref?: Ref<T>;
    className?: string;
    style?: CSSProperties;
    role?: string;
    viewBox?: string;
    width?: string | number;
    height?: string | number;
    x?: string | number;
    y?: string | number;
    x1?: string | number;
    x2?: string | number;
    y1?: string | number;
    y2?: string | number;
    cx?: string | number;
    cy?: string | number;
    r?: string | number;
    rx?: string | number;
    d?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: string | number;
    strokeLinecap?: 'butt' | 'round' | 'square';
    strokeDasharray?: string | number;
    strokeDashoffset?: string | number;
    transform?: string;
    textAnchor?: string;
    dominantBaseline?: string;
    fontSize?: string | number;
    opacity?: string | number;
    preserveAspectRatio?: string;
    xmlns?: string;
    focusable?: boolean | 'true' | 'false';
  }
}

declare module 'react/jsx-runtime' {
  import type { HTMLAttributes, Key, ReactElement, ReactNode, SVGAttributes } from 'react';
  export namespace JSX {
    type ElementType = string | ((props: never) => ReactNode);
    interface Element extends ReactElement {}
    interface ElementChildrenAttribute {
      children: object;
    }
    interface IntrinsicAttributes {
      key?: Key | null;
    }
    type IntrinsicElements = {
      [K in keyof HTMLElementTagNameMap]: HTMLAttributes<HTMLElementTagNameMap[K]>;
    } & {
      [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: SVGAttributes<
        SVGElementTagNameMap[K]
      >;
    };
  }
  export function jsx(type: unknown, props: unknown, key?: Key): ReactElement;
  export function jsxs(type: unknown, props: unknown, key?: Key): ReactElement;
  export const Fragment: unknown;
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'react-icons/lu' {
  import type { ReactNode, SVGAttributes } from 'react';
  export interface IconBaseProps extends SVGAttributes<SVGElement> {
    size?: string | number;
    color?: string;
    title?: string;
  }
  export type IconType = (props: IconBaseProps) => ReactNode;
  export const LuArrowDown: IconType;
  export const LuArrowUp: IconType;
  export const LuBookOpen: IconType;
  export const LuBrain: IconType;
  export const LuBriefcase: IconType;
  export const LuCalendarClock: IconType;
  export const LuCalendarDays: IconType;
  export const LuCalendarPlus: IconType;
  export const LuCalendarRange: IconType;
  export const LuChartColumn: IconType;
  export const LuCheck: IconType;
  export const LuChevronLeft: IconType;
  export const LuChevronRight: IconType;
  export const LuCircleCheck: IconType;
  export const LuCircleDashed: IconType;
  export const LuCircle: IconType;
  export const LuClipboardCheck: IconType;
  export const LuClock: IconType;
  export const LuCoffee: IconType;
  export const LuDownload: IconType;
  export const LuEllipsis: IconType;
  export const LuFilter: IconType;
  export const LuFlag: IconType;
  export const LuGraduationCap: IconType;
  export const LuGripVertical: IconType;
  export const LuHistory: IconType;
  export const LuHouse: IconType;
  export const LuInfo: IconType;
  export const LuLayoutDashboard: IconType;
  export const LuLightbulb: IconType;
  export const LuLink: IconType;
  export const LuListChecks: IconType;
  export const LuMenu: IconType;
  export const LuMoon: IconType;
  export const LuPause: IconType;
  export const LuPencil: IconType;
  export const LuPlay: IconType;
  export const LuPlus: IconType;
  export const LuRepeat: IconType;
  export const LuRotateCcw: IconType;
  export const LuSearch: IconType;
  export const LuSettings: IconType;
  export const LuSparkles: IconType;
  export const LuSquare: IconType;
  export const LuStickyNote: IconType;
  export const LuSun: IconType;
  export const LuTarget: IconType;
  export const LuTimer: IconType;
  export const LuTrash2: IconType;
  export const LuTriangleAlert: IconType;
  export const LuUpload: IconType;
  export const LuUser: IconType;
  export const LuX: IconType;
}
