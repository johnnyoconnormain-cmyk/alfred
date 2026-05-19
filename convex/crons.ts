import { cronJobs } from 'convex/server'
import { api } from './_generated/api'

const crons = cronJobs()

// Alfred works on his own: every 6 hours Convex runs the gig scan
// server-side — no browser open, no computer on. This is what makes
// the assistant autonomous instead of a button you have to press.
crons.interval('autonomous gig scan', { hours: 6 }, api.gigs.scanForGigs, {})

export default crons
