import type { UserRole } from './types';

export type Action =
  | 'upload'
  | 'view_documents'
  | 'view_fields'
  | 'approve_field'
  | 'edit_field'
  | 'reject_field'
  | 'batch_action'
  | 'reject_document'
  | 're_extract'
  | 'view_logs'
  | 'view_cost'
  | 'view_team'
  | 'manage_users'
  | 'delete_documents'
  | 'manage_team';

const PERMISSIONS: Record<UserRole, Set<Action>> = {
  operations_executive: new Set([
    'upload',
    'view_documents',
    'view_fields',
    'approve_field',
    'edit_field',
    'reject_field',
  ]),
  team_lead: new Set([
    'upload',
    'view_documents',
    'view_fields',
    'approve_field',
    'edit_field',
    'reject_field',
    'batch_action',
    'reject_document',
    're_extract',
    'view_logs',
    'view_cost',
    'view_team',
  ]),
  administrator: new Set([
    'upload',
    'view_documents',
    'view_fields',
    'approve_field',
    'edit_field',
    'reject_field',
    'batch_action',
    'reject_document',
    're_extract',
    'view_logs',
    'view_cost',
    'view_team',
    'manage_users',
    'delete_documents',
    'manage_team',
  ]),
};

export function hasPermission(role: UserRole, action: Action): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

export function requirePermission(role: UserRole, action: Action): void {
  if (!hasPermission(role, action)) {
    throw new ForbiddenError(`Missing permission: ${action}`);
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
