import { values } from 'faunadb';
import * as E from 'fp-ts/lib/Either';
import * as t from 'io-ts';

// Internal helper types.

// https://github.com/gcanti/io-ts-types/blob/master/src/DateFromISOString.ts
const DateFromISOString = new t.Type<Date, string, unknown>(
  'DateFromISOString',
  (u): u is Date => u instanceof Date,
  (u, c) =>
    E.either.chain(t.string.validate(u, c), s => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? t.failure(u, c) : t.success(d);
    }),
  a => a.toISOString(),
);

// That's how FaunaTime is serialized with JSON.stringify.
const FaunaTimeSerialized = t.type({
  '@ts': DateFromISOString,
});

// With DateFromFaunaTime, we can use plain JavaScript Date.
// It's encoded as FaunaTime and decoded from it safely.
const DateFromFaunaTime = new t.Type<Date, values.FaunaTime, unknown>(
  'DateFromFaunaTime',
  (u): u is Date => u instanceof Date,
  (u, c) => {
    if (u instanceof values.FaunaTime) return t.success(u.date);
    return E.either.chain(FaunaTimeSerialized.validate(u, c), s =>
      t.success(s['@ts']),
    );
  },
  a => new values.FaunaTime(a),
);

// Test DateFromFaunaTime.
{
  const a: Date = new Date();
  const encodedA = DateFromFaunaTime.encode(a);
  let decodedA = DateFromFaunaTime.decode(encodedA);
  if (E.isLeft(decodedA) || decodedA.right.getTime() !== a.getTime())
    throw 'should decode FaunaTime';
  decodedA = DateFromFaunaTime.decode(JSON.parse(JSON.stringify(encodedA)));
  if (E.isLeft(decodedA) || decodedA.right.getTime() !== a.getTime())
    throw 'should decode serialized FaunaTime';
}

// Domain models.

export const Product = t.type({
  name: t.string,
  release: DateFromFaunaTime,
});
export type Product = t.TypeOf<typeof Product>;

// TODO: Saved or generic faunaDoc type with saved props.
// ID, owner, createdAt, updatedAt.
