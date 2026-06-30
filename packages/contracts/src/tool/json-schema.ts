// A lightweight JSON Schema shape used to validate tool input/output at the
// Tool Registry boundary (docs/02 §11). Intentionally minimal; the registry
// (phase-09) uses a full validator at runtime.

export interface JSONSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: readonly unknown[];
  description?: string;
  [key: string]: unknown;
}
