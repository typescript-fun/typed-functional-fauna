import * as E from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import React from 'react';
import { Product } from '../types';

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
      console.log(decodedProduct.right.release.getHours());
    }

    // Send the encoded product to the server.
    // Now go to `api/createProduct.ts` file.
    fetch('/api/createProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // JSON.stringify is safe on encoded values.
      body: JSON.stringify(encodedProduct),
    })
      .then(response => response.json())
      .then(json =>
        pipe(
          Product.decode(json),
          E.fold(
            error => {
              // error is t.Errors only.
              // To catch fetch error, we would have to make functional fetch
              // just like client.fetch in createProduct.ts
              console.log(error);
            },
            product => {
              // Awesome. Everything works as expected.
              console.log(product.release.getHours());
              console.log(product);
            },
          ),
        ),
      );
  };

  return (
    <div>
      <h1>Typed functional programming with Fauna DB</h1>
      <button onClick={createProduct}>Create a Product</button>
    </div>
  );
};

export default Home;
