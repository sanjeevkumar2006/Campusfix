import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initDatabase } from './database.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Generate realistic SVG image files for demo issues
function createSvgImage(filename, title, category, color, iconSymbol) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="600" fill="url(#bg)" />

  <!-- Grid pattern overlay -->
  <g opacity="0.05" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="100" x2="800" y2="100" />
    <line x1="0" y1="200" x2="800" y2="200" />
    <line x1="0" y1="300" x2="800" y2="300" />
    <line x1="0" y1="400" x2="800" y2="400" />
    <line x1="0" y1="500" x2="800" y2="500" />
    <line x1="100" y1="0" x2="100" y2="600" />
    <line x1="200" y1="0" x2="200" y2="600" />
    <line x1="300" y1="0" x2="300" y2="600" />
    <line x1="400" y1="0" x2="400" y2="600" />
    <line x1="500" y1="0" x2="500" y2="600" />
    <line x1="600" y1="0" x2="600" y2="600" />
    <line x1="700" y1="0" x2="700" y2="600" />
  </g>

  <!-- CampusFix Evidence Card -->
  <rect x="60" y="60" width="680" height="480" rx="24" fill="#1e293b" stroke="#334155" stroke-width="2" filter="url(#shadow)" />

  <!-- Badge Header -->
  <rect x="100" y="100" width="180" height="36" rx="18" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5" />
  <text x="190" y="124" fill="${color}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="1">${category.toUpperCase()}</text>

  <!-- Date / Watermark -->
  <text x="660" y="124" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="14" text-anchor="end">CAMPUS INCIDENT PHOTO EVIDENCE</text>

  <!-- Visual Icon Illustration -->
  <circle cx="400" cy="270" r="85" fill="#0f172a" stroke="${color}" stroke-width="3" />
  <text x="400" y="295" font-size="64" text-anchor="middle">${iconSymbol}</text>

  <!-- Title -->
  <text x="400" y="410" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" text-anchor="middle">${title}</text>

  <!-- Location info badge -->
  <rect x="250" y="445" width="300" height="38" rx="8" fill="#0f172a" />
  <text x="400" y="469" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" text-anchor="middle">📍 Verified Campus Location - Incident Logged</text>
</svg>`;
    fs.writeFileSync(path.join(uploadsDir, filename), svg);
}
export async function seed() {
    console.log('🌱 Starting CampusFix database seeding...');
    initDatabase();
    // Clear existing demo tables
    db.exec('DELETE FROM notifications;');
    db.exec('DELETE FROM issue_updates;');
    db.exec('DELETE FROM issues;');
    db.exec('DELETE FROM campus_locations;');
    db.exec('DELETE FROM users;');
    try {
        db.exec("DELETE FROM sqlite_sequence WHERE name IN ('notifications', 'issue_updates', 'issues', 'campus_locations', 'users');");
    }
    catch { }
    // 1. Create Seed Users
    const studentPassword = await bcrypt.hash('student123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, department, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    insertUser.run('student@campusfix.edu', studentPassword, 'Alex Rivera', 'student', 'Computer Science & Eng', '+1 (555) 234-5678');
    insertUser.run('priya@campusfix.edu', studentPassword, 'Priya Sharma', 'student', 'Mechanical Engineering', '+1 (555) 876-5432');
    insertUser.run('admin@campusfix.edu', adminPassword, 'Marcus Vance', 'admin', 'Campus Facilities Management', '+1 (555) 987-6543');
    insertUser.run('sarah.admin@campusfix.edu', adminPassword, 'Sarah Jenkins', 'admin', 'Estate & Infrastructure', '+1 (555) 345-6789');
    const student1 = db.prepare("SELECT id FROM users WHERE email = 'student@campusfix.edu'").get();
    const student2 = db.prepare("SELECT id FROM users WHERE email = 'priya@campusfix.edu'").get();
    const admin1 = db.prepare("SELECT id FROM users WHERE email = 'admin@campusfix.edu'").get();
    const admin2 = db.prepare("SELECT id FROM users WHERE email = 'sarah.admin@campusfix.edu'").get();
    // 2. Create Campus Locations (Realistic University Coordinates)
    const insertLocation = db.prepare(`
    INSERT INTO campus_locations (name, code, latitude, longitude, description)
    VALUES (?, ?, ?, ?, ?)
  `);
    const locations = [
        { name: 'Main Gate & Security Post', code: 'MAIN-GATE', lat: 12.9700, lng: 77.5920, desc: 'Campus main entry, visitor checkpoint & barrier' },
        { name: 'Block A - Science & Computing', code: 'BLK-A', lat: 12.9722, lng: 77.5938, desc: 'Computer labs, Physics, lecture hall 101-108' },
        { name: 'Block B - Engineering Complex', code: 'BLK-B', lat: 12.9735, lng: 77.5945, desc: 'Mechanical, Electrical, Robotics workshops' },
        { name: 'Central Library & Study Commons', code: 'LIB-CENTRAL', lat: 12.9718, lng: 77.5960, desc: 'Digital library, quiet study zone, archives' },
        { name: 'Student Union & Canteen', code: 'STUDENT-UNION', lat: 12.9705, lng: 77.5952, desc: 'Dining hall, student clubs, ATM pavilion' },
        { name: 'North Hostel Tower (Evergreen)', code: 'HOSTEL-NORTH', lat: 12.9748, lng: 77.5925, desc: 'Undergraduate student residence A-Wing' },
        { name: 'South Hostel Tower (Sunrise)', code: 'HOSTEL-SOUTH', lat: 12.9690, lng: 77.5930, desc: 'Senior student residence B-Wing' },
        { name: 'Advanced Research Laboratory', code: 'LAB-RESEARCH', lat: 12.9725, lng: 77.5950, desc: 'Chemistry & Biotech research facilities' },
        { name: 'Sports Complex & Playground', code: 'SPORTS-FIELD', lat: 12.9729, lng: 77.5975, desc: 'Indoor courts, track field, fitness gym' },
        { name: 'Campus Vehicle Parking', code: 'PARKING-WEST', lat: 12.9698, lng: 77.5932, desc: 'Staff and student multi-tier parking lot' },
        { name: 'Administrative Building', code: 'ADMIN-MAIN', lat: 12.9712, lng: 77.5940, desc: 'Registrar, Dean office, bursar, IT helpdesk' },
        { name: 'Other / Campus Grounds', code: 'CAMPUS-OTHER', lat: 12.9715, lng: 77.5948, desc: 'Open quad, perimeter walkway, garden avenues' }
    ];
    for (const loc of locations) {
        insertLocation.run(loc.name, loc.code, loc.lat, loc.lng, loc.desc);
    }
    // 3. Generate Sample Visual Photos
    createSvgImage('overflowing-bin.svg', 'Overflowing Garbage Bin', 'Waste Management', '#f59e0b', '🗑️');
    createSvgImage('water-leakage.svg', 'Burst Pipe Water Leakage', 'Water Leakage', '#3b82f6', '💧');
    createSvgImage('broken-streetlight.svg', 'Flickering Dark Pathway Light', 'Street/Indoor Lighting', '#eab308', '💡');
    createSvgImage('broken-bench.svg', 'Damaged Classroom Wooden Bench', 'Classroom Equipment', '#10b981', '🪑');
    createSvgImage('wifi-outage.svg', 'Campus Wi-Fi Signal Degradation', 'Internet/Wi-Fi', '#8b5cf6', '📶');
    createSvgImage('dirty-washroom.svg', 'Sanitation Issue & Clogged Sink', 'Sanitation', '#ec4899', '🧼');
    createSvgImage('damaged-staircase.svg', 'Broken Stairway Step Hazard', 'Infrastructure', '#ef4444', '⚠️');
    createSvgImage('exposed-wires.svg', 'Exposed High-Voltage Wiring', 'Electricity', '#dc2626', '⚡');
    createSvgImage('resolved-pipe.svg', 'Replaced & Sealed Pipe Joint', 'Water Leakage', '#22c55e', '🔧');
    // 4. Create Realistic Issues
    const insertIssue = db.prepare(`
    INSERT INTO issues (
      issue_code, student_id, category, title, description, image_url,
      ai_detected_category, ai_confidence, priority, location_name,
      latitude, longitude, status, assigned_to, resolution_notes, resolution_image_url,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const insertUpdate = db.prepare(`
    INSERT INTO issue_updates (issue_id, user_id, action, old_status, new_status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    // Issue 1: Water Leakage (Resolved)
    const res1 = insertIssue.run('CF-1001', student1.id, 'Water Leakage', 'Major water pipe leaking in Ground Floor Restroom', 'Constant pressurized water leaking from the main inlet valve behind sink #3. Water is pooling across the entrance tile floor posing a slipping hazard.', '/uploads/water-leakage.svg', 'Water Leakage', 96.5, 'high', 'Block B - Engineering Complex', 12.9735, 77.5945, 'resolved', admin1.id, 'Replaced high-pressure seal joint and re-grouted surrounding drainage tiles. Tested under full pressure for 45 minutes without any leaks.', '/uploads/resolved-pipe.svg', '2026-09-28 09:15:00', '2026-09-29 14:30:00');
    const id1 = Number(res1.lastInsertRowid);
    insertUpdate.run(id1, student1.id, 'created', null, 'pending', 'Reported with photo evidence', '2026-09-28 09:15:00');
    insertUpdate.run(id1, admin1.id, 'status_change', 'pending', 'acknowledged', 'Acknowledged by Facilities Dispatch', '2026-09-28 10:00:00');
    insertUpdate.run(id1, admin1.id, 'assigned', null, null, 'Assigned to Senior Plumber team lead Marcus Vance', '2026-09-28 10:30:00');
    insertUpdate.run(id1, admin1.id, 'status_change', 'acknowledged', 'in_progress', 'Plumber dispatched with spare replacement valve', '2026-09-29 11:00:00');
    insertUpdate.run(id1, admin1.id, 'resolved', 'in_progress', 'resolved', 'Valve replaced and tested successfully', '2026-09-29 14:30:00');
    // Issue 2: Garbage Bin (In Progress)
    const res2 = insertIssue.run('CF-1002', student1.id, 'Waste Management', 'Overflowing trash bin near Student Cafeteria entrance', 'The large recyclable and organic waste containers outside the cafeteria are overflowing. Wind is scattering plastic containers and paper cups into the garden walkway.', '/uploads/overflowing-bin.svg', 'Waste Management', 94.0, 'high', 'Student Union & Canteen', 12.9705, 77.5952, 'in_progress', admin2.id, null, null, '2026-10-04 12:45:00', '2026-10-05 08:30:00');
    const id2 = Number(res2.lastInsertRowid);
    insertUpdate.run(id2, student1.id, 'created', null, 'pending', 'Submitted via mobile camera', '2026-10-04 12:45:00');
    insertUpdate.run(id2, admin2.id, 'status_change', 'pending', 'in_progress', 'Janitorial shift 2 tasked with emptying bins and campus perimeter sweep', '2026-10-05 08:30:00');
    // Issue 3: Streetlight (Acknowledged)
    const res3 = insertIssue.run('CF-1003', student2.id, 'Street/Indoor Lighting', 'Flickering and dead streetlight on pathway to North Hostel', 'Light pole #14 along the shaded pathway leading to North Hostel is completely dark at night. Students walking back from late study sessions cannot see the pavement.', '/uploads/broken-streetlight.svg', 'Street/Indoor Lighting', 89.2, 'medium', 'North Hostel Tower (Evergreen)', 12.9748, 77.5925, 'acknowledged', admin1.id, null, null, '2026-10-05 18:20:00', '2026-10-05 19:10:00');
    const id3 = Number(res3.lastInsertRowid);
    insertUpdate.run(id3, student2.id, 'created', null, 'pending', 'Reported by Priya Sharma', '2026-10-05 18:20:00');
    insertUpdate.run(id3, admin1.id, 'status_change', 'pending', 'acknowledged', 'Scheduled for electrician crew replacement tomorrow morning', '2026-10-05 19:10:00');
    // Issue 4: Exposed Wiring (Pending - Critical)
    const res4 = insertIssue.run('CF-1004', student1.id, 'Electricity', 'Exposed high-voltage wire hanging near staircase landing', 'A loose electrical conduit cover has fallen off on the 2nd floor staircase landing in Block A. Live copper wire is exposed at shoulder height. High electrocution hazard!', '/uploads/exposed-wires.svg', 'Electricity', 97.8, 'critical', 'Block A - Science & Computing', 12.9722, 77.5938, 'pending', null, null, null, '2026-10-05 21:05:00', '2026-10-05 21:05:00');
    const id4 = Number(res4.lastInsertRowid);
    insertUpdate.run(id4, student1.id, 'created', null, 'pending', 'Urgent report tagged as CRITICAL', '2026-10-05 21:05:00');
    // Issue 5: Classroom Equipment (Pending - Medium)
    const res5 = insertIssue.run('CF-1005', student2.id, 'Classroom Equipment', 'Damaged tiered wooden desk row 4 in Lecture Hall LH-204', 'The desktop support bracket is split and wobbles dangerously. Students cannot place laptops or write without the desk tilting forward.', '/uploads/broken-bench.svg', 'Classroom Equipment', 88.0, 'medium', 'Block A - Science & Computing', 12.9725, 77.5940, 'pending', null, null, null, '2026-10-05 22:30:00', '2026-10-05 22:30:00');
    const id5 = Number(res5.lastInsertRowid);
    insertUpdate.run(id5, student2.id, 'created', null, 'pending', 'Reported after Physics lecture', '2026-10-05 22:30:00');
    // Issue 6: Wi-Fi Problem (Acknowledged - Medium)
    const res6 = insertIssue.run('CF-1006', student1.id, 'Internet/Wi-Fi', 'Library 3rd Floor quiet study zone Wi-Fi dropping packets', 'The eduroam / CampusFix-WiFi access point on the east wing of the 3rd floor repeatedly disconnects and shows no internet connection for all students.', '/uploads/wifi-outage.svg', 'Internet/Wi-Fi', 86.5, 'medium', 'Central Library & Study Commons', 12.9718, 77.5960, 'acknowledged', admin2.id, null, null, '2026-10-05 14:15:00', '2026-10-05 15:00:00');
    const id6 = Number(res6.lastInsertRowid);
    insertUpdate.run(id6, student1.id, 'created', null, 'pending', 'Reported during midterms study', '2026-10-05 14:15:00');
    insertUpdate.run(id6, admin2.id, 'status_change', 'pending', 'acknowledged', 'Campus Network Operations Center notified for remote PoE switch reboot', '2026-10-05 15:00:00');
    // Issue 7: Dirty Washroom (Resolved)
    const res7 = insertIssue.run('CF-1007', student2.id, 'Sanitation', 'Unsanitary washroom condition on Sports Complex 1st floor', 'Clogged floor drain causing standing dirty water and foul odor. Soap dispensers are empty.', '/uploads/dirty-washroom.svg', 'Sanitation', 91.0, 'high', 'Sports Complex & Gymnasium', 12.9729, 77.5975, 'resolved', admin2.id, 'Deep cleaned and sanitized restroom. Drain unclogged with chemical auger. Restocked hand soap and paper towels.', null, '2026-10-03 10:10:00', '2026-10-03 16:45:00');
    const id7 = Number(res7.lastInsertRowid);
    insertUpdate.run(id7, student2.id, 'created', null, 'pending', 'Reported by Priya Sharma', '2026-10-03 10:10:00');
    insertUpdate.run(id7, admin2.id, 'resolved', 'in_progress', 'resolved', 'Cleaned and sanitized', '2026-10-03 16:45:00');
    // Issue 8: Staircase Hazard (Reopened)
    const res8 = insertIssue.run('CF-1008', student1.id, 'Infrastructure', 'Cracked concrete step edge near Administrative Building entrance', 'Front external staircase step has broken concrete leaving sharp rebar exposed. Someone tripped earlier today.', '/uploads/damaged-staircase.svg', 'Infrastructure', 93.4, 'high', 'Administrative Building', 12.9712, 77.5940, 'reopened', admin1.id, 'Temporary warning cone placed, but permanent rapid-set cement patch crumbled after rain.', null, '2026-10-01 08:00:00', '2026-10-04 16:00:00');
    const id8 = Number(res8.lastInsertRowid);
    insertUpdate.run(id8, student1.id, 'created', null, 'pending', 'Initial report', '2026-10-01 08:00:00');
    insertUpdate.run(id8, admin1.id, 'status_change', 'pending', 'in_progress', 'Masonry team dispatched', '2026-10-01 11:00:00');
    insertUpdate.run(id8, student1.id, 'reopened', 'in_progress', 'reopened', 'Temporary patch washed away after evening rain storm; exposed metal is loose again.', '2026-10-04 16:00:00');
    // 5. Seed Notifications
    const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, issue_id, issue_code, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertNotif.run(student1.id, id1, 'CF-1001', 'Issue Resolved', '✅ Your issue #CF-1001 has been resolved! Check the resolution notes.', 'resolution', 1, '2026-09-29 14:30:00');
    insertNotif.run(student1.id, id2, 'CF-1002', 'Issue In Progress', '⚙️ Your issue #CF-1002 is now In Progress. Janitorial shift dispatched.', 'status_change', 0, '2026-10-05 08:30:00');
    insertNotif.run(student1.id, id4, 'CF-1004', 'Issue Submitted', 'Your issue #CF-1004 has been received and logged into CampusFix.', 'status_change', 0, '2026-10-05 21:05:00');
    insertNotif.run(student2.id, id3, 'CF-1003', 'Issue Acknowledged', '🔔 Your issue #CF-1003 has been acknowledged by administration.', 'status_change', 0, '2026-10-05 19:10:00');
    insertNotif.run(admin1.id, id4, 'CF-1004', 'Critical Safety Alert', '⚠️ Critical priority issue #CF-1004 reported in Block A: Exposed High-Voltage Wiring.', 'system', 0, '2026-10-05 21:05:00');
    console.log('✨ Seed data created successfully!');
    console.log('👤 Student demo: student@campusfix.edu / student123');
    console.log('🛡️ Admin demo:   admin@campusfix.edu / admin123');
}
// Run if called directly
seed().catch(err => {
    console.error('Seed script error:', err);
    process.exit(1);
});
