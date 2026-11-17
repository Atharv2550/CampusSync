import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Skeleton,
  Tooltip,
  IconButton,
  Avatar,
  InputAdornment,
} from '@mui/material';
import {
  MenuBook as SubjectIcon,
  CheckCircle as EnrolledIcon,
  Cancel as WithdrawIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Person as FacultyIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Info as InfoIcon,
  School as AcademicIcon,
  ErrorOutline as FullIcon,
} from '@mui/icons-material';

import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export const StudentSubjectEnrollmentSection = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [studentCohort, setStudentCohort] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('enrolled'); // 'enrolled' or 'browse'

  // Withdraw Dialog
  const [openWithdrawDialog, setOpenWithdrawDialog] = useState(false);
  const [withdrawingItem, setWithdrawingItem] = useState(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);

  // Enroll In Progress
  const [enrollingSubjectId, setEnrollingSubjectId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [availRes, myRes] = await Promise.all([
        api.get('/enrollments/available'),
        api.get('/enrollments/my'),
      ]);

      setAvailableSubjects(availRes.data.data || []);
      setStudentCohort(availRes.data.studentCohort || null);
      setMyEnrollments(myRes.data.data || []);
    } catch (err) {
      console.error('Failed to load subject enrollment data:', err);
      showError('Unable to load subject offerings and enrollment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Self-enroll handler
  const handleEnroll = async (subject) => {
    try {
      setEnrollingSubjectId(subject._id);
      const res = await api.post('/enrollments/enroll', { subjectId: subject._id });
      showSuccess(res.data.message || `Enrolled in ${subject.code} successfully!`);
      loadData();
    } catch (err) {
      console.error('Self-enrollment failed:', err);
      showError(err.response?.data?.message || 'Failed to enroll in subject.');
    } finally {
      setEnrollingSubjectId(null);
    }
  };

  // Open Withdraw Dialog
  const handleOpenWithdraw = (enrollment) => {
    setWithdrawingItem(enrollment);
    setWithdrawReason('');
    setOpenWithdrawDialog(true);
  };

  // Submit Withdrawal
  const handleConfirmWithdraw = async () => {
    if (!withdrawingItem) return;
    try {
      setProcessingWithdrawal(true);
      await api.post('/enrollments/withdraw', {
        enrollmentId: withdrawingItem._id,
        reason: withdrawReason.trim() || 'Student course drop',
      });
      showSuccess(`Withdrawn from ${withdrawingItem.subject?.name || 'subject'}.`);
      setOpenWithdrawDialog(false);
      loadData();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      showError(err.response?.data?.message || 'Failed to withdraw from subject.');
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  // Filter available subjects by search
  const filteredAvailable = availableSubjects.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.code?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.assignedFaculty?.fullName?.toLowerCase().includes(q)
    );
  });

  const activeEnrolledCount = myEnrollments.filter((e) => e.status === 'enrolled').length;

  if (loading) {
    return (
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', mb: 3.5 }}>
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 2, mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2.5 }} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 3.5,
        border: '1px solid #e2e8f0',
        mb: 3.5,
        bgcolor: '#ffffff',
      }}
    >
      {/* Header & Cohort Info */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
          mb: 2.5,
          gap: 1.5,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SubjectIcon sx={{ color: '#2563eb', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
              My Subjects & Course Enrollment
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            {studentCohort?.department || 'Department'} • {studentCohort?.academicYear || 'Academic Year'}
            {studentCohort?.classDivision ? ` • Cohort: ${studentCohort.classDivision.name}` : ''}
          </Typography>
        </Box>

        {/* Tab Switcher Pills */}
        <Stack direction="row" spacing={1}>
          <Button
            variant={activeTab === 'enrolled' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setActiveTab('enrolled')}
            sx={{
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              bgcolor: activeTab === 'enrolled' ? '#2563eb' : 'transparent',
            }}
          >
            My Enrolled Subjects ({activeEnrolledCount})
          </Button>
          <Button
            variant={activeTab === 'browse' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setActiveTab('browse')}
            sx={{
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              bgcolor: activeTab === 'browse' ? '#0d9488' : 'transparent',
            }}
          >
            Available Offerings ({availableSubjects.length})
          </Button>
        </Stack>
      </Box>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: MY ENROLLED SUBJECTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'enrolled' && (
        <Box>
          {activeEnrolledCount === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2.5 }}>
              <AcademicIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No subjects currently enrolled
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                You have not registered for any active subjects yet. Browse eligible subjects to self-enroll.
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => setActiveTab('browse')}
                sx={{ bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' }, textTransform: 'none', fontWeight: 700 }}
              >
                Browse Available Subjects
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {myEnrollments
                .filter((e) => e.status === 'enrolled')
                .map((enr) => {
                  const subj = enr.subject;
                  const faculty = enr.primaryFaculty;
                  const slots = enr.timetableSlots || [];

                  return (
                    <Grid item xs={12} md={6} key={enr._id}>
                      <Card
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          border: '1px solid #e2e8f0',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: '#93c5fd', boxShadow: '0 4px 12px rgba(37,99,235,0.06)' },
                        }}
                      >
                        <Box>
                          {/* Subject Header */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                <Chip
                                  label={subj?.code}
                                  size="small"
                                  sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                                />
                                <Chip
                                  label={`${subj?.credits || 3} Credits`}
                                  size="small"
                                  sx={{ fontSize: '0.7rem', fontWeight: 700 }}
                                />
                                <Chip
                                  label={`Sem ${subj?.semester}`}
                                  size="small"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              </Stack>
                              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                {subj?.name}
                              </Typography>
                            </Box>
                            <Chip
                              label="ENROLLED"
                              size="small"
                              color="success"
                              icon={<EnrolledIcon />}
                              sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                            />
                          </Box>

                          {/* Faculty Info */}
                          {faculty ? (
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ my: 1.5, p: 1, bgcolor: '#f8fafc', borderRadius: 2 }}>
                              <Avatar sx={{ width: 30, height: 30, fontSize: '0.75rem', bgcolor: '#2563eb' }}>
                                {faculty.fullName?.charAt(0) || 'P'}
                              </Avatar>
                              <Box>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', display: 'block' }}>
                                  Prof. {faculty.fullName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {faculty.email}
                                </Typography>
                              </Box>
                            </Stack>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', display: 'block', my: 1 }}>
                              Faculty instructor pending assignment
                            </Typography>
                          )}

                          {/* Timetable Slots */}
                          {slots.length > 0 ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                              {slots.map((s, idx) => (
                                <Chip
                                  key={idx}
                                  icon={<TimeIcon sx={{ fontSize: 14 }} />}
                                  label={`${s.dayOfWeek}: ${s.startTime}-${s.endTime} (${s.room})`}
                                  size="small"
                                  sx={{ fontSize: '0.7rem', bgcolor: '#f1f5f9' }}
                                />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                              Weekly timetable published in schedule portal
                            </Typography>
                          )}
                        </Box>

                        {/* Card Footer */}
                        <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Enrolled: {new Date(enr.effectiveEnrollmentDate).toLocaleDateString()}
                          </Typography>
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            startIcon={<WithdrawIcon />}
                            onClick={() => handleOpenWithdraw(enr)}
                            sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Drop / Withdraw
                          </Button>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
            </Grid>
          )}
        </Box>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: BROWSE AVAILABLE SUBJECTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'browse' && (
        <Box>
          {/* Search Bar */}
          <Box sx={{ mb: 2.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search available subjects by code, title, or professor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {filteredAvailable.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2.5 }}>
              <SubjectIcon sx={{ fontSize: 44, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No eligible subjects found
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                No active subjects matching your department, semester, and cohort are available at this time.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {filteredAvailable.map((subj) => (
                <Grid item xs={12} md={6} key={subj._id}>
                  <Card
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: '1px solid #e2e8f0',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: subj.isEnrolled ? 0.85 : 1,
                    }}
                  >
                    <Box>
                      {/* Code, Status, and Title */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={subj.code}
                            size="small"
                            sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                          />
                          <Chip label={`${subj.credits || 3} Credits`} size="small" sx={{ fontSize: '0.7rem' }} />
                          <Chip label={`Sem ${subj.semester}`} size="small" sx={{ fontSize: '0.7rem' }} />
                        </Stack>

                        {subj.isEnrolled && (
                          <Chip
                            label="ENROLLED"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>

                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                        {subj.name}
                      </Typography>

                      {subj.description && (
                        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem', mb: 1.5 }}>
                          {subj.description}
                        </Typography>
                      )}

                      {/* Capacity & Faculty Info */}
                      <Stack direction="row" spacing={2} sx={{ my: 1 }} alignItems="center">
                        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                          Seats: {subj.enrolledCount} / {subj.maxCapacity || 60}
                        </Typography>
                        {subj.assignedFaculty && (
                          <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>
                            • Prof. {subj.assignedFaculty.fullName}
                          </Typography>
                        )}
                      </Stack>

                      {/* Timetable Slots */}
                      {subj.timetableSlots && subj.timetableSlots.length > 0 && (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                          {subj.timetableSlots.map((s, idx) => (
                            <Chip
                              key={idx}
                              icon={<TimeIcon sx={{ fontSize: 13 }} />}
                              label={`${s.dayOfWeek}: ${s.startTime}-${s.endTime} (${s.room})`}
                              size="small"
                              sx={{ fontSize: '0.68rem', bgcolor: '#f8fafc' }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>

                    {/* Enrollment Action Button */}
                    <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                      {subj.isEnrolled ? (
                        <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700 }}>
                          ✓ You are actively enrolled in this subject.
                        </Typography>
                      ) : subj.canEnroll ? (
                        <Button
                          variant="contained"
                          size="small"
                          fullWidth
                          startIcon={<AddIcon />}
                          disabled={enrollingSubjectId === subj._id}
                          onClick={() => handleEnroll(subj)}
                          sx={{
                            bgcolor: '#2563eb',
                            textTransform: 'none',
                            fontWeight: 700,
                            borderRadius: 2,
                            '&:hover': { bgcolor: '#1d4ed8' },
                          }}
                        >
                          {enrollingSubjectId === subj._id ? 'Enrolling...' : 'Enroll in Subject'}
                        </Button>
                      ) : (
                        <Alert severity="info" sx={{ py: 0.5, px: 1.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          {subj.ineligibilityReason || 'Enrollment unavailable'}
                        </Alert>
                      )}
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ------------------------------------------------------------- */}
      {/* WITHDRAW CONFIRMATION DIALOG */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={openWithdrawDialog}
        onClose={() => !processingWithdrawal && setOpenWithdrawDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm Subject Withdrawal</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#334155', mb: 2 }}>
            Are you sure you want to withdraw from{' '}
            <strong>
              {withdrawingItem?.subject?.code} - {withdrawingItem?.subject?.name}
            </strong>
            ?
          </Typography>
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
            Historical attendance records for completed lectures will be preserved. You will no longer be included on future session rosters.
          </Alert>
          <TextField
            fullWidth
            size="small"
            label="Reason for withdrawal (optional)"
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            placeholder="e.g. Course dropped, schedule conflict..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenWithdrawDialog(false)} disabled={processingWithdrawal}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmWithdraw}
            disabled={processingWithdrawal}
            sx={{ fontWeight: 700 }}
          >
            {processingWithdrawal ? 'Withdrawing...' : 'Confirm Withdrawal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

