import * as t from 'io-ts';
import { either } from 'io-ts-types/lib/either';
import {
  FaunaDocRef,
  FaunaError,
  FaunaTime,
  FaunaTimeLong,
} from '../lib/faunadb-functional';

// Helpers.

const DocRequiredProps = t.type({
  createdAt: FaunaTime,
  owner: FaunaDocRef,
});

const doc = <P extends t.Props>(data: t.TypeC<P>) =>
  t.type({
    ref: FaunaDocRef,
    ts: FaunaTimeLong,
    data: t.intersection([data, DocRequiredProps]),
  });

// Domain models.

export const Product = t.type({
  name: t.string,
  release: FaunaTime,
});
export type Product = t.TypeOf<typeof Product>;

export const ProductDoc = doc(Product);
export type ProductDoc = t.TypeOf<typeof ProductDoc>;

// API models.

export const CreateProduct = either(FaunaError, ProductDoc);
export type CreateProduct = t.TypeOf<typeof CreateProduct>;
