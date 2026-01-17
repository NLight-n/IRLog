import { prisma } from './prisma/prisma';

export interface AuditLogData {
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
  userID: number;
  affectedTable: string;
  affectedRowID: number;
  dataBefore?: any;
  dataAfter?: any;
}

export async function logAuditEvent(auditData: AuditLogData) {
  try {
    await prisma.auditLog.create({
      data: {
        actionType: auditData.actionType,
        userID: auditData.userID,
        affectedTable: auditData.affectedTable,
        affectedRowID: auditData.affectedRowID,
        dataBefore: auditData.dataBefore ? JSON.parse(JSON.stringify(auditData.dataBefore)) : null,
        dataAfter: auditData.dataAfter ? JSON.parse(JSON.stringify(auditData.dataAfter)) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw error to avoid breaking the main operation
  }
}

export function getTableDisplayName(tableName: string): string {
  const tableNames: { [key: string]: string } = {
    'ProcedureLog': 'Procedure Log',
    'Procedure': 'Procedure',
    'Physician': 'Physician',
    'User': 'User',
    'Permission': 'Permission',
  };
  return tableNames[tableName] || tableName;
}

export function getActionDisplayName(actionType: string): string {
  const actionNames: { [key: string]: string } = {
    'CREATE': 'Created',
    'UPDATE': 'Updated',
    'DELETE': 'Deleted',
  };
  return actionNames[actionType] || actionType;
} 