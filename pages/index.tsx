import * as E from "fp-ts/lib/Either";
import React from "react";
import { Product } from "../types";

const Home = () => {
  const createProduct = () => {
    // Create a new product.
    const product: Product = {
      name: "First",
      release: new Date()
    };

    // Send it to the server. But JSON stringify is not enough.
    // We can serialize a product, but how we can safely deserialize it?
    const serializedProduct = JSON.stringify(product);
    // deserializedProduct is any type and `release` is a string, not a Date.
    // And parsing can fail of course.
    const deserializedProduct = JSON.parse(serializedProduct);

    // io-ts not only safely decodes types, but also encodes them.
    // Encoding is defined by Product codec, `release` is encoded as iso string.
    const encodedProduct = Product.encode(product);
    // We can decode anything safely.
    const decodedProduct = Product.decode(encodedProduct);
    // https://gcanti.github.io/fp-ts/modules/Either.ts.html
    if (E.isRight(decodedProduct)) {
      // Note everything is typed and `release` is a Date.
      console.log(decodedProduct.right.release.getHours());
    }

    // Send the encoded product to the server.
    // JSON.stringify is safe on encoded values.
    // Note `release` is DateFromISOString type, but it could be
    // DateFromUnixTime or anything else with custom encoding.
    fetch("/api/createProduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encodedProduct)
    })
      .then(response => response.json())
      .then(json => {
        console.log(json);
      });
  };

  return (
    <div>
      <h1>Typed functional programming with Fauna DB</h1>
      <button onClick={createProduct}>Create a Product</button>
      {/* <br />
      <button>Save a Product</button> */}
    </div>
  );
};

export default Home;
