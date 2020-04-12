import { NextApiRequest, NextApiResponse } from "next";
import * as E from "fp-ts/lib/Either";
import { Product } from "../../types";
import { Client, query as q, errors } from "faunadb";

export default (req: NextApiRequest, res: NextApiResponse) => {
  // Req body is any, we have to decode it.
  // Note product is Either type.
  // https://gcanti.github.io/fp-ts/modules/Either.ts.html
  const product = Product.decode(req.body);

  const client = new Client({
    secret: process.env.faunaKey as string
  });

  // In this example, we would like to create a products and users collections
  // lazily, and then add the product.
  // Remember, this is just an example. In the real app, we would move such
  // logic to FQL. We just want to demonstrate TaskEither (async Either).
  // https://grossbart.github.io/fp-ts-recipes/#/async

  // The classic approach is to use then/catch or await try/catch.
  // The problem is that catched error is any type.
  // We have to use instanceof and we never know whether all errors are handled.
  // What if we would like to use some another library which throws own errors?
  // Error handling without typed functional programming is very tricky
  // and programming is all about error handling.
  if (E.isRight(product)) {
    client
      .query(q.Exists(q.Collection("products")))
      .then(exist => {
        if (exist) return;
        return client.query(
          q.Do(
            q.CreateCollection({ name: "products" }),
            q.CreateCollection({ name: "users" })
          )
        );
      })
      .then(() =>
        client.query(
          q.Create(q.Collection("products"), {
            data: {
              // We have to map product type manually.
              name: product.right.name,
              released: q.Time(product.right.release.toISOString()),
              createdAt: q.Now(),
              owner: q.Ref(q.Collection("users"), "123")
            }
          })
        )
      )
      .then(productDoc => {
        // takhle
        //  - co s datama, na to chci model
        //  - musim dat encode, abych mohl serizalizovat
        //  - na clientu decode, a budu mit to same
        //  - a pak to zopakuju
        //  - plus dalsi problem je co s tim id a ts

        // potrebuju to id, idealne v... na server poslu...
        // asi vim...

        // faunaDoc(Product).encode(productDoc)
        // na klientu to same decode, a mam to, co fauna chce
        // na clientu udelam update jak? pres q types?
        // encode, poslu na server do druhe api
        // tam encode, dostanu neco, co muzu rovnou pouzit
        // = ok, to je vono

        // OK, we saved a product, and we have the data we need
        // to deliever to a client and back.
        // Now we need id,
        // savedProductDocument.ref.id
        console.log(savedProductDocument);
        console.log(JSON.stringify(savedProductDocument));
      })
      .catch(error => {
        // error is any :(
        // All we can do is:
        // if (error instanceof errors.BadRequest) {
        // But we never know if we handle all errors.
        console.log(error);
      });
  }

  // client
  //   .query(q.CreateCollection({ name: "products" }))
  //   .then(response => {
  //     console.log(response);
  //     // client.query(q.CreateCollection({ name: "products" }))
  //   })
  //   .catch(error => {
  //     if (error instanceof errors.BadRequest) {
  //       // Instance already exists.
  //       console.log(error.message);
  //     } else {
  //       // What else?
  //       console.log(error);
  //     }
  //   });

  // // TODO: Client to TaskEither
  // // https://dev.to/gcanti/interoperability-with-non-functional-code-using-fp-ts-432e

  // TODO: Do it functional, typed, with absurd!

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ name: "John Doe" }));
};
