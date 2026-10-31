/**
 * React shim - provides React from the game's API at runtime.
 * This allows JSX to work in mod files.
 *
 * At build time, Vite aliases 'react' and 'react/jsx-runtime' imports to this file.
 * At runtime, we pull React from the game's API.
 */

// Get React from the game's API
const React = window.SubwayBuilderAPI.utils.React;

export default React;
export const {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useReducer,
  useContext,
  createContext,
  createElement,
  Fragment,
} = React;

// JSX runtime exports for the automatic JSX transform.
// The automatic runtime calls jsx(type, propsWithChildren, key); createElement would
// treat that third argument as children, so fold the key back into the props.
function jsxRuntime(type: unknown, props: Record<string, unknown> | null, key?: unknown) {
  const finalProps = key === undefined ? props : { ...(props ?? {}), key };
  return (React.createElement as (type: unknown, props: unknown) => unknown)(type, finalProps);
}
export const jsx = jsxRuntime;
export const jsxs = jsxRuntime;
export const jsxDEV = jsxRuntime;
