import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { LectureAttendance } from '../models/LectureAttendance.js';
import { TimetableEntry } from '../models/TimetableEntry.js';

export const runAttendanceMigration = async () => {
  try {
    const isStandalone = mongoose.connection.readyState !== 1;
    if (isStandalone) {
      const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campussphere';
      await mongoose.connect(uri);
      console.log('Connected to MongoDB for attendance migration.');
    }

    // 1. Update records with missing or null sessionStatus to 'Submitted'
    const statusUpdateResult = await LectureAttendance.updateMany(
      {
        $or: [
          { sessionStatus: { $exists: false } },
          { sessionStatus: null },
          { sessionStatus: '' },
        ],
      },
      {
        $set: { sessionStatus: 'Submitted' },
      }
    );
    console.log(`[Migration] Updated sessionStatus to 'Submitted' on ${statusUpdateResult.modifiedCount} records.`);

    // 2. Link timetableEntry on records where it is currently null
    const unlinkedSessions = await LectureAttendance.find({
      $or: [{ timetableEntry: null }, { timetableEntry: { $exists: false } }],
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let linkedCount = 0;

    for (const session of unlinkedSessions) {
      if (!session.date || !session.startTime) continue;
      const d = new Date(session.date);
      const dayOfWeek = dayNames[d.getUTCDay()];

      const matchingEntry = await TimetableEntry.findOne({
        faculty: session.faculty,
        subject: session.subject,
        classDivision: session.classDivision,
        dayOfWeek,
        startTime: session.startTime,
        status: 'Published',
      });

      if (matchingEntry) {
        session.timetableEntry = matchingEntry._id;
        await session.save();
        linkedCount++;
        console.log(`[Migration] Linked session ${session._id} to timetableEntry ${matchingEntry._id} (${dayOfWeek} ${session.startTime})`);
      }
    }
    console.log(`[Migration] Successfully linked ${linkedCount} sessions to published timetable entries.`);

    // 3. Normalize dates to UTC midnight where time components exist
    const sessionsWithTime = await LectureAttendance.find({});
    let normalizedCount = 0;

    for (const s of sessionsWithTime) {
      if (!s.date) continue;
      const d = new Date(s.date);
      if (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) {
        const isoStr = d.toISOString().split('T')[0];
        const [year, month, day] = isoStr.split('-').map(Number);
        const normalized = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        s.date = normalized;
        await s.save();
        normalizedCount++;
      }
    }
    console.log(`[Migration] Normalized date timestamps on ${normalizedCount} sessions.`);

    if (isStandalone) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    }

    return {
      statusUpdated: statusUpdateResult.modifiedCount,
      timetableLinked: linkedCount,
      dateNormalized: normalizedCount,
    };
  } catch (error) {
    console.error('[Migration Error]:', error);
    throw error;
  }
};

// If run directly via node command
if (process.argv[1]?.endsWith('migrateAttendanceStatus.js')) {
  runAttendanceMigration()
    .then((res) => {
      console.log('Migration finished successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
