export interface HealthInfo {
  status: string;
  statusCode: number | null;
  responseMs: number | null;
  checkedAt: string;
  skipped?: boolean;
}

export interface ResourceStatus {
  id: string;
  name: string;
  url: string;
  group: string;
  groupSortOrder: number;
  sortOrder: number;
  description: string;
  healthCheckEnabled: boolean;
  ownerId?: string | null;
  hasPrivateKey?: boolean;
  sshEnabled?: boolean;
  webLoginEnabled?: boolean;
  lastHealth: HealthInfo | null;
}

export interface UserPermission {
  type: 'group' | 'resource';
  target: string;
}
