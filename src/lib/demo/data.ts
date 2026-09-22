/** Source material for the demo tenant. Real-sounding, deliberately not lorem ipsum. */

export const DEMO_BUSINESS = {
  name: 'Ridgeline Lawn & Landscape',
  slug: 'ridgeline',
  phone: '(724) 555-0148',
  email: 'office@ridgelinelandscape.com',
  address: '1820 Babcock Blvd',
  city: 'Wexford',
  state: 'PA',
  zip: '15090',
  timezone: 'America/New_York',
  reviewUrl: 'https://g.page/r/ridgeline-lawn-landscape/review',
};

export const DEMO_TEAM = [
  { name: 'Mike Alvarez', email: 'mike@ridgelinelandscape.com', role: 'owner' as const, phone: '(724) 555-0101' },
  { name: 'Dana Whitfield', email: 'dana@ridgelinelandscape.com', role: 'admin' as const, phone: '(724) 555-0102' },
  { name: 'Luis Ramirez', email: 'luis@ridgelinelandscape.com', role: 'crew' as const, phone: '(724) 555-0111' },
  { name: 'Tyler Boone', email: 'tyler@ridgelinelandscape.com', role: 'crew' as const, phone: '(724) 555-0112' },
  { name: 'Marcus Webb', email: 'marcus@ridgelinelandscape.com', role: 'crew' as const, phone: '(724) 555-0113' },
  { name: 'Kevin Ott', email: 'kevin@ridgelinelandscape.com', role: 'crew' as const, phone: '(724) 555-0114' },
  { name: 'Sam Pryor', email: 'sam@ridgelinelandscape.com', role: 'crew' as const, phone: '(724) 555-0115' },
];

export const DEMO_CUSTOMERS = [
  { name: 'Sarah Miller', street: '412 Hunters Ridge Dr', city: 'Wexford', zip: '15090' },
  { name: 'Ray & Tonia Johnson', street: '96 Sycamore Hill Rd', city: 'Wexford', zip: '15090' },
  { name: 'Patrick Donnelly', street: '1147 Blackburn Rd', city: 'Sewickley', zip: '15143' },
  { name: 'Angela Reyes', street: '38 Meadowcrest Ln', city: 'Cranberry Twp', zip: '16066' },
  { name: 'Bill Thompson', street: '705 Orchard Park Dr', city: 'Wexford', zip: '15090' },
  { name: 'Nicole Barrett', street: '221 Glen Eagle Ct', city: 'Mars', zip: '16046' },
  { name: 'Harold Kwon', street: '58 Timberline Dr', city: 'Gibsonia', zip: '15044' },
  { name: 'The Williams Family', street: '1310 Fox Chapel Rd', city: 'Pittsburgh', zip: '15238' },
  { name: 'Denise Falco', street: '644 Warrendale Rd', city: 'Wexford', zip: '15090' },
  { name: 'Greg Santoro', street: '19 Pinecrest Dr', city: 'Cranberry Twp', zip: '16066' },
  { name: 'Marcy Whitlock', street: '873 Duncan Ave', city: 'Wexford', zip: '15090' },
  { name: 'Omar Haddad', street: '455 Brush Creek Rd', city: 'Mars', zip: '16046' },
  { name: 'Katherine Pruitt', street: '12 Stonegate Cir', city: 'Sewickley', zip: '15143' },
  { name: 'Dave Lindqvist', street: '2201 Rochester Rd', city: 'Gibsonia', zip: '15044' },
  { name: 'Brenda Ocampo', street: '77 Laurel Oak Dr', city: 'Wexford', zip: '15090' },
  { name: 'Tom & Lisa Vance', street: '930 Church Hill Rd', city: 'Cranberry Twp', zip: '16066' },
  { name: 'Priya Raghunathan', street: '154 Bradford Way', city: 'Wexford', zip: '15090' },
  { name: 'Curtis Nolan', street: '3311 Wallace Rd', city: 'Gibsonia', zip: '15044' },
  { name: 'Eleanor Voss', street: '68 Thornberry Dr', city: 'Sewickley', zip: '15143' },
  { name: 'Jamal Whitfield', street: '505 Peebles Rd', city: 'Wexford', zip: '15090' },
  { name: 'Northgate HOA', street: '1 Northgate Commons', city: 'Cranberry Twp', zip: '16066' },
  { name: 'Rita Castellano', street: '88 Hemlock Hollow', city: 'Mars', zip: '16046' },
  { name: 'Scott Beaumont', street: '742 Ferguson Rd', city: 'Wexford', zip: '15090' },
  { name: 'Yolanda Price', street: '215 Red Maple Ct', city: 'Gibsonia', zip: '15044' },
  { name: 'Ken Ishikawa', street: '1604 Nicholson Rd', city: 'Sewickley', zip: '15143' },
];

export const DEMO_REQUESTS: { service: string; text: string; urgency?: 'low' | 'high' }[] = [
  {
    service: 'cleanup',
    text: 'Hey, looking to get my backyard cleaned up and have some new mulch put down. It got away from us over the summer — there are weeds in all the beds along the fence and a pile of branches from the storm. Can someone come take a look?',
  },
  {
    service: 'mulch',
    text: 'We need mulch refreshed in the front beds and around the two island beds out back. Probably 8 or 9 yards worth. Dark brown hardwood if you have it.',
  },
  {
    service: 'lawn',
    text: 'Looking for weekly mowing for the season. About a third of an acre, fenced backyard, one dog. We had a service last year that kept missing weeks.',
  },
  {
    service: 'landscaping',
    text: 'We just finished a patio and the area around it is bare dirt. Want to put in some shrubs and a small planting bed on the east side. Open to ideas on what does well in shade.',
  },
  {
    service: 'irrigation',
    text: 'Two zones in the front stopped coming on and one head is spraying the driveway. System is about 9 years old, Rain Bird controller in the garage.',
  },
  {
    service: 'cleanup',
    text: 'Spring cleanup — leaves everywhere, beds need edging, and the ornamental grasses need cut back. Whole yard, about a half acre.',
    urgency: 'high',
  },
  {
    service: 'lawn',
    text: 'Need someone reliable for biweekly mowing and trimming. Small yard, maybe 4000 sq ft total.',
  },
  {
    service: 'cleanup',
    text: 'Selling the house and the listing photos are Thursday. Need the yard cleaned up fast — hedges trimmed, beds weeded, lawn cut. Can pay for the rush.',
    urgency: 'high',
  },
  {
    service: 'mulch',
    text: 'Front of the house only. Beds are about 40 feet of frontage. Also want the edge re-cut, it has gone soft.',
  },
  {
    service: 'landscaping',
    text: 'Thinking about doing something with the slope on the side of the house — it washes out every spring. Maybe a retaining wall or terracing. No rush, planning for next season.',
    urgency: 'low',
  },
  {
    service: 'irrigation',
    text: 'Want a quote to have the sprinkler system blown out before the freeze, and one zone checked that has low pressure.',
  },
  {
    service: 'cleanup',
    text: 'Backyard is pretty overgrown — has not been touched in about two years since my husband passed. There is a lot of brush and some small trees that came up on their own. Would need it hauled away.',
  },
  {
    service: 'lawn',
    text: 'HOA common areas — three entrance islands and the walking path border. Need a bid for the season, mowing plus bed maintenance.',
  },
  {
    service: 'landscaping',
    text: 'New construction, builder left us with mud. Need sod in the front and back, plus basic foundation plantings.',
  },
  {
    service: 'mulch',
    text: 'Mulch and a few replacement shrubs. Two of the boxwoods by the porch died over the winter.',
  },
  {
    service: 'cleanup',
    text: 'Leaf cleanup, one time. Big oak in the back, the whole yard is buried.',
  },
  {
    service: 'lawn',
    text: 'Lawn looks terrible — lots of crabgrass and bare patches. Want to know what it would take to fix it, aeration and overseeding maybe.',
  },
  {
    service: 'landscaping',
    text: 'Want to redo the walkway from the driveway to the front door and put in lighting along it.',
  },
  {
    service: 'irrigation',
    text: 'Adding a new bed along the back fence and want drip run to it off the existing system.',
  },
  {
    service: 'cleanup',
    text: 'Storm took down a section of fence and there are branches across the whole back lawn. Need it cleared out this week if possible.',
    urgency: 'high',
  },
];

export const DEMO_MESSAGES_IN = [
  'Sounds good, what would a ballpark be?',
  'Can you come out Thursday afternoon instead?',
  'We are good to go, just let me know when.',
  'Is that price with the haul away included?',
  'Thanks — we went with someone else this time, but we will keep you in mind.',
  'Perfect, the gate code is 4412.',
  'Can we push it a week? We have family in town.',
];

export const DEMO_REVIEWS = [
  { rating: 5, comment: 'Crew showed up when they said they would and the yard looks better than it has in years.' },
  { rating: 5, comment: 'Fair price, no surprises, and they cleaned up after themselves. Already booked them for fall.' },
  { rating: 5, comment: 'Mike walked the property with me and explained exactly what they were going to do.' },
  { rating: 4, comment: 'Good work overall. Took one extra day than planned but they kept me posted.' },
  { rating: 5, comment: 'The before and after photos they sent were wild. Huge difference.' },
  { rating: 3, comment: 'Job was fine but they were two hours later than the window I was given.' },
  { rating: 5, comment: 'Third season with Ridgeline. Never had to chase them for anything.' },
];

export const SERVICE_RATE_SEED = [
  { service_type: 'cleanup', label: 'Yard cleanup', per_hour: 7500, typical_hours: 4, material_est: 0, min_price: 22500, spread_pct: 20 },
  { service_type: 'mulch', label: 'Mulch installation', per_hour: 7500, typical_hours: 3.5, material_est: 18000, min_price: 32500, spread_pct: 15 },
  { service_type: 'lawn', label: 'Lawn maintenance', per_hour: 6500, typical_hours: 1, material_est: 0, min_price: 6500, spread_pct: 10 },
  { service_type: 'landscaping', label: 'Landscape design & install', per_hour: 8500, typical_hours: 10, material_est: 95000, min_price: 150000, spread_pct: 28 },
  { service_type: 'irrigation', label: 'Irrigation service', per_hour: 9500, typical_hours: 2, material_est: 6500, min_price: 15000, spread_pct: 18 },
];
