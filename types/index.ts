import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

// https://github.com/gcanti/io-ts-types/blob/master/src/DateFromISOString.ts
export const DateFromISOString = new t.Type<Date, string, unknown>(
  "DateFromISOString",
  (u): u is Date => u instanceof Date,
  (u, c) =>
    E.either.chain(t.string.validate(u, c), s => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? t.failure(u, c) : t.success(d);
    }),
  a => a.toISOString()
);

export const Product = t.type({
  name: t.string,
  release: DateFromISOString
});
export type Product = t.TypeOf<typeof Product>;

// saved, to chci
// nebo, fakt to neni ten faunaDoc?
