import { cronJobs } from 'convex/server'
import { api } from './_generated/api'

const crons = cronJobs()

// Alfred works on his own: Convex runs these server-side on a schedule —
// no browser open, no computer on. This is what makes the assistant
// autonomous instead of a button you have to press.

// Scan for new gigs and draft proposals every 6 hours.
crons.interval('autonomous gig scan', { hours: 6 }, api.gigs.scanForGigs, {})

// Once a day, summarize the best open gigs into the activity log + chat.
crons.daily('daily digest', { hourUTC: 13, minuteUTC: 0 }, api.digest.dailyDigest, {})

export default crons
