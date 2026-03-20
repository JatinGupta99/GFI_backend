// 🚀 TypeScript Types for Renewals API
// Copy these types into your frontend project

// ===== CORE DATA MODELS =====

export interface Renewal {
  id: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  suite: string;
  sf: number;
  leaseEnd: string; // ISO date string
  renewalOffer?: string;
  currentMonthRent: number;
  rentPerSf: number;
  budgetRent?: number;
  budgetRentPerSf?: number;
  budgetTI?: number;
  budgetLCD?: string;
  status: RenewalStatus;
  notes?: string;
  option: RenewalOption;
  optionTerm?: string;
  lastSyncAt: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export type RenewalStatus = 
  | 'Renewal Negotiation'
  | 'Drafting Amendment'
  | 'No Contact'
  | 'Renewed'
  | 'Out for Execution'
  | 'Expired';

export type RenewalOption = 'Yes' | 'No' | 'N/A';

// ===== API RESPONSE TYPES =====

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    limit?: number;
    offset?: number;
    cached: boolean;
  };
}

export interface PropertyRenewalsResponse extends ApiResponse<Renewal[]> {
  meta: {
    propertyId: string;
    total: number;
    cached: boolean;
  };
}

export interface UpcomingRenewalsResponse extends ApiResponse<Renewal[]> {
  meta: {
    daysAhead: number;
    total: number;
    cached: boolean;
  };
}

export interface SearchRenewalsResponse extends ApiResponse<Renewal[]> {
  meta: {
    searchTerm: string;
    total: number;
    cached: boolean;
  };
}

// ===== STATISTICS TYPES =====

export interface RenewalStats {
  total: number;
  byStatus: Record<RenewalStatus, number>;
  byProperty: Record<string, number>;
  upcomingCount: number;
  cached: boolean;
}

export interface RenewalStatsResponse extends ApiResponse<RenewalStats> {
  meta: {
    cached: boolean;
  };
}

// ===== SYNC TYPES =====

export interface SyncResult {
  success: boolean;
  propertiesProcessed: number;
  renewalsUpdated: number;
  renewalsCreated: number;
  errors: string[];
  duration: number; // milliseconds
  timestamp: string; // ISO date string
}

export interface SyncJobInfo {
  jobId: string;
  status: JobStatus;
  queuedAt: string; // ISO date string
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  progress: number; // 0-100
  result?: SyncResult;
}

export interface SyncResponse extends ApiResponse<SyncJobInfo> {
  message: string;
}

export interface PropertySyncResponse extends ApiResponse<SyncResult> {
  message: string;
}

export interface JobStatusResponse extends ApiResponse<JobStatus> {}

// ===== QUERY FILTERS =====

export interface RenewalFilters {
  propertyIds?: string[];
  status?: RenewalStatus[];
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  q: string;
  limit?: number;
}

export interface UpcomingFilters {
  days?: number;
}

// ===== API CLIENT TYPES =====

export interface RenewalsApiClient {
  // Query methods
  getRenewals(filters?: RenewalFilters): Promise<PaginatedResponse<Renewal>>;
  getRenewalsByProperty(propertyId: string): Promise<PropertyRenewalsResponse>;
  getUpcomingRenewals(filters?: UpcomingFilters): Promise<UpcomingRenewalsResponse>;
  getRenewalStats(): Promise<RenewalStatsResponse>;
  searchRenewals(filters: SearchFilters): Promise<SearchRenewalsResponse>;
  
  // Sync methods
  syncAllRenewals(): Promise<SyncResponse>;
  syncProperty(propertyId: string): Promise<PropertySyncResponse>;
  syncIncremental(): Promise<SyncResponse>;
  getSyncStatus(jobId: string): Promise<JobStatusResponse>;
  clearSyncQueue(): Promise<ApiResponse<any>>;
  clearCache(): Promise<ApiResponse<any>>;
}

// ===== HOOK TYPES =====

export interface UseRenewalsOptions {
  propertyIds?: string[];
  status?: RenewalStatus[];
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

export interface UseRenewalsResult {
  renewals: Renewal[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  meta?: {
    total: number;
    cached: boolean;
  };
}

export interface UseSyncOptions {
  onProgress?: (progress: number) => void;
  onComplete?: (result: SyncResult) => void;
  onError?: (error: string) => void;
}

export interface UseSyncResult {
  startSync: () => Promise<string>; // returns jobId
  startPropertySync: (propertyId: string) => Promise<SyncResult>;
  startIncrementalSync: () => Promise<string>; // returns jobId
  jobStatus: JobStatus | null;
  isLoading: boolean;
  error: string | null;
}

// ===== COMPONENT PROPS =====

export interface RenewalsTableProps {
  renewals: Renewal[];
  loading?: boolean;
  onRenewalClick?: (renewal: Renewal) => void;
  onPropertyClick?: (propertyId: string) => void;
  showActions?: boolean;
}

export interface RenewalCardProps {
  renewal: Renewal;
  onClick?: () => void;
  showProperty?: boolean;
  compact?: boolean;
}

export interface SyncProgressProps {
  jobId: string;
  onComplete?: (result: SyncResult) => void;
  onError?: (error: string) => void;
}

export interface RenewalStatsProps {
  stats: RenewalStats;
  onStatusClick?: (status: RenewalStatus) => void;
  onPropertyClick?: (propertyId: string) => void;
}

// ===== UTILITY TYPES =====

export interface RenewalSummary {
  id: string;
  tenantName: string;
  propertyName: string;
  suite: string;
  leaseEnd: string;
  status: RenewalStatus;
  daysUntilExpiry: number;
}

export interface PropertyRenewalSummary {
  propertyId: string;
  propertyName: string;
  totalRenewals: number;
  upcomingRenewals: number;
  statusBreakdown: Record<RenewalStatus, number>;
}

// ===== ERROR TYPES =====

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: string[];
}

export interface ValidationError extends ApiError {
  field: string;
  value: any;
}

// ===== CONSTANTS =====

export const RENEWAL_STATUSES: RenewalStatus[] = [
  'Renewal Negotiation',
  'Drafting Amendment',
  'No Contact',
  'Renewed',
  'Out for Execution',
  'Expired'
];

export const RENEWAL_OPTIONS: RenewalOption[] = ['Yes', 'No', 'N/A'];

export const JOB_STATUSES = ['queued', 'active', 'completed', 'failed'] as const;

// ===== API ENDPOINTS =====

export const API_ENDPOINTS = {
  // Query endpoints
  RENEWALS: '/api/renewals',
  PROPERTY_RENEWALS: (propertyId: string) => `/api/renewals/property/${propertyId}`,
  UPCOMING_RENEWALS: '/api/renewals/upcoming',
  RENEWAL_STATS: '/api/renewals/stats',
  SEARCH_RENEWALS: '/api/renewals/search',
  
  // Sync endpoints
  SYNC_ALL: '/api/renewals/sync',
  SYNC_PROPERTY: (propertyId: string) => `/api/renewals/sync/property/${propertyId}`,
  SYNC_INCREMENTAL: '/api/renewals/sync/incremental',
  SYNC_STATUS: (jobId: string) => `/api/renewals/sync/status/${jobId}`,
  SYNC_CLEAR: '/api/renewals/sync/clear',
  
  // Cache endpoints
  CACHE_CLEAR: '/api/renewals/cache/clear'
} as const;

// ===== EXAMPLE USAGE =====

/*
// Example: Using the types in a React component

import React, { useState, useEffect } from 'react';
import { Renewal, RenewalFilters, PaginatedResponse } from './renewals-types';

export function RenewalsPage() {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RenewalFilters>({
    limit: 50,
    offset: 0
  });

  const fetchRenewals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.propertyIds) {
        filters.propertyIds.forEach(id => params.append('propertyIds', id));
      }
      
      if (filters.status) {
        filters.status.forEach(s => params.append('status', s));
      }
      
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/renewals?${params}`);
      const data: PaginatedResponse<Renewal> = await response.json();
      
      if (data.success) {
        setRenewals(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch renewals:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, [filters]);

  return (
    <div>
      {loading ? (
        <div>Loading renewals...</div>
      ) : (
        <div>
          {renewals.map(renewal => (
            <div key={renewal.id}>
              {renewal.tenantName} - {renewal.suite}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
*/