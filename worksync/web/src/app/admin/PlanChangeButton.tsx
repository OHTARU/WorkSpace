'use client';

import { useState } from 'react';
import { updateUserPlan } from './actions';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export function PlanChangeButton({ userId, currentPlanName }: { userId: string, currentPlanName: string }) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (newPlan: string) => {
    if (newPlan === currentPlanName) return;
    if (!confirm(`사용자의 플랜을 ${newPlan}(으)로 변경하시겠습니까?`)) return;

    setLoading(true);
    try {
      await updateUserPlan(userId, newPlan);
      toast.success('플랜이 변경되었습니다.');
    } catch (error) {
      toast.error('플랜 변경에 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  }

  return (
    <select
      value={currentPlanName}
      onChange={(e) => handleChange(e.target.value)}
      className="text-xs border-gray-300 rounded-md shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
      disabled={loading}
    >
      <option value="free">Free</option>
      <option value="pro">Pro</option>
      <option value="business">Business</option>
    </select>
  );
}
