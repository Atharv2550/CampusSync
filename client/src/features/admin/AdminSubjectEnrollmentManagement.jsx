import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Stack,
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
  MenuItem,
  Alert,
  IconButton,
  Tabs,
  Tab,
  Skeleton,
  Tooltip,
  Divider,
  Avatar,
  InputAdornment,
  TablePagination,
} from '@mui/material';
import {
  MenuBook as SubjectIcon,
  People as StudentIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  PersonAdd as AssignIcon,
  Groups as ClassCohortIcon,
  School as FacultyIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Warning as ConflictIcon,
  SwapHoriz as StatusIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AdminSubjectEnrollmentManagement = () => {
  const { showSuccess, showError } = useToast();

  const [subTab, setSubTab] = useState(0); // 0 = Subjects, 1 = Enrollments
  const [loading, setLoading] = useState(true);

  // Common metadata
  const [departments, setDepartments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [studentUsers, setStudentUsers] = useState([]);

  // --- Subjects State ---
  const [subjects, setSubjects] = useState([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectDeptFilter, setSubjectDeptFilter] = useState('all');
  const [subjectSemFilter, setSubjectSemFilter] = useState('all');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('all');

  // Create / Edit Subject Dialog
  const [openSubjectDialog, setOpenSubjectDialog] = useState(false);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    department: '',
    semester: 5,
    academicYear: '2026-2027',
    credits: 3,
    lectureHoursPerWeek: 3,
    maxCapacity: 60,
    selfEnrollmentAllowed: true,
    status: 'active',
    description: '',
    eligibleClasses: [],
  });
  const [savingSubject, setSavingSubject] = useState(false);

  // Assign Faculty to Subject Dialog
  const [openAssignFacultyDialog, setOpenAssignFacultyDialog] = useState(false);
  const [assignFacultySubject, setAssignFacultySubject] = useState(null);
  const [facultyAssignForm, setFacultyAssignForm] = useState({
    facultyId: '',
    classDivisionId: '',
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    room: 'LH-201',
    activityType: 'Theory',
  });
  const [savingFacultyAssignment, setSavingFacultyAssignment] = useState(false);
  const [conflictErrors, setConflictErrors] = useState([]);

  // View Enrolled Students Dialog
  const [viewEnrolledDialog, setViewEnrolledDialog] = useState(false);
  const [viewSubject, setViewSubject] = useState(null);
  const [subjectEnrolledStudents, setSubjectEnrolledStudents] = useState([]);
  const [loadingEnrolledStudents, setLoadingEnrolledStudents] = useState(false);

  // --- Enrollments State ---
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentTotal, setEnrollmentTotal] = useState(0);
  const [enrollmentPage, setEnrollmentPage] = useState(0);
  const [enrollmentLimit, setEnrollmentLimit] = useState(25);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentSubjectFilter, setEnrollmentSubjectFilter] = useState('all');
  const [enrollmentClassFilter, setEnrollmentClassFilter] = useState('all');
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('all');

  // Assign Student Dialog
  const [openAssignStudentDialog, setOpenAssignStudentDialog] = useState(false);
  const [assignStudentForm, setAssignStudentForm] = useState({
    subjectId: '',
    studentIds: [],
    classDivisionId: '',
    effectiveEnrollmentDate: new Date().toISOString().split('T')[0],
    notes: 'Assigned by administrator',
  });
  const [savingStudentAssignment, setSavingStudentAssignment] = useState(false);

  // Assign Class Cohort Dialog
  const [openAssignClassDialog, setOpenAssignClassDialog] = useState(false);
  const [assignClassForm, setAssignClassForm] = useState({
    subjectId: '',
    classDivisionId: '',
    effectiveEnrollmentDate: new Date().toISOString().split('T')[0],
    notes: 'Class cohort enrollment by administrator',
  });
  const [savingClassAssignment, setSavingClassAssignment] = useState(false);

  // Initial Data Load
  const loadMetadata = async () => {
    try {
      setLoading(true);
      const [deptRes, classRes, usersRes] = await Promise.all([
        api.get('/departments'),
        api.get('/classes'),
        api.get('/admin/users'),
      ]);

      setDepartments(deptRes.data.data || []);
      setClasses(classRes.data.data || []);

      const allUsers = usersRes.data.data || [];
      setFacultyUsers(allUsers.filter((u) => u.role === 'faculty'));
      setStudentUsers(allUsers.filter((u) => u.role === 'student'));
    } catch (err) {
      console.error('Failed to load metadata:', err);
      showError('Failed to load academic metadata.');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const params = {};
      if (subjectDeptFilter !== 'all') params.department = subjectDeptFilter;
      if (subjectSemFilter !== 'all') params.semester = subjectSemFilter;
      if (subjectStatusFilter !== 'all') params.status = subjectStatusFilter;
      if (subjectSearch.trim()) params.search = subjectSearch.trim();

      const res = await api.get('/subjects', { params });
      setSubjects(res.data.data || []);
    } catch (err) {
      console.error('Failed to load subjects:', err);
      showError('Failed to load subjects.');
    }
  };

  const loadEnrollments = async () => {
    try {
      const params = {
        page: enrollmentPage + 1,
        limit: enrollmentLimit,
      };
      if (enrollmentSubjectFilter !== 'all') params.subject = enrollmentSubjectFilter;
      if (enrollmentClassFilter !== 'all') params.classDivision = enrollmentClassFilter;
      if (enrollmentStatusFilter !== 'all') params.status = enrollmentStatusFilter;
      if (enrollmentSearch.trim()) params.search = enrollmentSearch.trim();

      const res = await api.get('/enrollments/admin', { params });
      setEnrollments(res.data.data || []);
      setEnrollmentTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load enrollments:', err);
      showError('Failed to load enrollment records.');
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [subjectDeptFilter, subjectSemFilter, subjectStatusFilter, subjectSearch]);

  useEffect(() => {
    if (subTab === 1) {
      loadEnrollments();
    }
  }, [subTab, enrollmentPage, enrollmentLimit, enrollmentSubjectFilter, enrollmentClassFilter, enrollmentStatusFilter, enrollmentSearch]);

  // Open Create Subject Modal
  const handleOpenCreateSubject = () => {
    setIsEditingSubject(false);
    setEditingSubjectId(null);
    setSubjectForm({
      name: '',
      code: '',
      department: departments[0]?._id || '',
      semester: 5,
      academicYear: '2026-2027',
      credits: 3,
      lectureHoursPerWeek: 3,
      maxCapacity: 60,
      selfEnrollmentAllowed: true,
      status: 'active',
      description: '',
      eligibleClasses: [],
    });
    setOpenSubjectDialog(true);
  };

  // Open Edit Subject Modal
  const handleOpenEditSubject = (subj) => {
    setIsEditingSubject(true);
    setEditingSubjectId(subj._id);
    setSubjectForm({
      name: subj.name,
      code: subj.code,
      department: subj.department?._id || subj.department || '',
      semester: subj.semester,
      academicYear: subj.academicYear || '2026-2027',
      credits: subj.credits || 3,
      lectureHoursPerWeek: subj.lectureHoursPerWeek || 3,
      maxCapacity: subj.maxCapacity || 60,
      selfEnrollmentAllowed: subj.selfEnrollmentAllowed !== false,
      status: subj.status || 'active',
      description: subj.description || '',
      eligibleClasses: (subj.eligibleClasses || []).map((c) => c._id || c),
    });
    setOpenSubjectDialog(true);
  };

  // Save Subject (Create or Edit)
  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim() || !subjectForm.code.trim() || !subjectForm.department) {
      showError('Subject name, code, and department are required.');
      return;
    }

    try {
      setSavingSubject(true);
      if (isEditingSubject) {
        await api.put(`/subjects/${editingSubjectId}`, subjectForm);
        showSuccess('Subject updated successfully.');
      } else {
        await api.post('/subjects', subjectForm);
        showSuccess('Subject created successfully.');
      }
      setOpenSubjectDialog(false);
      loadSubjects();
    } catch (err) {
      console.error('Failed to save subject:', err);
      showError(err.response?.data?.message || 'Failed to save subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  // Toggle Subject Status
  const handleToggleSubjectStatus = async (subj) => {
    const nextStatus = subj.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/subjects/${subj._id}/status`, { status: nextStatus });
      showSuccess(`Subject status set to ${nextStatus}.`);
      loadSubjects();
    } catch (err) {
      console.error('Failed to update status:', err);
      showError(err.response?.data?.message || 'Failed to update subject status.');
    }
  };

  // Open Assign Faculty Modal
  const handleOpenAssignFaculty = (subj) => {
    setAssignFacultySubject(subj);
    setConflictErrors([]);
    setFacultyAssignForm({
      facultyId: subj.assignedFaculty?._id || '',
      classDivisionId: classes[0]?._id || '',
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      room: 'LH-201',
      activityType: 'Theory',
    });
    setOpenAssignFacultyDialog(true);
  };

  // Submit Assign Faculty (with conflict detection)
  const handleSubmitAssignFaculty = async () => {
    if (!facultyAssignForm.facultyId || !facultyAssignForm.classDivisionId) {
      showError('Please select both a faculty member and a class division.');
      return;
    }

    try {
      setSavingFacultyAssignment(true);
      setConflictErrors([]);
      const deptId =
        assignFacultySubject?.department?._id ||
        assignFacultySubject?.department ||
        facultyAssignForm.department;
      const res = await api.post(`/subjects/${assignFacultySubject._id}/assign-faculty`, {
        ...facultyAssignForm,
        department: deptId,
      });
      showSuccess(res.data.message || 'Faculty assigned successfully.');
      setOpenAssignFacultyDialog(false);
      loadSubjects();
    } catch (err) {
      console.error('Faculty assignment failed:', err);
      if (err.response?.data?.conflicts) {
        setConflictErrors(err.response.data.conflicts);
      } else {
        showError(err.response?.data?.message || 'Failed to assign faculty.');
      }
    } finally {
      setSavingFacultyAssignment(false);
    }
  };

  // Open View Enrolled Students Modal
  const handleOpenViewEnrolled = async (subj) => {
    setViewSubject(subj);
    setViewEnrolledDialog(true);
    setLoadingEnrolledStudents(true);
    try {
      const res = await api.get(`/enrollments/subject/${subj._id}/students`);
      setSubjectEnrolledStudents(res.data.data || []);
    } catch (err) {
      console.error('Failed to load enrolled students:', err);
      showError('Failed to load enrolled student list.');
    } finally {
      setLoadingEnrolledStudents(false);
    }
  };

  // Submit Assign Students (Individual)
  const handleAssignStudents = async () => {
    if (!assignStudentForm.subjectId || assignStudentForm.studentIds.length === 0) {
      showError('Please select a subject and at least one student.');
      return;
    }

    try {
      setSavingStudentAssignment(true);
      const res = await api.post('/enrollments/admin/assign', assignStudentForm);
      showSuccess(res.data.message || 'Students assigned successfully.');
      setOpenAssignStudentDialog(false);
      loadEnrollments();
      loadSubjects();
    } catch (err) {
      console.error('Student assignment failed:', err);
      showError(err.response?.data?.message || 'Failed to assign student.');
    } finally {
      setSavingStudentAssignment(false);
    }
  };

  // Submit Assign Class Cohort
  const handleAssignClassCohort = async () => {
    if (!assignClassForm.subjectId || !assignClassForm.classDivisionId) {
      showError('Please select both a subject and a class division.');
      return;
    }

    try {
      setSavingClassAssignment(true);
      const res = await api.post('/enrollments/admin/assign-class', assignClassForm);
      showSuccess(res.data.message || 'Class cohort assigned successfully.');
      setOpenAssignClassDialog(false);
      loadEnrollments();
      loadSubjects();
    } catch (err) {
      console.error('Class assignment failed:', err);
      showError(err.response?.data?.message || 'Failed to assign class cohort.');
    } finally {
      setSavingClassAssignment(false);
    }
  };

  // Update Enrollment Status (Withdraw, Deactivate, Re-enroll)
  const handleUpdateEnrollmentStatus = async (enrollmentId, newStatus) => {
    try {
      await api.patch(`/enrollments/admin/${enrollmentId}/status`, {
        status: newStatus,
        reason: `Administrator status change to ${newStatus}`,
      });
      showSuccess(`Enrollment updated to ${newStatus}.`);
      loadEnrollments();
      if (viewEnrolledDialog && viewSubject) {
        handleOpenViewEnrolled(viewSubject);
      }
    } catch (err) {
      console.error('Failed to update enrollment status:', err);
      showError(err.response?.data?.message || 'Failed to update enrollment status.');
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={subTab}
          onChange={(e, val) => setSubTab(val)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.95rem' },
          }}
        >
          <Tab
            icon={<SubjectIcon sx={{ mr: 1, fontSize: 20 }} />}
            iconPosition="start"
            label={`Subjects Directory (${subjects.length})`}
          />
          <Tab
            icon={<StudentIcon sx={{ mr: 1, fontSize: 20 }} />}
            iconPosition="start"
            label={`Student Enrollments & Cohorts (${enrollmentTotal})`}
          />
        </Tabs>
      </Box>

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 0: SUBJECTS DIRECTORY */}
      {/* ------------------------------------------------------------- */}
      {subTab === 0 && (
        <Box>
          {/* Controls Bar */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ mb: 3 }}
          >
            <TextField
              size="small"
              placeholder="Search by code or title..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 260 }}
            />

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {/* Department Filter */}
              <TextField
                select
                size="small"
                label="Department"
                value={subjectDeptFilter}
                onChange={(e) => setSubjectDeptFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All Departments</MenuItem>
                {departments.map((d) => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.code} - {d.name}
                  </MenuItem>
                ))}
              </TextField>

              {/* Semester Filter */}
              <TextField
                select
                size="small"
                label="Semester"
                value={subjectSemFilter}
                onChange={(e) => setSubjectSemFilter(e.target.value)}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All Semesters</MenuItem>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>

              {/* Status Filter */}
              <TextField
                select
                size="small"
                label="Status"
                value={subjectStatusFilter}
                onChange={(e) => setSubjectStatusFilter(e.target.value)}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="inactive">Inactive Only</MenuItem>
              </TextField>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreateSubject}
                sx={{
                  bgcolor: '#2563eb',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                Create Subject
              </Button>
            </Stack>
          </Stack>

          {/* Subjects Table */}
          {subjects.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2.5 }}>
              <SubjectIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No subjects found
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Try adjusting your search criteria or create a new subject for the curriculum.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenCreateSubject}>
                Create New Subject
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Subject Title</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Sem / Cr</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Enrolled / Cap</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Assigned Faculty</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjects.map((subj) => (
                    <TableRow key={subj._id} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#2563eb' }}>{subj.code}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {subj.name}
                        </Typography>
                        {subj.description && (
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', maxWidth: 300, noWrap: true, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {subj.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={subj.department?.code || 'GEN'}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}
                        />
                      </TableCell>
                      <TableCell>
                        Sem {subj.semester} • {subj.credits || 3} Cr
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${subj.enrolledCount || 0} / ${subj.maxCapacity || 60}`}
                          size="small"
                          color={subj.enrolledCount >= (subj.maxCapacity || 60) ? 'error' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        {subj.assignedFaculty ? (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                            Prof. {subj.assignedFaculty.fullName}
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            Unassigned
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={subj.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                          size="small"
                          color={subj.status === 'active' ? 'success' : 'default'}
                          sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View Enrolled Students">
                            <IconButton size="small" color="primary" onClick={() => handleOpenViewEnrolled(subj)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Assign Faculty (with conflict check)">
                            <IconButton size="small" color="secondary" onClick={() => handleOpenAssignFaculty(subj)}>
                              <FacultyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Subject Details">
                            <IconButton size="small" onClick={() => handleOpenEditSubject(subj)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={subj.status === 'active' ? 'Deactivate Subject' : 'Activate Subject'}>
                            <IconButton
                              size="small"
                              color={subj.status === 'active' ? 'warning' : 'success'}
                              onClick={() => handleToggleSubjectStatus(subj)}
                            >
                              {subj.status === 'active' ? <InactiveIcon fontSize="small" /> : <ActiveIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
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

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 1: ENROLLMENTS & COHORTS */}
      {/* ------------------------------------------------------------- */}
      {subTab === 1 && (
        <Box>
          {/* Controls Bar */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ mb: 3 }}
          >
            <TextField
              size="small"
              placeholder="Search student name, email, or ID..."
              value={enrollmentSearch}
              onChange={(e) => setEnrollmentSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 280 }}
            />

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {/* Subject Filter */}
              <TextField
                select
                size="small"
                label="Filter Subject"
                value={enrollmentSubjectFilter}
                onChange={(e) => setEnrollmentSubjectFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">All Subjects</MenuItem>
                {subjects.map((s) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.code} - {s.name}
                  </MenuItem>
                ))}
              </TextField>

              {/* Class Filter */}
              <TextField
                select
                size="small"
                label="Class Division"
                value={enrollmentClassFilter}
                onChange={(e) => setEnrollmentClassFilter(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Classes</MenuItem>
                {classes.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.code}
                  </MenuItem>
                ))}
              </TextField>

              {/* Status Filter */}
              <TextField
                select
                size="small"
                label="Status"
                value={enrollmentStatusFilter}
                onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="enrolled">Enrolled</MenuItem>
                <MenuItem value="withdrawn">Withdrawn</MenuItem>
                <MenuItem value="deactivated">Deactivated</MenuItem>
              </TextField>

              <Button
                variant="outlined"
                startIcon={<AssignIcon />}
                onClick={() => {
                  setAssignStudentForm({
                    subjectId: subjects[0]?._id || '',
                    studentIds: [],
                    classDivisionId: classes[0]?._id || '',
                    effectiveEnrollmentDate: new Date().toISOString().split('T')[0],
                    notes: 'Assigned by administrator',
                  });
                  setOpenAssignStudentDialog(true);
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Assign Student
              </Button>

              <Button
                variant="contained"
                startIcon={<ClassCohortIcon />}
                onClick={() => {
                  setAssignClassForm({
                    subjectId: subjects[0]?._id || '',
                    classDivisionId: classes[0]?._id || '',
                    effectiveEnrollmentDate: new Date().toISOString().split('T')[0],
                    notes: 'Class cohort enrollment by administrator',
                  });
                  setOpenAssignClassDialog(true);
                }}
                sx={{
                  bgcolor: '#0d9488',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#0f766e' },
                }}
              >
                Assign Class Cohort
              </Button>
            </Stack>
          </Stack>

          {/* Enrollments Table */}
          {enrollments.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2.5 }}>
              <StudentIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                No enrollment records found
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                Enroll individual students or assign a class division cohort to begin managing subject rosters.
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center">
                <Button variant="outlined" startIcon={<AssignIcon />} onClick={() => setOpenAssignStudentDialog(true)}>
                  Assign Student
                </Button>
                <Button variant="contained" startIcon={<ClassCohortIcon />} onClick={() => setOpenAssignClassDialog(true)}>
                  Assign Class Cohort
                </Button>
              </Stack>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Subject</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Class Cohort</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Effective Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enrollments.map((enr) => (
                    <TableRow key={enr._id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#3b82f6' }}>
                            {enr.student?.fullName?.charAt(0) || 'S'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {enr.student?.fullName || 'Unknown Student'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {enr.student?.email} • {enr.student?.studentId || 'No ID'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563eb' }}>
                          {enr.subject?.code}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#475569' }}>
                          {enr.subject?.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={enr.classDivision?.code || 'Cohort'}
                          size="small"
                          sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={enr.enrollmentSource ? enr.enrollmentSource.toUpperCase() : 'STUDENT'}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.65rem', fontWeight: 800 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={enr.status.toUpperCase()}
                          size="small"
                          color={
                            enr.status === 'enrolled'
                              ? 'success'
                              : enr.status === 'withdrawn'
                              ? 'warning'
                              : 'default'
                          }
                          sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                          From: {new Date(enr.effectiveEnrollmentDate).toLocaleDateString()}
                        </Typography>
                        {enr.effectiveEndDate && (
                          <Typography variant="caption" sx={{ color: '#dc2626', display: 'block' }}>
                            Ended: {new Date(enr.effectiveEndDate).toLocaleDateString()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {enr.status === 'enrolled' ? (
                            <>
                              <Tooltip title="Withdraw Student (preserves past attendance)">
                                <Button
                                  size="small"
                                  color="warning"
                                  onClick={() => handleUpdateEnrollmentStatus(enr._id, 'withdrawn')}
                                  sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                                >
                                  Withdraw
                                </Button>
                              </Tooltip>
                              <Tooltip title="Deactivate Enrollment">
                                <Button
                                  size="small"
                                  color="inherit"
                                  onClick={() => handleUpdateEnrollmentStatus(enr._id, 'deactivated')}
                                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#64748b' }}
                                >
                                  Deactivate
                                </Button>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip title="Re-enroll Student in Subject">
                              <Button
                                size="small"
                                color="success"
                                onClick={() => handleUpdateEnrollmentStatus(enr._id, 'enrolled')}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                              >
                                Re-Enroll
                              </Button>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={enrollmentTotal}
                rowsPerPage={enrollmentLimit}
                page={enrollmentPage}
                onPageChange={(e, newPage) => setEnrollmentPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setEnrollmentLimit(parseInt(e.target.value, 10));
                  setEnrollmentPage(0);
                }}
              />
            </TableContainer>
          )}
        </Box>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 1: CREATE / EDIT SUBJECT */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={openSubjectDialog} onClose={() => !savingSubject && setOpenSubjectDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {isEditingSubject ? 'Edit Subject Offering' : 'Create New Subject Offering'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Subject Code"
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CS501"
                required
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                size="small"
                label="Subject Title / Name"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="e.g. Distributed Systems & Cloud Computing"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Department"
                value={subjectForm.department}
                onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}
                required
              >
                {departments.map((d) => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Semester"
                value={subjectForm.semester}
                onChange={(e) => setSubjectForm({ ...subjectForm, semester: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <MenuItem key={s} value={s}>
                    Semester {s}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="Academic Year"
                value={subjectForm.academicYear}
                onChange={(e) => setSubjectForm({ ...subjectForm, academicYear: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                size="small"
                label="Credits"
                value={subjectForm.credits}
                onChange={(e) => setSubjectForm({ ...subjectForm, credits: Number(e.target.value) })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                size="small"
                label="Hours Per Week"
                value={subjectForm.lectureHoursPerWeek}
                onChange={(e) => setSubjectForm({ ...subjectForm, lectureHoursPerWeek: Number(e.target.value) })}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                size="small"
                label="Max Student Capacity"
                value={subjectForm.maxCapacity}
                onChange={(e) => setSubjectForm({ ...subjectForm, maxCapacity: Number(e.target.value) })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Self-Enrollment Policy"
                value={subjectForm.selfEnrollmentAllowed ? 'yes' : 'no'}
                onChange={(e) => setSubjectForm({ ...subjectForm, selfEnrollmentAllowed: e.target.value === 'yes' })}
              >
                <MenuItem value="yes">Enabled (Students can self-enroll)</MenuItem>
                <MenuItem value="no">Disabled (Admin assignment only)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Subject Status"
                value={subjectForm.status}
                onChange={(e) => setSubjectForm({ ...subjectForm, status: e.target.value })}
              >
                <MenuItem value="active">Active (Available for teaching & enrollment)</MenuItem>
                <MenuItem value="inactive">Inactive (Archived / not offered)</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                size="small"
                label="Description & Course Objectives"
                value={subjectForm.description}
                onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                placeholder="Overview of subject syllabus, prerequisites, and learning outcomes..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSubjectDialog(false)} disabled={savingSubject}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveSubject} disabled={savingSubject} sx={{ fontWeight: 700 }}>
            {savingSubject ? 'Saving...' : isEditingSubject ? 'Update Subject' : 'Create Subject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 2: ASSIGN FACULTY (WITH CONFLICT CHECK) */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={openAssignFacultyDialog}
        onClose={() => !savingFacultyAssignment && setOpenAssignFacultyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Assign Faculty to {assignFacultySubject?.code}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Assign a professor to teach <strong>{assignFacultySubject?.name}</strong>. Timetable conflicts will be automatically detected to prevent double-booking.
          </Typography>

          {conflictErrors.length > 0 && (
            <Alert severity="error" icon={<ConflictIcon />} sx={{ mb: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Schedule Conflict Detected!
              </Typography>
              <ul style={{ paddingLeft: 20, margin: '4px 0 0' }}>
                {conflictErrors.map((c, idx) => (
                  <li key={idx}>
                    <Typography variant="caption">{c}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Faculty Member"
                value={facultyAssignForm.facultyId}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, facultyId: e.target.value })}
                required
              >
                {facultyUsers.map((f) => (
                  <MenuItem key={f._id} value={f._id}>
                    Prof. {f.fullName} ({f.employeeId || f.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Target Class Division"
                value={facultyAssignForm.classDivisionId}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, classDivisionId: e.target.value })}
                required
              >
                {classes.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name} ({c.code}) • Room: {c.room || 'N/A'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Day of Week"
                value={facultyAssignForm.dayOfWeek}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, dayOfWeek: e.target.value })}
              >
                {DAYS.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Room / Lab Location"
                value={facultyAssignForm.room}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, room: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Start Time (HH:mm)"
                value={facultyAssignForm.startTime}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, startTime: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="End Time (HH:mm)"
                value={facultyAssignForm.endTime}
                onChange={(e) => setFacultyAssignForm({ ...facultyAssignForm, endTime: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAssignFacultyDialog(false)} disabled={savingFacultyAssignment}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitAssignFaculty}
            disabled={savingFacultyAssignment}
            sx={{ fontWeight: 700 }}
          >
            {savingFacultyAssignment ? 'Checking Conflicts...' : 'Assign Faculty'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 3: VIEW ENROLLED STUDENTS IN SUBJECT */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={viewEnrolledDialog} onClose={() => setViewEnrolledDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Enrolled Students: {viewSubject?.code} - {viewSubject?.name}
        </DialogTitle>
        <DialogContent dividers>
          {loadingEnrolledStudents ? (
            <Skeleton variant="rectangular" height={200} />
          ) : subjectEnrolledStudents.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <StudentIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 700, color: '#475569' }}>
                No students enrolled in this subject.
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Use the "Assign Student" or "Assign Class Cohort" actions to populate the roster.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Student ID</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Class Cohort</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Effective Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, textAlign: 'right' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {subjectEnrolledStudents.map((enr) => (
                    <TableRow key={enr._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {enr.student?.fullName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {enr.student?.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{enr.student?.studentId || 'N/A'}</TableCell>
                      <TableCell>{enr.classDivision?.code || 'Cohort'}</TableCell>
                      <TableCell>
                        <Chip
                          label={enr.status.toUpperCase()}
                          size="small"
                          color={enr.status === 'enrolled' ? 'success' : 'warning'}
                          sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(enr.effectiveEnrollmentDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        {enr.status === 'enrolled' ? (
                          <Button
                            size="small"
                            color="warning"
                            onClick={() => handleUpdateEnrollmentStatus(enr._id, 'withdrawn')}
                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                          >
                            Withdraw
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="success"
                            onClick={() => handleUpdateEnrollmentStatus(enr._id, 'enrolled')}
                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                          >
                            Re-enroll
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setViewEnrolledDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 4: ASSIGN STUDENT(S) */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={openAssignStudentDialog}
        onClose={() => !savingStudentAssignment && setOpenAssignStudentDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Assign Subject to Student</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Subject"
                value={assignStudentForm.subjectId}
                onChange={(e) => setAssignStudentForm({ ...assignStudentForm, subjectId: e.target.value })}
                required
              >
                {subjects.map((s) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.code} - {s.name} ({s.department?.code || 'GEN'})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Student"
                value={assignStudentForm.studentIds[0] || ''}
                onChange={(e) =>
                  setAssignStudentForm({
                    ...assignStudentForm,
                    studentIds: e.target.value ? [e.target.value] : [],
                  })
                }
                required
              >
                {studentUsers.map((st) => (
                  <MenuItem key={st._id} value={st._id}>
                    {st.fullName} ({st.studentId || st.email}) • {st.academicYear || 'Student'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Associated Class Division (Optional)"
                value={assignStudentForm.classDivisionId}
                onChange={(e) => setAssignStudentForm({ ...assignStudentForm, classDivisionId: e.target.value })}
              >
                <MenuItem value="">None / Automatic</MenuItem>
                {classes.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="Effective Enrollment Date"
                value={assignStudentForm.effectiveEnrollmentDate}
                onChange={(e) => setAssignStudentForm({ ...assignStudentForm, effectiveEnrollmentDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Administrative Notes"
                value={assignStudentForm.notes}
                onChange={(e) => setAssignStudentForm({ ...assignStudentForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAssignStudentDialog(false)} disabled={savingStudentAssignment}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignStudents}
            disabled={savingStudentAssignment}
            sx={{ fontWeight: 700 }}
          >
            {savingStudentAssignment ? 'Assigning...' : 'Assign Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 5: ASSIGN CLASS COHORT */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={openAssignClassDialog}
        onClose={() => !savingClassAssignment && setOpenAssignClassDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Assign Subject to Entire Class Cohort</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
            This will enroll all eligible students in the selected class division into the subject. Duplicate assignments are automatically prevented.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Target Subject"
                value={assignClassForm.subjectId}
                onChange={(e) => setAssignClassForm({ ...assignClassForm, subjectId: e.target.value })}
                required
              >
                {subjects.map((s) => (
                  <MenuItem key={s._id} value={s._id}>
                    {s.code} - {s.name} (Sem {s.semester})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Class Division"
                value={assignClassForm.classDivisionId}
                onChange={(e) => setAssignClassForm({ ...assignClassForm, classDivisionId: e.target.value })}
                required
              >
                {classes.map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name} ({c.code}) • {c.studentCount || c.students?.length || 0} Students
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="Effective Enrollment Date"
                value={assignClassForm.effectiveEnrollmentDate}
                onChange={(e) => setAssignClassForm({ ...assignClassForm, effectiveEnrollmentDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Assignment Notes"
                value={assignClassForm.notes}
                onChange={(e) => setAssignClassForm({ ...assignClassForm, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAssignClassDialog(false)} disabled={savingClassAssignment}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignClassCohort}
            disabled={savingClassAssignment}
            sx={{ fontWeight: 700, bgcolor: '#0d9488', '&:hover': { bgcolor: '#0f766e' } }}
          >
            {savingClassAssignment ? 'Enrolling Cohort...' : 'Enroll Class Cohort'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

