// The authenticated principal — see docs/02 §5 (Identity) and phase-05.
// The `id` is the platform user id and equals what RLS sees via auth.uid()
// (docs/09_DATABASE_DESIGN.md §4, docs/11_SECURITY_GUIDE.md §1).

export interface AuthUser {
  id: string;
  email: string;
}
