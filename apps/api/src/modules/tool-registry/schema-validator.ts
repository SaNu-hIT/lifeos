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
    stripNullOptionalFields(schema, data);
    let validate = this.cache.get(schema);
    if (!validate) {
      validate = this.ajv.compile(schema as object);
      this.cache.set(schema, validate);
    }
    const valid = validate(data) as boolean;
    return valid ? { valid: true } : { valid: false, errors: this.ajv.errorsText(validate.errors) };
  }
}

/**
 * LLM-produced args routinely spell out an unset optional field as an explicit
 * `null` rather than omitting the key (e.g. `{"flow": null}`). JSON Schema types
 * don't implicitly allow null, so that fails validation and silently discards an
 * otherwise-valid plan (docs/02 §7). Since optional fields are read with `??`
 * throughout the tool handlers, dropping the key is equivalent and safe — mutates
 * `data` in place so both the validator and the eventual handler/plan-step see it.
 */
function stripNullOptionalFields(schema: JSONSchema, data: unknown): void {
  const obj = schema as { type?: string; properties?: Record<string, unknown>; required?: string[] };
  if (obj.type !== 'object' || !obj.properties || data === null || typeof data !== 'object') return;
  const required = new Set(obj.required ?? []);
  const record = data as Record<string, unknown>;
  for (const key of Object.keys(obj.properties)) {
    if (!required.has(key) && record[key] === null) delete record[key];
  }
}
