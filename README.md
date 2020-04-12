# typed-functional-fauna

Typed functional programming with Fauna DB

## Features

- Sync/async error handling with [fp-ts](https://github.com/gcanti/fp-ts).
- Functional domain driven design and runtime types with [io-ts](https://github.com/gcanti/io-ts).
- Custom Fauna types for the better interoperability with JAM stack apps.

## Usage

1. Go to [dashboard.fauna.com](https://dashboard.fauna.com/)
2. Create a database.
3. Go to the security tab and create a new key.
4. Past it to the `next.config.js`

Note we are temporally using aleclarson/faunadb-js#types branch.
