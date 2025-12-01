'use client';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ProfitChart from '@/components/dashboard/profit-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfitStatsPage() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role !== 'ADMIN') {
        // You could redirect to a dedicated 'unauthorized' page as well
        router.replace('/dashboard');
    }
  }, [role, loading, router]);

  if (loading || role !== 'ADMIN') {
    return null; // Or a loading/unauthorized component
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Profit Statistics</h1>
        <p className="text-muted-foreground">Detailed analysis of profit margins and revenue streams.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Monthly Profit</CardTitle>
          <CardDescription>January - June 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfitChart />
        </CardContent>
      </Card>
    </div>
  );
}
