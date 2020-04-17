import { Client, query as q } from 'faunadb';
import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import * as TE from 'fp-ts/lib/TaskEither';
import * as t from 'io-ts';
import { NextApiRequest, NextApiResponse } from 'next';
import { createQuery, FaunaError } from '../../lib/faunadb-functional';
import { CreateProduct, Product, ProductDoc } from '../../types';

// In this example, we would like to:
//  1) Safely decode req.body.
//  2) Create products and users collections lazily.
//  3) Save a product to the Fauna DB.
//  4) Safely decode Fauna DB response.
//  5) Send encoded product doc to the client.

// The pattern is simple. We have to parse every input and output.
// Note 2) and 3) are just for the demostration of async flow via TaskEither.
// In the real app, we would do that in one FQL transaction.

// To understand this code, please check `createProduct_classic.ts` first.

export default (req: NextApiRequest, res: NextApiResponse) => {
  const client = new Client({
    secret: process.env.faunaKey as string,
  });
  const query = createQuery(client);

  // Cast the left to the createProduct left, t.Errors is internal error.
  // https://github.com/gcanti/fp-ts/issues/904#issuecomment-572408690
  const tErrorsToFaunaError = E.mapLeft(
    (error: t.Errors): FaunaError => ({
      type: 'faunaError',
      name: 'invalidValue',
      message: 'decode',
    }),
  );

  // Sure we can have a generic endpoint factory for even more consise code.
  const createProduct: TE.TaskEither<FaunaError, ProductDoc> = pipe(
    // We can not blindly trust what req body is.
    Product.decode(req.body),
    tErrorsToFaunaError,
    // Going to async world.
    TE.fromEither,
    // Save to DB.
    TE.chain(product =>
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
                // Encode it to FaunaTime instance.
                ...Product.encode(product),
                createdAt: q.Now(),
                owner: q.Ref(q.Collection('users'), '123'),
              },
            }),
          ),
        ),
      ),
    ),
    // We can't blindly trust what a doc is. Let's decode it.
    TE.chain(doc =>
      pipe(
        ProductDoc.decode(doc),
        tErrorsToFaunaError,
        TE.fromEither,
      ),
    ),
  );

  // With TaskEither, there is no need for Promise catch. We have Either.
  createProduct().then(result => {
    res.json(CreateProduct.encode(result));
  });
};
