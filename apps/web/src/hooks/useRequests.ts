import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { type ProcurementRequest } from '../types';
import { useAuthStore } from '../store/authStore';

export function useRequests() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Re-fetch when currentUser changes
  const currentUser = useAuthStore(state => state.currentUser);

  const fetchRequests = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ProcurementRequest[]>('/requests');
      setRequests(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests };
}

export function useRequestDetail(id?: string) {
  const [request, setRequest] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const currentUser = useAuthStore(state => state.currentUser);

  const fetchRequestDetail = useCallback(async () => {
    if (!id || !currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ProcurementRequest>(`/requests/${id}`);
      setRequest(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch request details');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    fetchRequestDetail();
  }, [fetchRequestDetail]);

  return { request, loading, error, refetch: fetchRequestDetail };
}
