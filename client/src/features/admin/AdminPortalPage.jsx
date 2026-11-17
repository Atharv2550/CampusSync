import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  LinearProgress,
  Alert,
  Grid,
  InputAdornment,
  IconButton,
  Tooltip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  ReportProblem as ModerateIcon,
  History as AuditIcon,
  Settings as SettingsIcon,
  Block as SuspendIcon,
  CheckCircle as ActiveIcon,
  PersonAdd as PersonAddIcon,
  School as FacultyIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  CalendarMonth as CalendarIcon,
  Visibility,
  VisibilityOff,
  Autorenew as GenerateIcon,
  Badge as BadgeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { AdminTimetableManagement } from './AdminTimetableManagement';
import { AdminSubjectEnrollmentManagement } from './AdminSubjectEnrollmentManagement';

const FACULTY_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Senior Lecturer',
  'Lecturer',
  'Head of Department',
  'Visiting Faculty',
  'Adjunct Professor',
  'Dean / Director',
];

const COORDINATOR_DESIGNATIONS = [
  'Club Coordinator',
  'Faculty Advisor',
  'Lead Coordinator',
  'Student President',
  'Technical Head',
  'Activities Secretary',
];

const RESOURCE_MANAGER_DESIGNATIONS = [
  'Campus Resource Manager',
  'Facility Incharge',
  'Lab Superintendent',
  'Audiovisual Officer',
  'Campus Operations Manager',
];

export const AdminPortalPage = () => {
  const { showSuccess, showError } = useToast();

  const [tab, setTab] = useState(0); // 0 = Users, 1 = Moderation, 2 = Audit Logs, 3 = Settings, 4 = Timetables & Duties
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [clubsList, setClubsList] = useState([]);
  const [resourcesList, setResourcesList] = useState([]);
  const [flagged, setFlagged] = useState({ flaggedListings: [], flaggedLostFound: [] });
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Directory Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'faculty', 'student', 'coordinator', 'resource_manager', 'admin'
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Add Staff Modal State
  const [openAddFacultyModal, setOpenAddFacultyModal] = useState(false);
  const [savingFaculty, setSavingFaculty] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [facultyForm, setFacultyForm] = useState({
    role: 'faculty',
    fullName: '',
    email: '',
    employeeId: '',
    department: '',
    designation: 'Assistant Professor',
    phoneNumber: '',
    status: 'active',
    password: '',
    assignedClubs: [],
    assignedResources: [],
  });

  // Edit Staff Modal State
  const [openEditFacultyModal, setOpenEditFacultyModal] = useState(false);
  const [savingEditFaculty, setSavingEditFaculty] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editFacultyForm, setEditFacultyForm] = useState({
    _id: '',
    role: 'faculty',
    fullName: '',
    email: '',
    employeeId: '',
    department: '',
    designation: 'Assistant Professor',
    phoneNumber: '',
    status: 'active',
    password: '',
    assignedClubs: [],
    assignedResources: [],
  });

  // Timetable Handoff State
  const [selectedFacultyForTimetable, setSelectedFacultyForTimetable] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      setUsers(res.data.data || []);
    } catch (_) {
      showError('Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      const deptList = res.data.data || [];
      setDepartments(deptList);
      if (deptList.length > 0) {
        setFacultyForm((prev) => ({ ...prev, department: prev.department || deptList[0]._id }));
      }
    } catch (_) {}
  };

  const fetchFlagged = async () => {
    try {
      const res = await api.get('/admin/flagged');
      setFlagged(res.data.data || { flaggedListings: [], flaggedLostFound: [] });
    } catch (_) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs');
      setAuditLogs(res.data.data || []);
    } catch (_) {}
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data.data || []);
    } catch (_) {}
  };

  const fetchClubsAndResources = async () => {
    try {
      const [cRes, rRes] = await Promise.all([
        api.get('/clubs?limit=100'),
        api.get('/resources'),
      ]);
      setClubsList(cRes.data.data || []);
      setResourcesList(rRes.data.data || []);
    } catch (_) {}
  };

  useEffect(() => {
    fetchDepartments();
    fetchClubsAndResources();
  }, []);

  useEffect(() => {
    if (tab === 0) fetchUsers();
    if (tab === 1) fetchFlagged();
    if (tab === 2) fetchAuditLogs();
    if (tab === 3) fetchSettings();
  }, [tab]);

  // Generate a random strong initial password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pass = 'Fac#';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFacultyForm((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  const generateEditPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pass = 'Reset#';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditFacultyForm((prev) => ({ ...prev, password: pass }));
    setShowEditPassword(true);
  };

  // Open Add Staff Dialog
  const handleOpenAddFaculty = (defaultRole = 'faculty') => {
    setFacultyForm({
      role: defaultRole,
      fullName: '',
      email: '',
      employeeId: '',
      department: departments[0]?._id || '',
      designation: defaultRole === 'faculty' ? 'Assistant Professor' : defaultRole === 'coordinator' ? 'Lead Coordinator' : 'Campus Resource Manager',
      phoneNumber: '',
      status: 'active',
      password: '',
      assignedClubs: [],
      assignedResources: [],
    });
    setShowPassword(false);
    setOpenAddFacultyModal(true);
  };

  // Submit Add Staff
  const handleCreateFaculty = async (e) => {
    e.preventDefault();

    if (!facultyForm.fullName.trim() || !facultyForm.email.trim() || !facultyForm.password) {
      showError('Full name, official email, and initial password are required.');
      return;
    }

    if (facultyForm.password.length < 6) {
      showError('Initial password must be at least 6 characters.');
      return;
    }

    try {
      setSavingFaculty(true);
      const res = await api.post('/admin/staff', facultyForm);
      showSuccess(res.data.message || 'Staff account created successfully!');
      setOpenAddFacultyModal(false);
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to create staff account.');
    } finally {
      setSavingFaculty(false);
    }
  };

  // Open Edit Staff Dialog
  const handleOpenFacultyEdit = (user) => {
    const userClubIds = (user.assignedClubs || []).map((c) => (c._id || c).toString());
    if (user.assignedClub) {
      const singleId = (user.assignedClub._id || user.assignedClub).toString();
      if (!userClubIds.includes(singleId)) userClubIds.push(singleId);
    }

    const userResourceIds = (user.assignedResources || []).map((r) => (r._id || r).toString());

    setEditFacultyForm({
      _id: user._id,
      role: user.role || 'faculty',
      fullName: user.fullName || '',
      email: user.email || '',
      employeeId: user.employeeId || user.studentId || '',
      department: user.department?._id || user.department || '',
      designation: user.designation || (user.role === 'faculty' ? 'Assistant Professor' : user.role === 'coordinator' ? 'Lead Coordinator' : user.role === 'resource_manager' ? 'Campus Resource Manager' : ''),
      phoneNumber: user.phoneNumber || '',
      status: user.status || 'active',
      password: '',
      assignedClubs: userClubIds,
      assignedResources: userResourceIds,
    });
    setShowEditPassword(false);
    setOpenEditFacultyModal(true);
  };

  // Submit Edit Staff
  const handleUpdateFaculty = async (e) => {
    e.preventDefault();
    try {
      setSavingEditFaculty(true);
      const payload = { ...editFacultyForm };
      if (!payload.password) delete payload.password; // Don't overwrite if left blank
      const res = await api.put(`/admin/staff/${editFacultyForm._id}`, payload);
      showSuccess(res.data.message || 'Account updated successfully!');
      setOpenEditFacultyModal(false);
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update account.');
    } finally {
      setSavingEditFaculty(false);
    }
  };

  // Open General User Role/Status Dialog
  const handleOpenUserEdit = (user) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setOpenUserModal(true);
  };

  // Save General User Account
  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/users/${selectedUser._id}`, {
        role: editRole,
        status: editStatus,
      });
      showSuccess(`Account for ${selectedUser.fullName} updated successfully.`);
      setOpenUserModal(false);
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update user.');
    }
  };

  // Quick toggle user status with admin safeguard
  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/admin/users/${user._id}`, { status: nextStatus });
      showSuccess(`Account for ${user.fullName} is now ${nextStatus}.`);
      fetchUsers();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update status.');
    }
  };

  // Assign Timetable shortcut -> Navigate to Tab 4
  const handleAssignTimetable = (user) => {
    setSelectedFacultyForTimetable(user._id);
    setTab(4);
    showSuccess(`Switched to Timetable Scheduler for Prof. ${user.fullName}`);
  };

  const handleModerate = async (contentType, contentId, action) => {
    try {
      await api.post('/admin/moderate', { contentType, contentId, action });
      showSuccess(`Content ${action === 'remove' ? 'removed' : 'cleared'}.`);
      fetchFlagged();
    } catch (_) {
      showError('Moderation action failed.');
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (departmentFilter !== 'all') {
        const uDeptId = u.department?._id || u.department;
        if (uDeptId !== departmentFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.fullName?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchEmpId = u.employeeId?.toLowerCase().includes(q);
        const matchStudentId = u.studentId?.toLowerCase().includes(q);
        const matchDesig = u.designation?.toLowerCase().includes(q);
        const matchDept =
          u.department?.name?.toLowerCase().includes(q) ||
          u.department?.code?.toLowerCase().includes(q);

        if (!matchName && !matchEmail && !matchEmpId && !matchStudentId && !matchDesig && !matchDept) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, departmentFilter, searchQuery]);

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: users.length,
      faculty: users.filter((u) => u.role === 'faculty').length,
      student: users.filter((u) => u.role === 'student').length,
      coordinator: users.filter((u) => u.role === 'coordinator').length,
      resource_manager: users.filter((u) => u.role === 'resource_manager').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  return (
    <Box>
      {/* Header Banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              bgcolor: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
            }}
          >
            <AdminIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              Campus Administrator Portal
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Faculty onboarding, user account governance, moderation queue, compliance audit logs & platform policies
            </Typography>
          </Box>
        </Box>

        {/* Global Quick Action */}
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => handleOpenAddFaculty('faculty')}
          sx={{
            bgcolor: '#2563eb',
            '&:hover': { bgcolor: '#1d4ed8' },
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: 2,
            px: 2.5,
            py: 1,
            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
          }}
        >
          Provision Staff Account
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(e, val) => setTab(val)}
        sx={{
          mb: 3,
          borderBottom: '1px solid #e2e8f0',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.95rem' },
        }}
      >
        <Tab label={`User Accounts Directory (${users.length})`} />
        <Tab
          label={`Content Moderation (${(flagged.flaggedListings?.length || 0) + (flagged.flaggedLostFound?.length || 0)})`}
        />
        <Tab label="Security Audit Logs" />
        <Tab label="Platform Policies & Settings" />
        <Tab label="Faculty Timetables & Duties" />
        <Tab label="Subject & Enrollment Management" />
      </Tabs>

      {/* Tab 0: User Accounts Directory */}
      {tab === 0 && (
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          {/* Section Header & Add Staff Button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                CampusSync User Accounts Directory & Role Governance
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Search, filter, edit credentials, deactivate accounts, and manage role permissions across campus
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => handleOpenAddFaculty('faculty')}
              sx={{
                bgcolor: '#0f172a',
                '&:hover': { bgcolor: '#1e293b' },
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 2,
                px: 2,
              }}
            >
              + Provision Staff Account
            </Button>
          </Box>

          {/* Role Filter Chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 2.5, overflowX: 'auto', pb: 0.5 }}>
            <Chip
              label={`All Accounts (${counts.all})`}
              onClick={() => setRoleFilter('all')}
              color={roleFilter === 'all' ? 'primary' : 'default'}
              variant={roleFilter === 'all' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
            <Chip
              icon={<FacultyIcon fontSize="small" />}
              label={`Faculty (${counts.faculty})`}
              onClick={() => setRoleFilter('faculty')}
              color={roleFilter === 'faculty' ? 'secondary' : 'default'}
              variant={roleFilter === 'faculty' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
            <Chip
              label={`Students (${counts.student})`}
              onClick={() => setRoleFilter('student')}
              color={roleFilter === 'student' ? 'primary' : 'default'}
              variant={roleFilter === 'student' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
            <Chip
              label={`Club Coordinators (${counts.coordinator})`}
              onClick={() => setRoleFilter('coordinator')}
              color={roleFilter === 'coordinator' ? 'warning' : 'default'}
              variant={roleFilter === 'coordinator' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
            <Chip
              label={`Administrators (${counts.admin})`}
              onClick={() => setRoleFilter('admin')}
              color={roleFilter === 'admin' ? 'error' : 'default'}
              variant={roleFilter === 'admin' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
            <Chip
              label={`Resource Managers (${counts.resource_manager})`}
              onClick={() => setRoleFilter('resource_manager')}
              color={roleFilter === 'resource_manager' ? 'info' : 'default'}
              variant={roleFilter === 'resource_manager' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, cursor: 'pointer' }}
            />
          </Stack>

          {/* Search and Dropdown Filter Bar */}
          <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name, employee ID, email, or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={6} sm={3.5}>
              <TextField
                select
                fullWidth
                size="small"
                label="Department Filter"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <MenuItem value="all">All Departments</MenuItem>
                {departments.map((d) => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={6} sm={2.5}>
              <TextField
                select
                fullWidth
                size="small"
                label="Status Filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={1}>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                }}
                sx={{ textTransform: 'none', height: 40 }}
              >
                Reset
              </Button>
            </Grid>
          </Grid>

          {loading ? (
            <LinearProgress sx={{ my: 3 }} />
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                No campus accounts match your current search and filters.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 1.5, textTransform: 'none' }}
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>User / Designation</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Role & ID</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isFaculty = u.role === 'faculty';
                    return (
                      <TableRow key={u._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        {/* User / Designation */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              sx={{
                                width: 36,
                                height: 36,
                                bgcolor: isFaculty ? '#0f172a' : '#2563eb',
                                color: isFaculty ? '#38bdf8' : '#ffffff',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                              }}
                            >
                              {u.fullName?.charAt(0) || 'U'}
                            </Avatar>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                  {u.fullName}
                                </Typography>
                                {isFaculty && u.designation && (
                                  <Chip
                                    label={u.designation}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      bgcolor: '#f1f5f9',
                                      color: '#334155',
                                    }}
                                  />
                                )}
                              </Box>
                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.3 }}>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                  <EmailIcon sx={{ fontSize: 13 }} /> {u.email}
                                </Typography>
                                {u.phoneNumber && (
                                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                    <PhoneIcon sx={{ fontSize: 13 }} /> {u.phoneNumber}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Role & ID & Assignments */}
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                            <Chip
                              label={u.role.toUpperCase()}
                              size="small"
                              color={
                                u.role === 'admin'
                                  ? 'error'
                                  : u.role === 'faculty'
                                  ? 'secondary'
                                  : u.role === 'coordinator'
                                  ? 'warning'
                                  : u.role === 'resource_manager'
                                  ? 'info'
                                  : 'default'
                              }
                              sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }}
                            />
                            {(u.employeeId || u.studentId) && (
                              <Tooltip title="Institutional Identifier">
                                <Chip
                                  icon={<BadgeIcon sx={{ fontSize: '13px !important' }} />}
                                  label={u.employeeId || u.studentId}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    bgcolor: '#e0e7ff',
                                    color: '#3730a3',
                                  }}
                                />
                              </Tooltip>
                            )}

                            {/* Club Coordinator Assigned Clubs */}
                            {u.role === 'coordinator' && (
                              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                                {(u.assignedClubs?.length > 0 ? u.assignedClubs : u.assignedClub ? [u.assignedClub] : []).map((c) => (
                                  <Chip
                                    key={c._id || c}
                                    label={c.name || c.code || 'Club'}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600 }}
                                  />
                                ))}
                              </Box>
                            )}

                            {/* Resource Manager Assigned Facilities */}
                            {u.role === 'resource_manager' && u.assignedResources?.length > 0 && (
                              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                                {u.assignedResources.map((r) => (
                                  <Chip
                                    key={r._id || r}
                                    label={r.name || 'Resource'}
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </TableCell>

                        {/* Department */}
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {u.department?.name || 'Unassigned'}
                          </Typography>
                          {u.department?.code && (
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Code: {u.department.code}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            label={u.status.toUpperCase()}
                            size="small"
                            color={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'error'}
                            sx={{ fontWeight: 700, height: 22, fontSize: '0.72rem' }}
                          />
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                            {isFaculty && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={<CalendarIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleAssignTimetable(u)}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  bgcolor: '#2563eb',
                                  py: 0.5,
                                }}
                              >
                                Timetable
                              </Button>
                            )}

                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                              onClick={() => handleOpenFacultyEdit(u)}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.5 }}
                            >
                              Edit Account
                            </Button>

                            <Tooltip title={u.status === 'active' ? 'Suspend Account' : 'Activate Account'}>
                              <IconButton
                                size="small"
                                color={u.status === 'active' ? 'error' : 'success'}
                                onClick={() => handleToggleStatus(u)}
                              >
                                {u.status === 'active' ? <SuspendIcon fontSize="small" /> : <ActiveIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Tab 1: Moderation */}
      {tab === 1 && (
        <Paper sx={{ p: 3.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Flagged & Reported Content Queue
          </Typography>

          {flagged.flaggedListings?.length === 0 && flagged.flaggedLostFound?.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              No items currently flagged for review. The campus ecosystem is healthy!
            </Typography>
          ) : (
            <Stack spacing={2}>
              {flagged.flaggedListings?.map((l) => (
                <Card key={l._id} sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#dc2626' }}>
                    Marketplace Listing: {l.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', mb: 1 }}>
                    Reason: {l.moderationReason || 'Reported by campus user.'}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" color="error" onClick={() => handleModerate('marketplace', l._id, 'remove')}>
                      Remove Listing
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleModerate('marketplace', l._id, 'dismiss')}>
                      Dismiss Report
                    </Button>
                  </Stack>
                </Card>
              ))}

              {flagged.flaggedLostFound?.map((item) => (
                <Card key={item._id} sx={{ p: 2, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#dc2626' }}>
                    Lost & Found: {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', mb: 1 }}>
                    Reason: {item.moderationReason || 'Reported as suspicious.'}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" color="error" onClick={() => handleModerate('lostfound', item._id, 'remove')}>
                      Close Report
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleModerate('lostfound', item._id, 'dismiss')}>
                      Dismiss Report
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* Tab 2: Audit Logs */}
      {tab === 2 && (
        <Paper sx={{ p: 3.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Security & Administration Audit Trail
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Target Type</TableCell>
                  <TableCell>IP Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip label={log.action} size="small" sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>{log.user?.fullName || 'System'}</TableCell>
                    <TableCell>{log.targetType}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Tab 3: Settings */}
      {tab === 3 && (
        <Paper sx={{ p: 3.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Platform Settings & Policy Toggles
          </Typography>

          <Stack spacing={2}>
            {settings.map((s) => (
              <Box key={s._id} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {s.key}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {s.description}
                  </Typography>
                </Box>
                <Chip label={String(s.value)} color="primary" sx={{ fontWeight: 700 }} />
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Tab 4: Faculty Timetable & Academic Duty Management */}
      {tab === 4 && (
        <AdminTimetableManagement
          initialFacultyId={selectedFacultyForTimetable}
          autoOpenTimetable={false}
        />
      )}

      {/* Tab 5: Subject & Enrollment Management */}
      {tab === 5 && <AdminSubjectEnrollmentManagement />}

      {/* Modal: Add Staff Member */}
      <Dialog
        open={openAddFacultyModal}
        onClose={() => !savingFaculty && setOpenAddFacultyModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Provision New Staff Account
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateFaculty}>
          <DialogContent dividers>
            <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.825rem' }}>
              Provisioning an authorized account securely sets institutional role permissions and hashes the password with bcrypt. The user will be immediately available across CampusSync.
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Account Role to Provision"
                  value={facultyForm.role}
                  onChange={(e) => {
                    const r = e.target.value;
                    setFacultyForm({
                      ...facultyForm,
                      role: r,
                      designation:
                        r === 'faculty'
                          ? 'Assistant Professor'
                          : r === 'coordinator'
                          ? 'Lead Coordinator'
                          : 'Campus Resource Manager',
                    });
                  }}
                >
                  <MenuItem value="faculty">Faculty Member</MenuItem>
                  <MenuItem value="coordinator">Club Coordinator</MenuItem>
                  <MenuItem value="resource_manager">Resource Manager</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Full Name (with honorific / title)"
                  placeholder="e.g., Dr. Marcus Chen / Sarah Jenkins"
                  value={facultyForm.fullName}
                  onChange={(e) => setFacultyForm({ ...facultyForm, fullName: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  size="small"
                  label="Official College Email"
                  placeholder="name@campussync.edu"
                  value={facultyForm.email}
                  onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                  helperText="Must be unique across the campus portal"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={facultyForm.role === 'coordinator' ? 'Student or Employee ID' : 'Employee ID'}
                  placeholder="e.g., EMP-2026-09"
                  value={facultyForm.employeeId}
                  onChange={(e) => setFacultyForm({ ...facultyForm, employeeId: e.target.value.toUpperCase() })}
                  helperText="Unique uppercase institutional identifier"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Department"
                  value={facultyForm.department}
                  onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Designation / Title"
                  value={facultyForm.designation}
                  onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                >
                  {(facultyForm.role === 'coordinator'
                    ? COORDINATOR_DESIGNATIONS
                    : facultyForm.role === 'resource_manager'
                    ? RESOURCE_MANAGER_DESIGNATIONS
                    : FACULTY_DESIGNATIONS
                  ).map((desig) => (
                    <MenuItem key={desig} value={desig}>
                      {desig}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Conditional Assignment Selectors */}
              {facultyForm.role === 'coordinator' && (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="assigned-clubs-label">Assigned Club(s)</InputLabel>
                    <Select
                      labelId="assigned-clubs-label"
                      multiple
                      value={facultyForm.assignedClubs}
                      onChange={(e) => setFacultyForm({ ...facultyForm, assignedClubs: e.target.value })}
                      label="Assigned Club(s)"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((val) => {
                            const club = clubsList.find((c) => (c._id || c).toString() === val.toString());
                            return <Chip key={val} label={club?.name || val} size="small" />;
                          })}
                        </Box>
                      )}
                    >
                      {clubsList.map((c) => (
                        <MenuItem key={c._id} value={c._id.toString()}>
                          {c.name} ({c.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {facultyForm.role === 'resource_manager' && (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="assigned-resources-label">Assigned Campus Resource(s)</InputLabel>
                    <Select
                      labelId="assigned-resources-label"
                      multiple
                      value={facultyForm.assignedResources}
                      onChange={(e) => setFacultyForm({ ...facultyForm, assignedResources: e.target.value })}
                      label="Assigned Campus Resource(s)"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((val) => {
                            const res = resourcesList.find((r) => (r._id || r).toString() === val.toString());
                            return <Chip key={val} label={res?.name || val} size="small" />;
                          })}
                        </Box>
                      )}
                    >
                      {resourcesList.map((r) => (
                        <MenuItem key={r._id} value={r._id.toString()}>
                          {r.name} — {r.type} ({r.location})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Contact Phone Number"
                  placeholder="e.g., +1-555-0199"
                  value={facultyForm.phoneNumber}
                  onChange={(e) => setFacultyForm({ ...facultyForm, phoneNumber: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Account Status"
                  value={facultyForm.status}
                  onChange={(e) => setFacultyForm({ ...facultyForm, status: e.target.value })}
                >
                  <MenuItem value="active">Active (Permit Immediate Login)</MenuItem>
                  <MenuItem value="pending">Pending Verification</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    required
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    label="Initial Password"
                    placeholder="Minimum 6 characters"
                    value={facultyForm.password}
                    onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                    helperText="Hashed with 10 bcrypt salt rounds on server."
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<GenerateIcon />}
                    onClick={generateStrongPassword}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap', height: 40 }}
                  >
                    Generate
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenAddFacultyModal(false)} disabled={savingFaculty}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={savingFaculty}
              sx={{ bgcolor: '#0f172a', fontWeight: 700, textTransform: 'none' }}
            >
              {savingFaculty ? 'Provisioning...' : 'Provision Account'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Modal: Edit Staff / User Account Details */}
      <Dialog
        open={openEditFacultyModal}
        onClose={() => !savingEditFaculty && setOpenEditFacultyModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', pb: 1 }}>
          Edit User Account & Role Permissions
        </DialogTitle>
        <Box component="form" onSubmit={handleUpdateFaculty}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Account Role"
                  value={editFacultyForm.role}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, role: e.target.value })}
                >
                  <MenuItem value="student">Student</MenuItem>
                  <MenuItem value="faculty">Faculty Member</MenuItem>
                  <MenuItem value="coordinator">Club Coordinator</MenuItem>
                  <MenuItem value="resource_manager">Resource Manager</MenuItem>
                  <MenuItem value="admin">Campus Administrator</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Account Status"
                  value={editFacultyForm.status}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, status: e.target.value })}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="inactive">Inactive / Deactivated</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Full Name"
                  value={editFacultyForm.fullName}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, fullName: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  size="small"
                  label="Official College Email"
                  value={editFacultyForm.email}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, email: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Employee ID / Student ID"
                  value={editFacultyForm.employeeId}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, employeeId: e.target.value.toUpperCase() })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Department"
                  value={editFacultyForm.department}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, department: e.target.value })}
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Designation / Title"
                  value={editFacultyForm.designation}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, designation: e.target.value })}
                />
              </Grid>

              {/* Conditional Assignment Selectors */}
              {editFacultyForm.role === 'coordinator' && (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="edit-assigned-clubs-label">Assigned Club(s)</InputLabel>
                    <Select
                      labelId="edit-assigned-clubs-label"
                      multiple
                      value={editFacultyForm.assignedClubs}
                      onChange={(e) => setEditFacultyForm({ ...editFacultyForm, assignedClubs: e.target.value })}
                      label="Assigned Club(s)"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((val) => {
                            const club = clubsList.find((c) => (c._id || c).toString() === val.toString());
                            return <Chip key={val} label={club?.name || val} size="small" />;
                          })}
                        </Box>
                      )}
                    >
                      {clubsList.map((c) => (
                        <MenuItem key={c._id} value={c._id.toString()}>
                          {c.name} ({c.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {editFacultyForm.role === 'resource_manager' && (
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="edit-assigned-resources-label">Assigned Campus Resource(s)</InputLabel>
                    <Select
                      labelId="edit-assigned-resources-label"
                      multiple
                      value={editFacultyForm.assignedResources}
                      onChange={(e) => setEditFacultyForm({ ...editFacultyForm, assignedResources: e.target.value })}
                      label="Assigned Campus Resource(s)"
                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((val) => {
                            const res = resourcesList.find((r) => (r._id || r).toString() === val.toString());
                            return <Chip key={val} label={res?.name || val} size="small" />;
                          })}
                        </Box>
                      )}
                    >
                      {resourcesList.map((r) => (
                        <MenuItem key={r._id} value={r._id.toString()}>
                          {r.name} — {r.type} ({r.location})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Contact Phone Number"
                  value={editFacultyForm.phoneNumber}
                  onChange={(e) => setEditFacultyForm({ ...editFacultyForm, phoneNumber: e.target.value })}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    size="small"
                    type={showEditPassword ? 'text' : 'password'}
                    label="Reset Password (leave empty to keep unchanged)"
                    placeholder="Enter new password to reset"
                    value={editFacultyForm.password}
                    onChange={(e) => setEditFacultyForm({ ...editFacultyForm, password: e.target.value })}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowEditPassword(!showEditPassword)}>
                            {showEditPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<GenerateIcon />}
                    onClick={generateEditPassword}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap', height: 40 }}
                  >
                    Generate
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenEditFacultyModal(false)} disabled={savingEditFaculty}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={savingEditFaculty}
              sx={{ bgcolor: '#0f172a', fontWeight: 700, textTransform: 'none' }}
            >
              {savingEditFaculty ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default AdminPortalPage;
