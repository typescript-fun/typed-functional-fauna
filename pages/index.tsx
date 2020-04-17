import * as E from 'fp-ts/lib/Either';
import { absurd } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';
import React from 'react';
import { FaunaError } from '../lib/faunadb-functional';
import { CreateProduct, Product, ProductDoc } from '../types';

const Home = () => {
  const createProduct = () => {
    // Create a new product.
    const product: Product = {
      name: 'First',
      release: new Date(),
    };

    // Send it to the server. But JSON stringify is not enough.
    // We can serialize a product, but how we can safely deserialize it?
    const serializedProduct = JSON.stringify(product);
    // deserializedProduct is any type and `release` is a string, not a Date.
    // And parsing can fail of course.
    const deserializedProduct = JSON.parse(serializedProduct);

    // io-ts not only safely decodes types, but also encodes them.
    // Encoding is defined by Product codec.
    const encodedProduct = Product.encode(product);
    // We can decode anything safely because of Either.
    const decodedProduct = Product.decode(encodedProduct);
    // https://gcanti.github.io/fp-ts/modules/Either.ts.html
    if (E.isRight(decodedProduct)) {
      // Note everything is typed and `release` is a Date.
      // console.log(decodedProduct.right.release.getHours());
    }

    // Send the encoded product to the server.
    // Now go to `api/createProduct.ts` file.

    // This fetch is intentionally without TaskEither.
    // Sure we can have the same functional wrapper as Fauna query has.
    // https://dev.to/gcanti/interoperability-with-non-functional-code-using-fp-ts-432e
    fetch('/api/createProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // JSON.stringify is safe on encoded types.
      body: JSON.stringify(encodedProduct),
    })
      .then(response => response.json())
      .then(json => {
        // This is intentionally explicit. For the flat more concise code,
        // check `api/createProduct.ts` file.
        pipe(
          // Remember, never trust any external data.
          CreateProduct.decode(json),
          E.fold(
            error => {
              // Decoding failed.
              console.log(error);
            },
            createProduct =>
              // Success, we have CreateProduct (Either). Let's fold it.
              pipe(
                createProduct,
                E.fold(
                  error => {
                    if (FaunaError.is(error)) {
                      // Error name is union type, we can use absurd here too.
                      console.log(error.name);
                      return;
                    }
                    // Ensure all errors are handled.
                    absurd(error);
                  },
                  productDoc => {
                    // Awesome. Everything works as expected.
                    console.log(productDoc);
                    console.log(productDoc.data.release.getHours());
                    console.log(productDoc.data.createdAt.getHours());
                    console.log(productDoc.data.owner.id);
                  },
                ),
              ),
          ),
        );
      });
  };

  return (
    <div>
      <h1>Typed functional programming with Fauna DB</h1>
      <button onClick={createProduct}>Create a Product</button>
    </div>
  );
};

export default Home;
