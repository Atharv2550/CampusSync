import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Stack,
  Divider,
  Skeleton,
  Alert,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Groups as ClubsIcon,
  Event as EventIcon,
  VolunteerActivism as VolunteerIcon,
  HowToReg as ApprovalIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Campaign as AnnouncementIcon,
  Add as AddIcon,
  ArrowForward as ArrowIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export const CoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Review Dialog State
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewAction, setReviewAction] = useState('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/coordinator');
      setData(res.data.data);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load coordinator dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleOpenReview = (app, action) => {
    setSelectedApp(app);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleConfirmReview = async () => {
    if (!selectedApp) return;
    try {
      setSubmittingReview(true);
      const clubId = selectedApp.club?._id || selectedApp.club;
      await api.patch(`/clubs/${clubId}/members/${selectedApp._id}/review`, {
        status: reviewAction,
        reviewNotes,
      });

      showSuccess(`Membership application ${reviewAction === 'approved' ? 'approved' : 'rejected'} successfully.`);
      setSelectedApp(null);
      fetchDashboard();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update membership application.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Welcome Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          borderRadius: 3.5,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.25)',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <Chip
                label="CLUB COORDINATOR PORTAL"
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              />
              <Typography variant="caption" sx={{ color: '#93c5fd', fontWeight: 600 }}>
                CampusSync &bull; One Campus. Everything in Sync.
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
              Welcome, {user?.fullName || 'Coordinator'}!
            </Typography>
            <Typography variant="body1" sx={{ color: '#bfdbfe', maxWidth: 640 }}>
              Lead your campus student organizations, review membership applications, schedule premier hackathons and workshops, and guide volunteer initiatives.
            </Typography>
          </Grid>

          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<EventIcon />}
              onClick={() => navigate('/events')}
              sx={{
                backgroundColor: '#ffffff',
                color: '#1e3a8a',
                fontWeight: 700,
                borderRadius: 2.5,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
            >
              Post Event
            </Button>
            <IconButton
              onClick={fetchDashboard}
              sx={{
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Paper>

      {/* Metric Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                    ASSIGNED CLUBS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.totalAssignedClubs || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#eff6ff', color: '#2563eb', width: 48, height: 48 }}>
                  <ClubsIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                    ACTIVE MEMBERS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.approvedMembersCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#ecfdf5', color: '#059669', width: 48, height: 48 }}>
                  <PersonIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 3,
              border: '1px solid #fed7aa',
              backgroundColor: '#fffbeb',
              boxShadow: 'none',
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700 }}>
                    PENDING APPLICATIONS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#d97706', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.pendingMembershipsCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#fef3c7', color: '#d97706', width: 48, height: 48 }}>
                  <ApprovalIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                    UPCOMING EVENTS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.upcomingEventsCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', width: 48, height: 48 }}>
                  <EventIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Navigation */}
      <Paper sx={{ borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            px: 2,
            pt: 1,
            '& .MuiTab-root': { fontWeight: 700, fontSize: '0.95rem' },
          }}
        >
          <Tab
            label={`Pending Applications (${data?.pendingMembershipsCount || 0})`}
            icon={<ApprovalIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label={`My Assigned Clubs (${data?.totalAssignedClubs || 0})`}
            icon={<ClubsIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label={`Upcoming Activities (${data?.upcomingEventsCount || 0})`}
            icon={<EventIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
        <Divider />

        <Box sx={{ p: 3 }}>
          {/* TAB 0: PENDING MEMBERSHIPS */}
          {activeTab === 0 && (
            <Box>
              {loading ? (
                <Stack spacing={2}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={60} variant="rounded" />
                  ))}
                </Stack>
              ) : !data?.pendingMemberships || data.pendingMemberships.length === 0 ? (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  All clear! There are currently no pending club membership applications requiring review.
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Applicant</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Club</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Department / Student ID</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Motivation</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Applied Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.pendingMemberships.map((app) => (
                        <TableRow key={app._id} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar src={app.user?.avatar || ''} sx={{ width: 36, height: 36, bgcolor: '#2563eb' }}>
                                {app.user?.fullName?.[0] || 'U'}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {app.user?.fullName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {app.user?.email}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={app.club?.name || 'Club'}
                              size="small"
                              sx={{ fontWeight: 600, bgcolor: '#eff6ff', color: '#1e40af' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{app.user?.department?.name || 'General'}</Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {app.user?.studentId || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#334155' }}>
                              "{app.applicationReason || 'No reason provided.'}"
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {new Date(app.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<ApproveIcon />}
                                onClick={() => handleOpenReview(app, 'approved')}
                                sx={{ borderRadius: 2 }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<RejectIcon />}
                                onClick={() => handleOpenReview(app, 'rejected')}
                                sx={{ borderRadius: 2 }}
                              >
                                Reject
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* TAB 1: ASSIGNED CLUBS */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              {loading ? (
                [1, 2].map((i) => (
                  <Grid item xs={12} md={6} key={i}>
                    <Skeleton height={200} variant="rounded" />
                  </Grid>
                ))
              ) : !data?.assignedClubs || data.assignedClubs.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No clubs are currently assigned to your account. Please contact an administrator to assign you to a campus organization.
                  </Alert>
                </Grid>
              ) : (
                data.assignedClubs.map((club) => (
                  <Grid item xs={12} md={6} key={club._id}>
                    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 1 }}>
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {club.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700 }}>
                              {club.code} &bull; {club.category}
                            </Typography>
                          </Box>
                          <Chip label={club.status || 'Active'} color="success" size="small" sx={{ fontWeight: 700 }} />
                        </Stack>

                        <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                          {club.description}
                        </Typography>

                        {club.meetingInfo && (
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, color: '#64748b' }}>
                            <TimeIcon fontSize="small" />
                            <Typography variant="caption">{club.meetingInfo}</Typography>
                          </Stack>
                        )}

                        <Divider sx={{ my: 1.5 }} />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Dept: {club.department?.name || 'Inter-disciplinary'}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowIcon />}
                            onClick={() => navigate(`/clubs/${club._id}`)}
                            sx={{ borderRadius: 2 }}
                          >
                            Manage Club
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}

          {/* TAB 2: UPCOMING ACTIVITIES */}
          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: '#0f172a' }}>
                  Club Events
                </Typography>
                {!data?.upcomingEvents || data.upcomingEvents.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No upcoming events scheduled for your assigned clubs.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {data.upcomingEvents.map((evt) => (
                      <Paper key={evt._id} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {evt.title}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1, color: '#64748b' }}>
                          <Typography variant="caption">
                            {new Date(evt.startDate).toLocaleDateString()} at {new Date(evt.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                          <Typography variant="caption">&bull; {evt.venue}</Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: '#0f172a' }}>
                  Volunteering Initiatives
                </Typography>
                {!data?.volunteeringDrives || data.volunteeringDrives.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No volunteering drives currently open for your clubs.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {data.volunteeringDrives.map((v) => (
                      <Paper key={v._id} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {v.title}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1, color: '#64748b' }}>
                          <Typography variant="caption">{new Date(v.date).toLocaleDateString()}</Typography>
                          <Typography variant="caption">&bull; {v.hoursGranted} Verified Service Hours</Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Grid>
            </Grid>
          )}
        </Box>
      </Paper>

      {/* Review Dialog */}
      <Dialog open={Boolean(selectedApp)} onClose={() => setSelectedApp(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {reviewAction === 'approved' ? 'Approve Membership' : 'Reject Membership'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Confirm {reviewAction === 'approved' ? 'approval' : 'rejection'} for applicant{' '}
            <strong>{selectedApp?.user?.fullName}</strong> into <strong>{selectedApp?.club?.name}</strong>.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Review Notes (Optional)"
            placeholder="Add comments or welcome instructions for the applicant..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedApp(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewAction === 'approved' ? 'success' : 'error'}
            onClick={handleConfirmReview}
            disabled={submittingReview}
            sx={{ borderRadius: 2 }}
          >
            {submittingReview ? 'Processing...' : reviewAction === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CoordinatorDashboard;
