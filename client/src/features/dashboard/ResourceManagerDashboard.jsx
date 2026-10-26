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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  MeetingRoom as ResourceIcon,
  EventAvailable as AvailableIcon,
  PendingActions as PendingIcon,
  BuildCircle as MaintenanceIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export const ResourceManagerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // Review Booking Dialog
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('Approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Maintenance Toggle Dialog
  const [maintenanceResource, setMaintenanceResource] = useState(null);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/resource-manager');
      setData(res.data.data);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load resource manager dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleOpenReview = (booking, status) => {
    setSelectedBooking(booking);
    setReviewStatus(status);
    setReviewNotes('');
  };

  const handleConfirmReview = async () => {
    if (!selectedBooking) return;
    try {
      setSubmittingReview(true);
      await api.patch(`/resources/bookings/${selectedBooking._id}/review`, {
        status: reviewStatus,
        reviewNotes,
      });

      showSuccess(`Booking reservation ${reviewStatus.toLowerCase()} successfully.`);
      setSelectedBooking(null);
      fetchDashboard();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to process booking review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleToggleMaintenance = (resource) => {
    setMaintenanceResource(resource);
    setMaintenanceNotes(resource.maintenanceNotes || '');
  };

  const handleConfirmMaintenance = async () => {
    if (!maintenanceResource) return;
    try {
      setSubmittingMaintenance(true);
      const newStatus = !maintenanceResource.isMaintenance;
      await api.put(`/resources/${maintenanceResource._id}`, {
        isMaintenance: newStatus,
        maintenanceNotes: newStatus ? maintenanceNotes : '',
      });

      showSuccess(`Facility maintenance status updated to ${newStatus ? 'Under Maintenance' : 'Operational'}.`);
      setMaintenanceResource(null);
      fetchDashboard();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update resource status.');
    } finally {
      setSubmittingMaintenance(false);
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
          background: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0284c7 100%)',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.25)',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <Chip
                label="CAMPUS RESOURCE OPERATIONS"
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              />
              <Typography variant="caption" sx={{ color: '#bae6fd', fontWeight: 600 }}>
                CampusSync &bull; One Campus. Everything in Sync.
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
              Welcome, {user?.fullName || 'Resource Manager'}!
            </Typography>
            <Typography variant="body1" sx={{ color: '#e0f2fe', maxWidth: 640 }}>
              Oversee smart room scheduling, seminar halls, high-tech engineering labs, and audiovisual equipment. Manage reservations and ensure zero scheduling collisions.
            </Typography>
          </Grid>

          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<ResourceIcon />}
              onClick={() => navigate('/bookings')}
              sx={{
                backgroundColor: '#ffffff',
                color: '#0369a1',
                fontWeight: 700,
                borderRadius: 2.5,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
            >
              Browse Facilities
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
                    ASSIGNED RESOURCES
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.totalAssignedResources || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#f0f9ff', color: '#0284c7', width: 48, height: 48 }}>
                  <ResourceIcon />
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
                    PENDING REQUESTS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#d97706', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.pendingBookingsCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#fef3c7', color: '#d97706', width: 48, height: 48 }}>
                  <PendingIcon />
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
                    UPCOMING BOOKINGS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.upcomingApprovedCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#ecfdf5', color: '#059669', width: 48, height: 48 }}>
                  <AvailableIcon />
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
                    IN MAINTENANCE
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#dc2626', mt: 0.5 }}>
                    {loading ? <Skeleton width={40} /> : data?.maintenanceCount || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#fef2f2', color: '#dc2626', width: 48, height: 48 }}>
                  <MaintenanceIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Tabs Navigation */}
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
            label={`Pending Requests (${data?.pendingBookingsCount || 0})`}
            icon={<PendingIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label={`Assigned Facilities (${data?.totalAssignedResources || 0})`}
            icon={<ResourceIcon fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            label={`Approved Schedule (${data?.upcomingApprovedCount || 0})`}
            icon={<AvailableIcon fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
        <Divider />

        <Box sx={{ p: 3 }}>
          {/* TAB 0: PENDING BOOKINGS */}
          {activeTab === 0 && (
            <Box>
              {loading ? (
                <Stack spacing={2}>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={60} variant="rounded" />
                  ))}
                </Stack>
              ) : !data?.pendingBookings || data.pendingBookings.length === 0 ? (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  All clear! No pending reservation requests require your approval at this time.
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Resource / Facility</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Requested By</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Date & Slot</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Expected Attendees</TableCell>
                        <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Review Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.pendingBookings.map((b) => (
                        <TableRow key={b._id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {b.resource?.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                              {b.resource?.type} &bull; {b.resource?.location}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {b.requestedBy?.fullName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {b.requestedBy?.department?.name || b.requestedBy?.role} &bull; {b.requestedBy?.email}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Typography variant="body2">"{b.purpose}"</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Date(b.date).toLocaleDateString()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {b.startTime} - {b.endTime}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={`${b.expectedAttendees || 1} pax`} size="small" sx={{ fontWeight: 600 }} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                startIcon={<ApproveIcon />}
                                onClick={() => handleOpenReview(b, 'Approved')}
                                sx={{ borderRadius: 2 }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<RejectIcon />}
                                onClick={() => handleOpenReview(b, 'Rejected')}
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

          {/* TAB 1: ASSIGNED RESOURCES & FACILITIES */}
          {activeTab === 1 && (
            <Grid container spacing={3}>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Skeleton height={220} variant="rounded" />
                  </Grid>
                ))
              ) : !data?.assignedResources || data.assignedResources.length === 0 ? (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No campus facilities are currently assigned to your account.
                  </Alert>
                </Grid>
              ) : (
                data.assignedResources.map((res) => (
                  <Grid item xs={12} md={6} lg={4} key={res._id}>
                    <Card
                      sx={{
                        borderRadius: 3,
                        border: res.isMaintenance ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        bgcolor: res.isMaintenance ? '#fef2f2' : '#ffffff',
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {res.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 700 }}>
                              {res.type} &bull; Capacity: {res.capacity}
                            </Typography>
                          </Box>
                          <Chip
                            label={res.isMaintenance ? 'Maintenance' : 'Operational'}
                            color={res.isMaintenance ? 'error' : 'success'}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: '#64748b' }}>
                          <LocationIcon fontSize="small" />
                          <Typography variant="caption">{res.location}</Typography>
                        </Stack>

                        {res.operatingHours && (
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, color: '#64748b' }}>
                            <TimeIcon fontSize="small" />
                            <Typography variant="caption">
                              {res.operatingHours.open} - {res.operatingHours.close}
                            </Typography>
                          </Stack>
                        )}

                        {res.isMaintenance && res.maintenanceNotes && (
                          <Alert severity="warning" sx={{ py: 0.5, px: 1.5, mb: 2, borderRadius: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {res.maintenanceNotes}
                            </Typography>
                          </Alert>
                        )}

                        <Divider sx={{ my: 1.5 }} />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Button
                            size="small"
                            variant="outlined"
                            color={res.isMaintenance ? 'success' : 'warning'}
                            startIcon={<MaintenanceIcon />}
                            onClick={() => handleToggleMaintenance(res)}
                            sx={{ borderRadius: 2 }}
                          >
                            {res.isMaintenance ? 'Mark Operational' : 'Flag Maintenance'}
                          </Button>
                          <Button
                            size="small"
                            endIcon={<ArrowIcon />}
                            onClick={() => navigate(`/bookings?resource=${res._id}`)}
                          >
                            Schedule
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}

          {/* TAB 2: APPROVED SCHEDULE */}
          {activeTab === 2 && (
            <Box>
              {!data?.upcomingApprovedBookings || data.upcomingApprovedBookings.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No upcoming approved reservations for your facilities.
                </Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Resource</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Reserved By</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Time Slot</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.upcomingApprovedBookings.map((b) => (
                        <TableRow key={b._id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {b.resource?.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {b.resource?.location}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {b.requestedBy?.fullName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {b.requestedBy?.department?.name || b.requestedBy?.email}
                            </Typography>
                          </TableCell>
                          <TableCell>{b.purpose}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{new Date(b.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={`${b.startTime} - ${b.endTime}`}
                              size="small"
                              sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label="Confirmed" size="small" color="success" sx={{ fontWeight: 700 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Review Dialog */}
      <Dialog open={Boolean(selectedBooking)} onClose={() => setSelectedBooking(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {reviewStatus === 'Approved' ? 'Approve Booking Request' : 'Reject Booking Request'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Confirm {reviewStatus === 'Approved' ? 'approval' : 'rejection'} for reservation on{' '}
            <strong>{selectedBooking?.resource?.name}</strong> by{' '}
            <strong>{selectedBooking?.requestedBy?.fullName}</strong>.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Review Remarks (Optional)"
            placeholder="Special instructions or reason for rejection..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedBooking(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewStatus === 'Approved' ? 'success' : 'error'}
            onClick={handleConfirmReview}
            disabled={submittingReview}
            sx={{ borderRadius: 2 }}
          >
            {submittingReview ? 'Processing...' : reviewStatus === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={Boolean(maintenanceResource)} onClose={() => setMaintenanceResource(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {maintenanceResource?.isMaintenance ? 'Remove Maintenance Hold' : 'Flag Facility for Maintenance'}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Facility: <strong>{maintenanceResource?.name}</strong>
          </Typography>
          {!maintenanceResource?.isMaintenance ? (
            <TextField
              fullWidth
              multiline
              rows={3}
              required
              label="Maintenance Reason / Work Details"
              placeholder="e.g. Projector lens replacement, HVAC servicing..."
              value={maintenanceNotes}
              onChange={(e) => setMaintenanceNotes(e.target.value)}
            />
          ) : (
            <Typography variant="body2" sx={{ color: '#059669', fontWeight: 600 }}>
              This facility will immediately become available again for campus community reservations.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMaintenanceResource(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={maintenanceResource?.isMaintenance ? 'success' : 'warning'}
            onClick={handleConfirmMaintenance}
            disabled={submittingMaintenance}
            sx={{ borderRadius: 2 }}
          >
            {submittingMaintenance ? 'Saving...' : maintenanceResource?.isMaintenance ? 'Mark Operational' : 'Set Maintenance Hold'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResourceManagerDashboard;
