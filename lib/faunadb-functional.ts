import { Client, errors, Expr, Materialize, values } from 'faunadb';
import * as E from 'fp-ts/lib/Either';
import * as TE from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';
import { DateFromISOString } from 'io-ts-types/lib/DateFromISOString';

// Helper io-ts types for safe serialization and deserialization.

export const FaunaTime = (() => {
  const Serialized = t.type({ '@ts': DateFromISOString });
  return new t.Type<Date, values.FaunaTime, unknown>(
    'DateFromFaunaTime',
    (u): u is Date => u instanceof Date,
    (u, c) => {
      if (u instanceof values.FaunaTime) return t.success(u.date);
      return E.either.chain(Serialized.validate(u, c), s =>
        t.success(s['@ts']),
      );
    },
    a => new values.FaunaTime(a),
  );
})();
export type FaunaTime = t.TypeOf<typeof FaunaTime>;

export const FaunaDocRef = (() => {
  const Serialized = t.type({
    '@ref': t.type({
      id: t.string,
      collection: t.type({
        '@ref': t.type({
          id: t.string,
          collection: t.type({
            '@ref': t.type({ id: t.literal('collections') }),
          }),
        }),
      }),
    }),
  });
  const FaunaDocRef = t.type({
    id: t.string,
    collection: t.string,
  });
  type FaunaDocRef = t.TypeOf<typeof FaunaDocRef>;
  return new t.Type<FaunaDocRef, values.Ref, unknown>(
    'FaunaDocRef',
    FaunaDocRef.is,
    (u, c) => {
      if (u instanceof values.Ref) {
        return u.collection
          ? t.success({
              id: u.id,
              collection: u.collection.id,
            })
          : t.failure(u, c);
      }
      return E.either.chain(Serialized.validate(u, c), s =>
        t.success({
          id: s['@ref'].id,
          collection: s['@ref'].collection['@ref'].id,
        }),
      );
    },
    a =>
      new values.Ref(
        a.id,
        new values.Ref(a.collection, values.Native.COLLECTIONS),
      ),
  );
})();
export type FaunaDocRef = t.TypeOf<typeof FaunaDocRef>;

// Similar to io-ts-types DateFromUnixTime.
export const FaunaTimeLong = new t.Type<Date, number, unknown>(
  'FaunaTimeLong',
  (u): u is Date => u instanceof Date,
  (u, c) =>
    E.either.chain(t.Int.validate(u, c), n => {
      const d = new Date(n / 1000);
      return isNaN(d.getTime()) ? t.failure(u, c) : t.success(d);
    }),
  a => a.getTime() * 1000,
);
export type FaunaTimeLong = t.TypeOf<typeof FaunaTimeLong>;

export const faunaDoc = <P extends t.Props>(data: t.TypeC<P>) =>
  t.type({
    ref: FaunaDocRef,
    ts: FaunaTimeLong,
    data,
  });

export const RequestResult = t.type({
  method: t.string,
  path: t.string,
  query: t.UnknownRecord,
  requestRaw: t.string,
  requestContent: t.UnknownRecord,
  responseRaw: t.string,
  responseContent: t.UnknownRecord,
  statusCode: t.number,
  responseHeaders: t.UnknownRecord,
  startTime: DateFromISOString,
  endTime: DateFromISOString,
});
export type RequestResult = t.TypeOf<typeof RequestResult>;

export const FaunaError = t.union([
  t.type({
    type: t.literal('faunaError'),
    name: t.union([
      t.literal('badRequest'),
      t.literal('unauthorized'),
      t.literal('permissionDenied'),
      t.literal('notFound'),
      t.literal('methodNotAllowed'),
      t.literal('internalError'),
      t.literal('unavailableError'),
    ]),
    message: t.string,
    requestResult: RequestResult,
  }),
  t.type({
    type: t.literal('faunaError'),
    name: t.union([t.literal('invalidValue'), t.literal('unknownError')]),
    message: t.string,
  }),
]);
export type FaunaError = t.TypeOf<typeof FaunaError>;

// Functional API.

// The point is to have all errors typed, the throw is considered harmful.
// https://blog.ploeh.dk/2015/04/13/less-is-more-language-features/
// https://dev.to/gcanti/interoperability-with-non-functional-code-using-fp-ts-432e
// https://grossbart.github.io/fp-ts-recipes/#/async
export const createQuery = (client: Client) => <T>(
  expr: Expr<T>,
): TE.TaskEither<FaunaError, Materialize<T>> =>
  TE.tryCatch(
    () => {
      // TE.tryCatch only maps Promise result. It does not do try catch.
      try {
        return client.query(expr);
      } catch (error) {
        return Promise.reject(error);
      }
    },
    error => {
      if (error instanceof errors.BadRequest)
        return {
          type: 'faunaError',
          name: 'badRequest',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.Unauthorized)
        return {
          type: 'faunaError',
          name: 'unauthorized',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.PermissionDenied)
        return {
          type: 'faunaError',
          name: 'permissionDenied',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.NotFound)
        return {
          type: 'faunaError',
          name: 'notFound',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.MethodNotAllowed)
        return {
          type: 'faunaError',
          name: 'methodNotAllowed',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.InternalError)
        return {
          type: 'faunaError',
          name: 'internalError',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.UnavailableError)
        return {
          type: 'faunaError',
          name: 'unavailableError',
          message: error.message,
          requestResult: (error.requestResult as unknown) as RequestResult,
        };
      if (error instanceof errors.InvalidValue)
        return {
          type: 'faunaError',
          name: 'invalidValue',
          message: error.message,
        };

      return {
        type: 'faunaError',
        name: 'unknownError',
        message: String(error),
      };
    },
  );
