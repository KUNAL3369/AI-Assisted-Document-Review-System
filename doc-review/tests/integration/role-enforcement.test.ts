import { describe, it, expect } from 'vitest';
import { hasPermission, requirePermission, ForbiddenError } from '../../src/lib/permissions';

describe('Role enforcement', () => {
  describe('hasPermission', () => {
    it('allows operations_executive to approve fields', () => {
      expect(hasPermission('operations_executive', 'approve_field')).toBe(true);
    });

    it('allows operations_executive to edit fields', () => {
      expect(hasPermission('operations_executive', 'edit_field')).toBe(true);
    });

    it('denies operations_executive batch_action', () => {
      expect(hasPermission('operations_executive', 'batch_action')).toBe(false);
    });

    it('denies operations_executive reject_document', () => {
      expect(hasPermission('operations_executive', 'reject_document')).toBe(false);
    });

    it('denies operations_executive view_logs', () => {
      expect(hasPermission('operations_executive', 'view_logs')).toBe(false);
    });

    it('denies operations_executive manage_users', () => {
      expect(hasPermission('operations_executive', 'manage_users')).toBe(false);
    });
  });

  describe('team_lead permissions', () => {
    it('allows team_lead batch_action', () => {
      expect(hasPermission('team_lead', 'batch_action')).toBe(true);
    });

    it('allows team_lead reject_document', () => {
      expect(hasPermission('team_lead', 'reject_document')).toBe(true);
    });

    it('allows team_lead view_logs', () => {
      expect(hasPermission('team_lead', 'view_logs')).toBe(true);
    });

    it('allows team_lead re_extract', () => {
      expect(hasPermission('team_lead', 're_extract')).toBe(true);
    });

    it('denies team_lead manage_users', () => {
      expect(hasPermission('team_lead', 'manage_users')).toBe(false);
    });

    it('denies team_lead delete_documents', () => {
      expect(hasPermission('team_lead', 'delete_documents')).toBe(false);
    });
  });

  describe('administrator permissions', () => {
    it('allows administrator manage_users', () => {
      expect(hasPermission('administrator', 'manage_users')).toBe(true);
    });

    it('allows administrator delete_documents', () => {
      expect(hasPermission('administrator', 'delete_documents')).toBe(true);
    });

    it('allows administrator manage_team', () => {
      expect(hasPermission('administrator', 'manage_team')).toBe(true);
    });

    it('allows administrator all lower permissions', () => {
      expect(hasPermission('administrator', 'approve_field')).toBe(true);
      expect(hasPermission('administrator', 'batch_action')).toBe(true);
      expect(hasPermission('administrator', 'view_logs')).toBe(true);
    });
  });

  describe('requirePermission throws', () => {
    it('throws ForbiddenError when operations_executive calls batch_action', () => {
      expect(() => requirePermission('operations_executive', 'batch_action')).toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when team_lead calls manage_users', () => {
      expect(() => requirePermission('team_lead', 'manage_users')).toThrow(ForbiddenError);
    });

    it('does not throw for valid permission', () => {
      expect(() => requirePermission('administrator', 'manage_users')).not.toThrow();
    });
  });

  describe('handleApiError', () => {
    it('returns 403 for ForbiddenError', async () => {
      const { handleApiError } = await import('../../src/lib/auth/guard');

      const error = new ForbiddenError('Missing permission');
      const response = handleApiError(error);
      expect(response.status).toBe(403);
    });

    it('returns 401 for UnauthorizedError', async () => {
      const { handleApiError, UnauthorizedError } = await import('../../src/lib/auth/guard');

      const response = handleApiError(new UnauthorizedError('Auth required'));
      expect(response.status).toBe(401);
    });
  });
});
