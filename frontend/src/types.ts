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
  loginMode: string;
  description: string;
  healthCheckEnabled: boolean;
  lastHealth: HealthInfo | null;
}
