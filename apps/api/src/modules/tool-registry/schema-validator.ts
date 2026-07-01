import { Ajv, type ValidateFunction } from 'ajv';
import type { JSONSchema } from '@lifeos/contracts';

export interface ValidationOutcome {
  valid: boolean;
  errors?: string;
}

/** Validates tool input/output against JSON schemas. Compiled validators are cached
 *  by schema reference (tools reuse the same schema objects). */
export class SchemaValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly cache = new WeakMap<object, ValidateFunction>();

  validate(schema: JSONSchema, data: unknown): ValidationOutcome {
    let validate = this.cache.get(schema);
    if (!validate) {
      validate = this.ajv.compile(schema as object);
      this.cache.set(schema, validate);
    }
    const valid = validate(data) as boolean;
    return valid ? { valid: true } : { valid: false, errors: this.ajv.errorsText(validate.errors) };
  }
}
