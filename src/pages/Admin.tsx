import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Activity, Database, TrendingUp, Package } from 'lucide-react';
import { UserManagementTab } from '@/components/admin/UserManagementTab';
import { SystemHealthTab } from '@/components/admin/SystemHealthTab';
import { PredictionsMonitorTab } from '@/components/admin/PredictionsMonitorTab';
import { PremiumTrackingTab } from '@/components/admin/PremiumTrackingTab';
import { AccuracyMetricsTab } from '@/components/admin/AccuracyMetricsTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const Admin = () => {
  const { isAdmin, loading } = useAdminCheck();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    totalPredictions: 0,
    activePremiums: 0
  });

  const tabLabels: Record<string, string> = {
    users: 'User Management',
    system: 'System Health',
    predictions: 'Predictions Monitor',
    premium: 'Premium Tracking',
    metrics: 'Accuracy Metrics',
  };

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      toast.error('Access denied. Admin privileges required.');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    const loadStats = async () => {
      const [profiles, predictions, premiums] = await Promise.all([
        supabase.from('profiles').select('id, is_approved'),
        supabase.from('prediction_tracking').select('id'),
        supabase.from('option_premiums').select('id')
      ]);

      setStats({
        totalUsers: profiles.data?.length || 0,
        pendingUsers: profiles.data?.filter(p => !p.is_approved).length || 0,
        totalPredictions: predictions.data?.length || 0,
        activePremiums: premiums.data?.length || 0
      });
    };

    if (isAdmin) {
      loadStats();

      // Subscribe to realtime updates for pending approvals
      const channel = supabase
        .channel('admin-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'profiles',
            filter: 'is_approved=eq.false'
          },
          () => {
            toast.info('New user signup requires approval');
            loadStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 pt-24 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{tabLabels[activeTab]}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">System management and monitoring</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingUsers} pending approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Predictions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPredictions}</div>
              <p className="text-xs text-muted-foreground">Total tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Data</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePremiums}</div>
              <p className="text-xs text-muted-foreground">Records stored</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Healthy</div>
              <p className="text-xs text-muted-foreground">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="users" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="system">
              <Activity className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <TrendingUp className="h-4 w-4 mr-2" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="premium">
              <Package className="h-4 w-4 mr-2" />
              Premium
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <Database className="h-4 w-4 mr-2" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserManagementTab onStatsUpdate={setStats} />
          </TabsContent>

          <TabsContent value="system">
            <SystemHealthTab />
          </TabsContent>

          <TabsContent value="predictions">
            <PredictionsMonitorTab />
          </TabsContent>

          <TabsContent value="premium">
            <PremiumTrackingTab />
          </TabsContent>

          <TabsContent value="metrics">
            <AccuracyMetricsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
