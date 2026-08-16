import { useState, useEffect } from 'react';
import api from '../lib/api';
import { type EquipmentProduct } from '../types';
import { useAuthStore } from '../store/authStore';

export function useEquipment() {
  const [products, setProducts] = useState<EquipmentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore(state => state.currentUser);

  useEffect(() => {
    // 若尚未有 currentUser，則不發送請求，避免 401 錯誤
    if (!currentUser) return;

    let mounted = true;
    const fetchEquipment = async () => {
      try {
        const res = await api.get('/equipment/products');
        if (mounted) {
          setProducts(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load equipment', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchEquipment();
    return () => { mounted = false; };
  }, [currentUser]);

  return { products, loading };
}
