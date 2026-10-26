import React, { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  Stack,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  Visibility,
  VisibilityOff,
  Lightbulb as LogoIcon,
} from '@mui/icons-material';

import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sessionExpired = new URLSearchParams(location.search).get('sessionExpired');

  const getDashboardRouteForRole = (role) => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'faculty':
        return '/dashboard';
      case 'coordinator':
        return '/coordinator/dashboard';
      case 'resource_manager':
        return '/resource-manager/dashboard';
      case 'student':
      default:
        return '/dashboard';
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const authenticatedUser = await login(email, password);
      showSuccess('Welcome back to CampusSync!');
      navigate(getDashboardRouteForRole(authenticatedUser?.role));
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMessage('');
    setLoading(true);
    try {
      const authenticatedUser = await login(demoEmail, demoPassword);
      showSuccess('Logged in successfully!');
      navigate(getDashboardRouteForRole(authenticatedUser?.role));
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.';
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 3.5,
          border: '1px solid #e2e8f0',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #0f172a 0%, #2563eb 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              mb: 1.5,
            }}
          >
            <LockIcon />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
            Log in to access your personalized CampusSync dashboard
          </Typography>
        </Box>

        {sessionExpired && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Your session has expired. Please log in again to continue.
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Official College Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@campussync.edu"
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mb: 2 }}>
            <RouterLink to="/forgot-password" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600 }}>
              Forgot password?
            </RouterLink>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="secondary"
            size="large"
            disabled={loading}
            sx={{ py: 1.3, borderRadius: 2.5, fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              New to CampusSync?{' '}
              <RouterLink to="/register" style={{ color: '#2563eb', fontWeight: 700 }}>
                Create a student account
              </RouterLink>
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700 }}>
            QUICK 1-CLICK DEMO ACCOUNTS (ALL 5 ROLES)
          </Typography>
        </Divider>

        {/* Demo Fast Fill Buttons for All 5 Roles */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleDemoFill('student@campussync.edu', 'Student@123')}
            sx={{ borderRadius: 2 }}
          >
            Student
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={() => handleDemoFill('faculty@campussync.edu', 'Faculty@123')}
            sx={{ borderRadius: 2 }}
          >
            Faculty
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={() => handleDemoFill('coordinator@campussync.edu', 'Coordinator@123')}
            sx={{ borderRadius: 2 }}
          >
            Club Coordinator
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="info"
            onClick={() => handleDemoFill('resourcemanager@campussync.edu', 'Manager@123')}
            sx={{ borderRadius: 2 }}
          >
            Resource Manager
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => handleDemoFill('admin@campussync.edu', 'Admin@123')}
            sx={{ borderRadius: 2 }}
          >
            Admin
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default LoginPage;
