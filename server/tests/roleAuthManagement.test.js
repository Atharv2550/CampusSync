import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Club } from '../models/Club.js';
import { CampusResource } from '../models/CampusResource.js';
import { ResourceBooking } from '../models/ResourceBooking.js';

describe('CampusSync Authentication, Role-Based Access & Account Management Integration Tests', () => {
  let adminToken = '';
  let facultyToken = '';
  let coordinatorToken = '';
  let resourceManagerToken = '';
  let studentToken = '';

  let adminUser = null;
  let coordinatorUser = null;
  let resourceManagerUser = null;
  let assignedClub = null;
  let unassignedClub = null;
  let assignedResource = null;
  let unassignedResource = null;

  beforeAll(async () => {
    await connectDB();

    // 1. Authenticate all 5 roles through the shared login endpoint
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@campussync.edu',
      password: 'Admin@123',
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.user.role).toBe('admin');
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    const facultyRes = await request(app).post('/api/auth/login').send({
      email: 'faculty@campussync.edu',
      password: 'Faculty@123',
    });
    expect(facultyRes.status).toBe(200);
    expect(facultyRes.body.data.user.role).toBe('faculty');
    facultyToken = facultyRes.body.data.token;

    const coordRes = await request(app).post('/api/auth/login').send({
      email: 'coordinator@campussync.edu',
      password: 'Coordinator@123',
    });
    expect(coordRes.status).toBe(200);
    expect(coordRes.body.data.user.role).toBe('coordinator');
    coordinatorToken = coordRes.body.data.token;
    coordinatorUser = coordRes.body.data.user;

    const rmRes = await request(app).post('/api/auth/login').send({
      email: 'resourcemanager@campussync.edu',
      password: 'Manager@123',
    });
    expect(rmRes.status).toBe(200);
    expect(rmRes.body.data.user.role).toBe('resource_manager');
    resourceManagerToken = rmRes.body.data.token;
    resourceManagerUser = rmRes.body.data.user;

    const studentRes = await request(app).post('/api/auth/login').send({
      email: 'student@campussync.edu',
      password: 'Student@123',
    });
    expect(studentRes.status).toBe(200);
    expect(studentRes.body.data.user.role).toBe('student');
    studentToken = studentRes.body.data.token;

    // Fetch clubs for testing ownership scoping
    const clubs = await Club.find({ status: 'Active' });
    assignedClub = clubs.find((c) => (coordinatorUser.assignedClub?._id || coordinatorUser.assignedClub)?.toString() === c._id.toString()) || clubs[0];

    // Explicitly create an unassigned club for scoping tests
    unassignedClub = await Club.create({
      name: `Unassigned Club ${Date.now()}`,
      code: `UNASS-${Date.now().toString().slice(-4)}`,
      description: 'Isolated club with different coordinator',
      category: 'Arts & Media',
      coordinators: [],
      status: 'Active',
    });

    // Fetch resources for testing ownership scoping
    const resources = await CampusResource.find({ isActive: true });
    const assignedIds = (resourceManagerUser.assignedResources || []).map((r) => (r._id || r).toString());
    assignedResource = resources.find((r) => assignedIds.includes(r._id.toString())) || resources[0];

    // Explicitly create an unassigned resource for scoping tests
    unassignedResource = await CampusResource.create({
      name: `Unassigned Facility ${Date.now()}`,
      type: 'Hall',
      location: 'Block X, 9th Floor',
      capacity: 30,
      managers: [],
      isActive: true,
    });
  });

  // PART 2: Shared Login & Authentication
  describe('Shared Authentication & Credential Verification', () => {
    it('1. Authenticates all five roles with email/password and returns trusted DB role', async () => {
      const roles = ['student', 'faculty', 'coordinator', 'resource_manager', 'admin'];
      for (const role of roles) {
        const email = role === 'resource_manager' ? 'resourcemanager@campussync.edu' : `${role}@campussync.edu`;
        const passMap = {
          student: 'Student@123',
          faculty: 'Faculty@123',
          coordinator: 'Coordinator@123',
          resource_manager: 'Manager@123',
          admin: 'Admin@123',
        };

        const res = await request(app).post('/api/auth/login').send({
          email,
          password: passMap[role],
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.role).toBe(role);
        expect(res.body.data.token).toBeDefined();
      }
    });

    it('2. Never trusts a client-supplied role in login body', async () => {
      // Student attempts to pass role='admin'
      const res = await request(app).post('/api/auth/login').send({
        email: 'student@campussync.edu',
        password: 'Student@123',
        role: 'admin',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('student'); // Database role enforced
    });

    it('3. Rejects invalid credentials with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'student@campussync.edu',
        password: 'WrongPassword!123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('4. Rejects suspended accounts with 403 error message', async () => {
      const suspendedUser = await User.create({
        fullName: 'Suspended User Test',
        email: `suspended.${Date.now()}@campussync.edu`,
        password: 'Password@123',
        role: 'student',
        status: 'suspended',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: suspendedUser.email,
        password: 'Password@123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('suspended by campus administration');
    });

    it('5. Rejects deactivated/inactive accounts with 403 error message', async () => {
      const inactiveUser = await User.create({
        fullName: 'Inactive User Test',
        email: `inactive.${Date.now()}@campussync.edu`,
        password: 'Password@123',
        role: 'coordinator',
        status: 'inactive',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: inactiveUser.email,
        password: 'Password@123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });

    it('6. Rejects pending accounts with 403 error message', async () => {
      const pendingUser = await User.create({
        fullName: 'Pending User Test',
        email: `pending.${Date.now()}@campussync.edu`,
        password: 'Password@123',
        role: 'faculty',
        status: 'pending',
      });

      const res = await request(app).post('/api/auth/login').send({
        email: pendingUser.email,
        password: 'Password@123',
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('pending administrator activation');
    });
  });

  // PART 5: Public Registration Rules
  describe('Public Registration Security Rules', () => {
    it('7. Public registration always creates student accounts and ignores privileged role inputs', async () => {
      const testEmail = `try.admin.${Date.now()}@campussync.edu`;
      const res = await request(app).post('/api/auth/register').send({
        fullName: 'Privilege Escalation Attempt',
        email: testEmail,
        password: 'SecurePass@123',
        confirmPassword: 'SecurePass@123',
        role: 'admin', // Malicious attempt to register as admin
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('student'); // Firmly forced to student
    });

    it('8. Non-administrators cannot create accounts through admin routes', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          fullName: 'Unauthorized Admin Attempt',
          email: `fail.${Date.now()}@campussync.edu`,
          password: 'Password@123',
          role: 'resource_manager',
        });

      expect(res.status).toBe(403);
    });
  });

  // PART 4 & 7: Admin Account Management & Assignments
  describe('Admin Portal — Resource Manager and Club Coordinator Management', () => {
    let newRMId = '';
    let newCoordId = '';

    it('9. Admin can create a new Resource Manager account with assigned resources', async () => {
      const email = `manager.${Date.now()}@campussync.edu`;
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Robert Facility Manager',
          email,
          password: 'ManagerPass@123',
          role: 'resource_manager',
          employeeId: `MGR-${Date.now().toString().slice(-4)}`,
          designation: 'Lead Facility Manager',
          assignedResources: [assignedResource._id],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('resource_manager');
      expect(res.body.data.assignedResources.length).toBeGreaterThanOrEqual(1);
      newRMId = res.body.data._id;

      // Verify CampusResource.managers bidirectional sync
      const resourceDoc = await CampusResource.findById(assignedResource._id);
      expect(resourceDoc.managers.some((m) => m.toString() === newRMId.toString())).toBe(true);
    });

    it('10. Admin can create a new Club Coordinator account with assigned club', async () => {
      const email = `coord.${Date.now()}@campussync.edu`;
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Jessica Club Lead',
          email,
          password: 'CoordPass@123',
          role: 'coordinator',
          studentId: `STU-${Date.now().toString().slice(-4)}`,
          designation: 'Student Club Coordinator',
          assignedClub: assignedClub._id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('coordinator');
      newCoordId = res.body.data._id;

      // Verify Club.coordinators bidirectional sync
      const clubDoc = await Club.findById(assignedClub._id);
      expect(clubDoc.coordinators.some((c) => c.toString() === newCoordId.toString())).toBe(true);
    });

    it('11. Admin can edit staff details, reassign clubs, and deactivate account', async () => {
      const res = await request(app)
        .put(`/api/admin/staff/${newCoordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Jessica Club Lead (Updated)',
          status: 'inactive',
          designation: 'Senior Club President',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Jessica Club Lead (Updated)');
      expect(res.body.data.status).toBe('inactive');

      // Attempt login with deactivated account -> must be rejected with 403
      const loginRes = await request(app).post('/api/auth/login').send({
        email: res.body.data.email,
        password: 'CoordPass@123',
      });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.message).toContain('deactivated');
    });

    it('12. Admin can reactivate an account and update assignments', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${newCoordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'active',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });
  });

  // PART 3, 4, 8: Ownership Scoping & Backend Authorization
  describe('Role-Based Authorization & Ownership Scoping Enforcement', () => {
    it('13. Resource Manager can only see bookings for their assigned resources', async () => {
      // Create a booking on the unassigned resource
      await ResourceBooking.create({
        resource: unassignedResource._id,
        requestedBy: coordinatorUser.id,
        purpose: 'Isolated Unassigned Resource Activity',
        date: new Date(Date.now() + 172800000),
        startTime: '14:00',
        endTime: '16:00',
        status: 'Pending',
      });

      const res = await request(app)
        .get('/api/resources/bookings')
        .set('Authorization', `Bearer ${resourceManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify that NO bookings for the unassigned resource are visible to this resource manager
      const unassignedIdStr = unassignedResource._id.toString();
      res.body.data.forEach((booking) => {
        const resId = (booking.resource?._id || booking.resource)?.toString();
        expect(resId).not.toBe(unassignedIdStr);
      });
    });

    it('14. Resource Manager is blocked with 403 from reviewing bookings for unassigned resources', async () => {
      // Create a booking for an unassigned resource
      const booking = await ResourceBooking.create({
        resource: unassignedResource._id,
        requestedBy: coordinatorUser.id,
        purpose: 'Test Unassigned Booking',
        date: new Date(Date.now() + 86400000),
        startTime: '10:00',
        endTime: '12:00',
        status: 'Pending',
      });

      const res = await request(app)
        .patch(`/api/resources/bookings/${booking._id}/review`)
        .set('Authorization', `Bearer ${resourceManagerToken}`)
        .send({
          status: 'Approved',
          reviewNotes: 'Unauthorized approval attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not authorized to review bookings for this resource');
    });

    it('15. Club Coordinator can only view members of their assigned club', async () => {
      // Access assigned club members
      const assignedRes = await request(app)
        .get(`/api/clubs/${assignedClub._id}/members`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(assignedRes.status).toBe(200);
      expect(assignedRes.body.success).toBe(true);

      // Access unassigned club members -> must be rejected with 403
      if (unassignedClub) {
        const unassignedRes = await request(app)
          .get(`/api/clubs/${unassignedClub._id}/members`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        expect(unassignedRes.status).toBe(403);
        expect(unassignedRes.body.success).toBe(false);
        expect(unassignedRes.body.message).toContain('assigned club');
      }
    });

    it('16. Club Coordinator cannot create events for an unassigned club', async () => {
      if (unassignedClub) {
        const res = await request(app)
          .post('/api/events')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            title: 'Unauthorized Club Event',
            description: 'Attempting to create event for a club I do not manage',
            category: 'Workshop',
            venue: 'Auditorium',
            club: unassignedClub._id, // Not assigned
            startDate: new Date(Date.now() + 86400000 * 2),
            endDate: new Date(Date.now() + 86400000 * 2 + 3600000),
            registrationDeadline: new Date(Date.now() + 86400000),
            capacity: 50,
          });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('assigned club');
      }
    });

    it('17. Deactivated user token is rejected with 403 on protected routes', async () => {
      const user = await User.create({
        fullName: 'Active Then Deactivated User',
        email: `deactivate.live.${Date.now()}@campussync.edu`,
        password: 'Password@123',
        role: 'student',
        status: 'active',
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: 'Password@123',
      });
      const activeToken = loginRes.body.data.token;

      // Now admin deactivates this user in DB
      user.status = 'inactive';
      await user.save();

      // Subsequent protected request using existing token must be rejected with 403
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${activeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });
  });
});
