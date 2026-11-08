/**
 * The old deployment listed the pipes at `/pipe/`, so that URL still lists
 * them. The same page, not a redirect: a redirect would have to be relative
 * (the browser's path differs from the Worker's on a frame subdomain) and a
 * relative Location cannot be right for both `/pipe` and `/pipe/`, which
 * arrive here indistinguishable — see pipes.ts.
 */
export { default } from "../index.tsx";
