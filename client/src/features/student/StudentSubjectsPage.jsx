import React from 'react';
import { Box, Typography } from '@mui/material';
import { StudentSubjectEnrollmentSection } from '../dashboard/StudentSubjectEnrollmentSection';

export const StudentSubjectsPage = () => {
  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3.5 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Academic Course Enrollment
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b', mt: 0.5 }}>
          Manage your course registrations, browse department curriculum offerings, and review enrolled subject schedules.
        </Typography>
      </Box>

      <StudentSubjectEnrollmentSection />
    </Box>
  );
};

