type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: Error };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

abstract class BaseSchema<T> {
  declare _type: T;

  abstract parse(value: unknown): T;

  safeParse(value: unknown): SafeParseResult<T> {
    try {
      return { success: true, data: this.parse(value) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Invalid value")
      };
    }
  }

  optional(): OptionalSchema<T> {
    return new OptionalSchema(this);
  }

  transform<U>(mapper: (value: T) => U): BaseSchema<U> {
    const parent = this;
    return new (class extends BaseSchema<U> {
      parse(value: unknown) {
        return mapper(parent.parse(value));
      }
    })();
  }

  catch(defaultValue: T): BaseSchema<T> {
    const parent = this;
    return new (class extends BaseSchema<T> {
      parse(value: unknown) {
        try {
          return parent.parse(value);
        } catch {
          return defaultValue;
        }
      }
    })();
  }
}

type Shape = Record<string, BaseSchema<any>>;
type OptionalKeys<T extends Shape> = {
  [K in keyof T]: T[K] extends OptionalSchema<any> ? K : never;
}[keyof T];
type RequiredKeys<T extends Shape> = Exclude<keyof T, OptionalKeys<T>>;
type InferShape<T extends Shape> = { [K in RequiredKeys<T>]: T[K]["_type"] } & {
  [K in OptionalKeys<T>]?: T[K]["_type"];
};
type InferPartialShape<T extends Shape> = { [K in keyof T]?: T[K]["_type"] };

class OptionalSchema<T> extends BaseSchema<T | undefined> {
  constructor(private readonly inner: BaseSchema<T>) {
    super();
  }

  parse(value: unknown) {
    return value === undefined ? undefined : this.inner.parse(value);
  }
}

class StringSchema extends BaseSchema<string> {
  private validator?: (value: string) => boolean;

  regex(pattern: RegExp) {
    const parent = this;
    return new (class extends BaseSchema<string> {
      parse(value: unknown) {
        const parsed = parent.parse(value);
        if (!pattern.test(parsed)) {
          throw new Error("Invalid string format");
        }
        return parsed;
      }
    })();
  }

  parse(value: unknown) {
    if (typeof value !== "string") {
      throw new Error("Expected string");
    }
    if (this.validator && !this.validator(value)) {
      throw new Error("Invalid string");
    }
    return value;
  }
}

class NumberSchema extends BaseSchema<number> {
  parse(value: unknown) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error("Expected number");
    }
    return value;
  }
}

class BooleanSchema extends BaseSchema<boolean> {
  parse(value: unknown) {
    if (typeof value !== "boolean") {
      throw new Error("Expected boolean");
    }
    return value;
  }
}

class LiteralSchema<T extends string | number | boolean> extends BaseSchema<T> {
  constructor(private readonly expected: T) {
    super();
  }

  parse(value: unknown) {
    if (value !== this.expected) {
      throw new Error("Unexpected literal");
    }
    return this.expected;
  }
}

class EnumSchema<T extends readonly string[]> extends BaseSchema<T[number]> {
  readonly options: T;

  constructor(values: T) {
    super();
    this.options = values;
  }

  parse(value: unknown) {
    if (typeof value !== "string" || !this.options.includes(value)) {
      throw new Error("Invalid enum value");
    }
    return value as T[number];
  }
}

class ArraySchema<T> extends BaseSchema<T[]> {
  constructor(private readonly itemSchema: BaseSchema<T>) {
    super();
  }

  parse(value: unknown) {
    if (!Array.isArray(value)) {
      throw new Error("Expected array");
    }
    return value.map((item) => this.itemSchema.parse(item));
  }
}

class TupleSchema<T extends readonly BaseSchema<any>[]> extends BaseSchema<
  { [K in keyof T]: T[K] extends BaseSchema<infer U> ? U : never }
> {
  constructor(private readonly itemSchemas: T) {
    super();
  }

  parse(value: unknown) {
    if (!Array.isArray(value) || value.length < this.itemSchemas.length) {
      throw new Error("Expected tuple");
    }
    return this.itemSchemas.map((schema, index) => schema.parse(value[index])) as {
      [K in keyof T]: T[K] extends BaseSchema<infer U> ? U : never;
    };
  }
}

class ObjectSchema<T extends Shape> extends BaseSchema<InferShape<T>> {
  constructor(private readonly shape: T) {
    super();
  }

  parse(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Expected object");
    }

    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(this.shape)) {
      if (record[key] === undefined && schema instanceof OptionalSchema) {
        continue;
      }
      result[key] = schema.parse(record[key]);
    }
    return result as InferShape<T>;
  }

  partial(): BaseSchema<InferPartialShape<T>> {
    const shape = this.shape;
    return new (class extends BaseSchema<InferPartialShape<T>> {
      parse(value: unknown) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("Expected object");
        }

        const record = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const [key, schema] of Object.entries(shape)) {
          if (record[key] === undefined) continue;
          result[key] = schema.parse(record[key]);
        }
        return result as InferPartialShape<T>;
      }
    })();
  }
}

class UnionSchema<T> extends BaseSchema<T> {
  constructor(private readonly schemas: BaseSchema<any>[]) {
    super();
  }

  parse(value: unknown) {
    for (const schema of this.schemas) {
      const parsed = schema.safeParse(value);
      if (parsed.success) return parsed.data as T;
    }
    throw new Error("No union match");
  }
}

class DiscriminatedUnionSchema<T> extends BaseSchema<T> {
  constructor(
    private readonly key: string,
    private readonly schemas: ObjectSchema<any>[]
  ) {
    super();
  }

  parse(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Expected object");
    }

    const discriminator = (value as Record<string, unknown>)[this.key];
    for (const schema of this.schemas) {
      const parsed = schema.safeParse(value);
      if (parsed.success && (parsed.data as Record<string, unknown>)[this.key] === discriminator) {
        return parsed.data as T;
      }
    }

    throw new Error("No discriminated union match");
  }
}

export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  literal: <T extends string | number | boolean>(value: T) => new LiteralSchema(value),
  enum: <T extends readonly string[]>(values: T) => new EnumSchema(values),
  array: <T>(schema: BaseSchema<T>) => new ArraySchema(schema),
  tuple: <T extends readonly BaseSchema<any>[]>(schemas: T) => new TupleSchema(schemas),
  object: <T extends Shape>(shape: T) => new ObjectSchema(shape),
  union: <T extends readonly BaseSchema<any>[]>(schemas: T) => new UnionSchema<any>([...schemas]),
  discriminatedUnion: <T extends readonly ObjectSchema<any>[]>(key: string, schemas: T) =>
    new DiscriminatedUnionSchema<any>(key, [...schemas])
};

export namespace z {
  export type infer<T extends BaseSchema<any>> = T["_type"];
}
