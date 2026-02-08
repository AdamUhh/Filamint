/**
 * Extracts the element type of an array.
 *
 * @example
 * type Num = ArrayElement<number[]>; // returns number
 * @example
 * type Str = ArrayElement<string[]>; // returns string
 */
export type ArrayElementOf<T> = T extends (infer U)[] ? U : never;

/**
 * Makes specific keys in a type required while leaving the rest unchanged.
 *
 * @example
 * type User = { id?: string; name: string };
 * type StrictUser = WithRequired<User, "id">;
 * // { id: string; name: string }
 */
export type SetRequired<T, K extends keyof T> = Omit<T, K> &
    Required<Pick<T, K>>;

/**
 * Makes specific keys in a type optional while leaving the rest unchanged.
 *
 * @example
 * type User = { id: string; name: string };
 * type PartialUser = WithPartial<User, "id">;
 * // { id?: string; name: string }
 */
export type SetPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
