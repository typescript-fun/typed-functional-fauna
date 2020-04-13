import { NextApiRequest, NextApiResponse } from "next";
import * as E from "fp-ts/lib/Either";
import { Product } from "../../types";
import { Client, query as q, errors } from "faunadb";

export default (req: NextApiRequest, res: NextApiResponse) => {
  // Client is cheap to instantiate so there is no reason to share instances.
  const client = new Client({
    secret: process.env.faunaKey as string
  });

  // In this example, we would like to:
  //  1) Create products and users collections lazily.
  //  2) Save product to the Fauna DB.
  //  3) Send saved product to the client.
  // As for 1) and 2), remember, this is just an example of async flow.
  // In the real app, we would move such logic to FQL to ensure a transaction.

  // Read the commented classic approach first!

  // Classic approach.
  // Req body is any, we have to decode it via io-ts Product codec.
  // export const Product = t.type({
  //   name: t.string,
  //   release: DateFromISOString
  // });
  // Note product is Either type and `release` prop is Date instance.
  // https://gcanti.github.io/fp-ts/modules/Either.ts.html
  const product = Product.decode(req.body);

  // In the classic approach, we use then/catch (or await try/catch, it's the same).
  // The problem is catched error is any type.
  // We have to use instanceof and we never know whether all errors are handled.
  // What if we would like to use some another library which throws own errors?
  // Error handling without typed functional programming is very tricky
  // and programming is all about error handling. We will do it better.
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
              // Note we have to map the product manually which is error-prone.
              // For example, we are using DateFromISOString type (io-ts coded)
              // while Fauna nees its own q.Time etc.
              name: product.right.name,
              release: q.Time(product.right.release.toISOString()),
              createdAt: q.Now(),
              owner: q.Ref(q.Collection("users"), "123")
            }
          })
        )
      )
      .then(productDoc => {
        // So we have saved product as Fauna document, let's take a look at it.

        // console.log(productDoc);
        // {
        //   ref: Ref(Collection("products"), "262719280680796672"),
        //   ts: 1586807480510000,
        //   data: {
        //     name: 'First',
        //     release: Time("2020-04-13T19:51:19.487Z"),
        //     createdAt: Time("2020-04-13T19:51:20.253020Z"),
        //     owner: Ref(Collection("users"), "123")
        //   }
        // }

        // Note `productDoc.data` contains Fauna types Time and Ref.
        // It's not our Product type. It is its Fauna representation.
        // It's not obvious how we can read them because Fauna changes
        // how console.log works and `productDoc.data` is just an object.
        // But by docs, we can figure it out.
        // @ts-ignore Property 'release' does not exist on type 'object'
        console.log(productDoc.data.release.date.getHours());
        // @ts-ignore Property 'owner' does not exist on type 'object'
        console.log(productDoc.data.owner.id);

        // Of course, ts-ignore is not a solution.
        // Also, we can't just blindly believe that Fauna returns data
        // we expect. Data can be corrupted by an error in business logic or
        // something else. Don't Trust. Verify.
        // But we can not use `Product.decode`. Fauna uses its own types.
        // And there is another issue.
        // We know we will need JSON.stringify to deliver saved product to
        // the client. But the output is even more confusing.
        // Serialized data are different from data we just used!

        // console.log(JSON.stringify(productDoc));
        // {
        //   ref: {
        //     "@ref": {
        //       id: "262719591103332864",
        //       collection: {
        //         "@ref": {
        //           id: "products",
        //           collection: { "@ref": { id: "collections" } }
        //         }
        //       }
        //     }
        //   },
        //   ts: 1586807776460000,
        //   data: {
        //     name: "First",
        //     release: { "@ts": "2020-04-13T19:56:15.706Z" },
        //     createdAt: { "@ts": "2020-04-13T19:56:16.317852Z" },
        //     owner: {
        //       "@ref": {
        //         id: "123",
        //         collection: {
        //           "@ref": {
        //             id: "users",
        //             collection: { "@ref": { id: "collections" } }
        //           }
        //         }
        //       }
        //     }
        //   }
        // };

        // That's because of how Fauna driver is designed.
        // Fauna driver has an internal helper parseJSON which converts
        // aforementioned JSON back to Fauna types, but we can't
        // use it, because it's internal.
        // Also, we don't want to bundle the whole Fauna library
        // just to use data from it.
        // The only (naive) solution is to map data manually again.

        // const product: SavedProduct = {
        //   name: productDoc.data.name,
        //   release: productDoc.data.release.date,
        //   createdAt: ...,
        //   owner: ...
        // }

        // Then we could use `Product.encode(product)`.
        // But all of that is very error-prone and verbose.
        // We need the better approach.
        // Safe, automatic, and frictionless.
        // Fortunately, we can leverage io-ts!
      })
      .catch(error => {
        // error is any :(
        // All we can do is:
        // if (error instanceof errors.BadRequest) {
        // But we never know if we handle all errors.
        console.log(error);
      });
  } else {
    // Req body wasn't decoded successfully. Note how classic approach forces
    // us to handle errors on different places in a code.
  }

  // https://grossbart.github.io/fp-ts-recipes/#/async
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
