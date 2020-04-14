import { Client, errors, Expr, Materialize, query as q } from 'faunadb';
import * as E from 'fp-ts/lib/Either';
import { absurd } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';
import * as TE from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';
import { NextApiRequest, NextApiResponse } from 'next';
import { Product } from '../../types';

// In this example, we would like to:
//  1) Create products and users collections lazily.
//  2) Save a product to the Fauna DB.
//  3) Handle all errors at one place safely (with exhaustive checking).
//  4) Send saved product to the client.
// As for 1) and 2), remember, this is just an example of async flow.
// In the real app, we would move such logic to FQL to ensure a transaction.

// To understand this code, please check `createProduct_classic.ts` first.

// Sure we can have a generic endpoint factory for much more consise code.
export default (req: NextApiRequest, res: NextApiResponse) => {
  const client = new Client({
    secret: process.env.faunaKey as string,
  });

  // Let's make client.query functional.

  // At first, we have to define all Fauna errors.
  // For the sake of simplicity, we will map them to HTTP status numbers.
  // In the real app, we would map them to something with all available data.
  type FaunaError = 400 | 401 | 403 | 404 | 405 | 500 | 503 | 'unknownError';

  // Then we create functional Fauna query.
  // https://dev.to/gcanti/interoperability-with-non-functional-code-using-fp-ts-432e
  // https://grossbart.github.io/fp-ts-recipes/#/async
  const query = <T>(expr: Expr<T>): TE.TaskEither<FaunaError, Materialize<T>> =>
    TE.tryCatch(
      () => client.query(expr),
      error => {
        if (error instanceof errors.BadRequest) return 400;
        if (error instanceof errors.Unauthorized) return 401;
        if (error instanceof errors.PermissionDenied) return 403;
        if (error instanceof errors.NotFound) return 404;
        if (error instanceof errors.MethodNotAllowed) return 405;
        if (error instanceof errors.InternalError) return 500;
        if (error instanceof errors.UnavailableError) return 503;
        return 'unknownError';
      },
    );

  type CreateProductError = t.Errors | FaunaError;

  const createProduct = pipe(
    TE.fromEither(Product.decode(req.body)),
    TE.chain(product =>
      // Inner pipe is ok. It's like a function. We can refactor it out.
      pipe(
        query(q.Exists(q.Collection('products'))),
        // Hint: If you are lost in chains and types, hover mouse over a.
        a => a,
        TE.chain(exists => {
          if (exists) return TE.right(null);
          return query(
            q.Do(
              q.CreateCollection({ name: 'products' }),
              q.CreateCollection({ name: 'users' }),
            ),
          );
        }),
        TE.chain(() =>
          query(
            q.Create(q.Collection('products'), {
              data: {
                // Decoded `product.release` is a Date.
                // Encode it to get FaunaTime instance.
                ...Product.encode(product),
                createdAt: q.Now(),
                owner: q.Ref(q.Collection('users'), '123'),
              },
            }),
          ),
        ),
        // savedProductDoc.data is an object.
        // We can't blindly believe it's Product.
        // We have to decode it.
        TE.chain(savedProductDoc =>
          TE.fromEither<CreateProductError, Product>(
            // TODO: SavedProduct with createdAt and owner props.
            // TODO: Map it to FaunaDoc probably.
            Product.decode(savedProductDoc.data),
          ),
        ),
      ),
    ),
  );

  const handleError = (error: CreateProductError) => {
    switch (error) {
      case 400:
      case 401:
      case 403:
      case 404:
      case 405:
      case 500:
      case 503:
        res.statusCode = error;
        break;
      case 'unknownError':
        res.statusCode = 500;
        break;
      default: {
        if (Array.isArray(error)) {
          res.statusCode = 500;
          break;
        }
        // absurd ensures all errors are handled.
        absurd(error);
      }
    }
    res.setHeader('Content-Type', 'application/json');
    res.end({});
  };

  const handleSuccess = (savedProduct: Product) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(Product.encode(savedProduct)));
  };

  // Run it.
  createProduct().then(either =>
    pipe(
      either,
      E.fold(handleError, handleSuccess),
    ),
  );
};
