import SessionModel from '../models/sessionModel.js';
import cron from 'node-cron';

class SessionCleanup {
  static startCleanupScheduler() {
    // Run cleanup every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const deletedCount = await SessionModel.cleanupExpiredSessions();
        if (deletedCount > 0) {
          console.log(`Cleaned up ${deletedCount} expired sessions`);
        }
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    });
  }
}

export default SessionCleanup;