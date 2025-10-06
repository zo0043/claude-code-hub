export interface SystemSettings {
  id: number;
  siteTitle: string;
  allowGlobalUsageView: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSystemSettingsInput {
  siteTitle: string;
  allowGlobalUsageView: boolean;
}
