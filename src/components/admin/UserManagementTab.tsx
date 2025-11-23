import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, X, Search, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Profile {
  id: string;
  email: string;
  mobile_number: string | null;
  date_of_birth: string | null;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
}

interface UserManagementTabProps {
  onStatsUpdate: (stats: any) => void;
}

export const UserManagementTab = ({ onStatsUpdate }: UserManagementTabProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load users');
    } else {
      setProfiles(data || []);
      onStatsUpdate((prev: any) => ({
        ...prev,
        totalUsers: data?.length || 0,
        pendingUsers: data?.filter(p => !p.is_approved).length || 0
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleApprove = async (userId: string, email: string) => {
    setProcessingIds(prev => new Set(prev).add(userId));
    
    const { error } = await supabase.functions.invoke('admin-approve-user', {
      body: { user_id: userId, action: 'approve' }
    });

    if (error) {
      toast.error(`Failed to approve user: ${error.message}`);
    } else {
      toast.success(`User ${email} approved successfully`);
      await loadProfiles();
    }

    setProcessingIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleReject = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to reject ${email}? This will delete their account.`)) {
      return;
    }

    setProcessingIds(prev => new Set(prev).add(userId));

    const { error } = await supabase.functions.invoke('admin-approve-user', {
      body: { user_id: userId, action: 'reject' }
    });

    if (error) {
      toast.error(`Failed to reject user: ${error.message}`);
    } else {
      toast.success(`User ${email} rejected and removed`);
      await loadProfiles();
    }

    setProcessingIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  const toggleRole = async (userId: string, email: string, isCurrentlyAdmin: boolean) => {
    setProcessingIds(prev => new Set(prev).add(userId));

    if (isCurrentlyAdmin) {
      // Remove admin role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) {
        toast.error('Failed to remove admin role');
      } else {
        toast.success(`Removed admin role from ${email}`);
      }
    } else {
      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (error) {
        toast.error('Failed to add admin role');
      } else {
        toast.success(`Granted admin role to ${email}`);
      }
    }

    setProcessingIds(prev => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    await loadProfiles();
  };

  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.mobile_number?.includes(searchTerm)
  );

  const pendingProfiles = filteredProfiles.filter(p => !p.is_approved);

  return (
    <div className="space-y-6">
      {/* Pending Approvals */}
      {pendingProfiles.length > 0 && (
        <Card className="border-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="destructive">{pendingProfiles.length}</Badge>
              Pending Approvals
            </CardTitle>
            <CardDescription>New user signups awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingProfiles.slice(0, 5).map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{profile.email}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Mobile: {profile.mobile_number || 'N/A'}</span>
                      <span>DOB: {profile.date_of_birth || 'N/A'}</span>
                      <span>Signed up: {format(new Date(profile.created_at), 'PPp')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(profile.id, profile.email)}
                      disabled={processingIds.has(profile.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(profile.id, profile.email)}
                      disabled={processingIds.has(profile.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No users found</TableCell>
                </TableRow>
              ) : (
                filteredProfiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>{profile.mobile_number || '-'}</TableCell>
                    <TableCell>
                      {profile.is_approved ? (
                        <Badge variant="default">Approved</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <User className="h-3 w-3 mr-1" />
                        User
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(profile.created_at), 'PP')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!profile.is_approved && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(profile.id, profile.email)}
                              disabled={processingIds.has(profile.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(profile.id, profile.email)}
                              disabled={processingIds.has(profile.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
