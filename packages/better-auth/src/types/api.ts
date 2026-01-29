import type { Endpoint } from "better-call";
import type { PrettifyDeep, UnionToIntersection } from "../types/helper";

export type FilteredAPI<API> = Omit<
	API,
	API extends { [key in infer K]: Endpoint }
		? K extends string
			? K extends "getSession"
				? never
				: API[K]["options"]["metadata"] extends
							| { isAction: false }
							| { scope: "http" }
					? K
					: never
			: never
		: never
>;

/**
 * Default getSession signature used as a fallback when type inference fails.
 * This ensures getSession is always available on auth.api even with complex
 * plugin configurations that cause TypeScript inference to fall back to `any`.
 */
export type DefaultSessionAPI = {
	getSession: <R extends boolean = false, H extends boolean = false>(context: {
		headers: Headers;
		query?:
			| {
					disableCookieCache?: boolean;
					disableRefresh?: boolean;
			  }
			| undefined;
		asResponse?: R | undefined;
		returnHeaders?: H | undefined;
	}) => false extends R
		? H extends true
			? Promise<{
					headers: Headers;
					response: { session: any; user: any } | null;
				}>
			: Promise<{ session: any; user: any } | null>
		: Promise<Response>;
};

export type InferSessionAPI<API> = API extends {
	[key: string]: infer E;
}
	? UnionToIntersection<
			E extends Endpoint
				? E["path"] extends "/get-session"
					? {
							getSession: <
								R extends boolean = false,
								H extends boolean = false,
							>(context: {
								headers: Headers;
								query?:
									| {
											disableCookieCache?: boolean;
											disableRefresh?: boolean;
									  }
									| undefined;
								asResponse?: R | undefined;
								returnHeaders?: H | undefined;
							}) => false extends R
								? H extends true
									? Promise<{
											headers: Headers;
											response: PrettifyDeep<Awaited<ReturnType<E>>> | null;
										}>
									: Promise<PrettifyDeep<Awaited<ReturnType<E>>> | null>
								: Promise<Response>;
						}
					: never
				: never
		>
	: never;

/**
 * Combines InferSessionAPI with a DefaultSessionAPI fallback.
 * When InferSessionAPI produces a valid getSession type, it takes precedence.
 * When inference fails (API becomes `any`), DefaultSessionAPI provides the fallback.
 */
type SessionAPIWithFallback<API> =
	InferSessionAPI<API> extends { getSession: any }
		? InferSessionAPI<API>
		: DefaultSessionAPI;

export type InferAPI<API> = SessionAPIWithFallback<API> & FilteredAPI<API>;
