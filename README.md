# Royal Square Connect

PROJECT: Build a client servicing and compliance management platform for Royal Square Financial (Pty) Ltd, an independent financial brokerage in South Africa.

CORE REQUIREMENTS:
- Tech: React frontend + Node.js/Express backend + SQLite database
- No real authentication needed, use simple OTP mock (log to console)
- No real payment processing or email/SMS integration
- No real file storage, use base64 or mock filesystem
- All APIs are mocked (no real Santam/Old Mutual integration)

USER ROLES:
1. Client — individual with insurance/investment policies
2. Adviser — Royal Square employee managing clients
3. Admin — internal staff (minimal, for testing only)

CORE FEATURES (Build in this order):

## 1. CLIENT ONBOARDING (Digital-First, No Paper)
When client registers, present these mandatory digital forms, fillable in-app:
- Confidentiality Agreement
- Broker Appointment form
- Client Consent form
- FAIS Disclosure (regulatory)
- Service Agreement
- Privacy Policy & Terms & Conditions

Each form must:
- Have text inputs, checkboxes, dropdowns for data collection
- Include digital signature field: checkbox "I agree and sign electronically" with auto-captured timestamp and user ID
- Generate and store a PDF of signed form (as base64 in database)
- Auto-extract key data (name, address, phone, email) and save to client profile
- Lock form after signing (no editing)
- Show a "Signed on [date] at [time]" confirmation

Data to collect per form (examples):
- Name, email, phone, address, postal code, ID number
- Consent checkbox for data processing (POPIA)
- Consent checkbox for communication preferences
- Adviser assigned to client
- Date of agreement

## 2. CLIENT DASHBOARD
Real-time overview for logged-in client:
- Profile section: name, contact, profile picture placeholder
- Net worth summary card (total value, mock calculation from policies + investments)
- Policy summary: count of active policies, total annual premium
- Investment summary: count of holdings, total value
- Quick action buttons: "Report a Claim," "Update Profile," "View Reminders," "View My Goals"
- Visual cards or progress bars for policies and investments
- Adviser name and contact displayed
- Link to download all signed onboarding documents

Mock data for each client: 3-4 policies (Santam motor, Old Mutual investment, Liberty life insurance), net worth ~R500K

## 3. ADVISER DASHBOARD
High-level overview for adviser staff:
- Total active clients count
- Reminders due this week (count and list)
- Claims in progress (count and list)
- Client list (searchable by name):
  - Show client name, last interaction date, policies count, next reminder due, any open claims
  - Click client to view their full profile/dashboard
- Quick stats: total policies under management, total client value (sum of net worth)

## 4. REMINDERS ENGINE
Automated reminders visible to adviser and/or client:

Adviser view:
- Dashboard showing all upcoming reminders across all clients
- Sorted by due date (soonest first)
- Color-coded: green (pending), orange (due soon, within 7 days), red (overdue)
- Mark as "read" or "dismiss"
- Filter by reminder type

Client view:
- List of personal reminders
- Show due date, reminder type, message
- Mark as "read"

Initial reminder types (hardcoded, but structure allows easy addition):
- Driving licence expiry (notify client 30 days before)
- Insurance valuation certificate due (notify both adviser + client, 60 days before)
- Annual financial review meeting (notify adviser 1 week before)
- Retirement fee renewal (notify adviser 14 days before)
- Birthdays & anniversaries (notify adviser on the day, auto-recurring yearly)

Mock data: Seed 5-7 reminders across different clients and types, some due soon, some overdue.

## 5. GOAL TRACKING
Adviser creates goals, clients see progress:

Adviser interface:
- Form to create goal: goal name, target amount, target date, description
- Can mark goal as individual (single client) or shared (multiple clients, e.g., couple)
- List of all created goals across all clients

Client interface:
- Dashboard showing all personal goals as progress bars
- Format: "Goal Name: 60% toward target ($150K of $250K target by Dec 2026)"
- No complex calculation, just (current_value / target_value) * 100

Mock data: Seed 3-4 goals with varying completion percentages (25%, 60%, 80%, 100%).

## 6. MOTOR CLAIM FULL WORKFLOW (Centerpiece Demo)
Built end-to-end. This is what you'll demo live.

STEP 1: Report an Accident or Loss
- Client clicks "Report an Accident or Loss" button
- Display an interactive checklist (not a form, just a guide):
  - Photos of road surface & direction of travel
  - Address or nearest cross streets
  - Photos of all vehicles & people involved
  - Licence plates & registration discs
  - ID documents of everyone involved
  - Witness names, contact details, optional voice note
  - Insurance details of other parties
  - Reminder to report to police within 48 hours
- Client checks off items as they gather them (visual checklist)
- No submission here, it's just guidance

STEP 2: Register a Motor Claim
- Client clicks "Register a Motor Claim"
- Dropdown to select insurer: Santam, Old Mutual, Liberty, Momentum, Discovery, Allan Gray (6 options)
- Form fields:
  - Incident date, time, description (text area)
  - Police notification: yes/no checkbox, case number if yes
  - Witness details: name, phone, statement taken: yes/no
  - Who was driving: client or other person
  - Personal or business use: radio button
  - Other vehicle details: licence, registration, owner name, owner ID, insurer, policy number
  - Third-party insurance details: insurer, policy number
- File upload fields (mock, no real upload needed):
  - Photos of vehicles & damage
  - Photos of road surface
  - Licence plates & registration discs
  - Driver's licence photo
  - ID documents
  - Accident sketch (upload or placeholder)

STEP 3: AI-Assisted Data Extraction with Confidence Flagging
- When user uploads a photo of ID, licence, or registration disc:
  - Run Tesseract.js (lightweight OCR) to extract text
  - Pre-populate extracted data into form fields (ID number, name, licence number, expiry, etc.)
  - Display confidence score for each extracted field (e.g., "87% confidence")
  - Color-code flagged fields:
    - Green: high confidence (>85%)
    - Orange/Yellow: medium confidence (70-85%)
    - Red: low confidence (<70%) or critical fields (ID numbers, policy numbers, licence numbers)
  - User must manually review and confirm/correct flagged fields before proceeding
  - Show OCR output visually so user can see what was extracted
  - Once user confirms, lock the data

STEP 4: Digital Signature
- Before claim submission, show signature section:
  - Text: "I hereby declare that the above information is accurate and complete"
  - Checkbox: "I agree and sign electronically"
  - System auto-captures: client name, timestamp (date + time), user ID
  - Display PDF preview of the signed claim form
  - After signature, claim moves to "Submitted" status
  - Store claim PDF in database

STEP 5: Claim Tracking
- Display claim status progression through stages:
  - Submitted (just now, timestamp shown)
  - Processing (auto after 1 second, claim number assigned: e.g., "RSF-CLM-20260905-001")
  - Assessment scheduled (auto after 2 seconds, assessment date in 3-5 days)
  - Under assessment (vehicle at assessor, mock assessor name displayed)
  - Repair quote received (mock quote: R15,000 for paint, parts, labor)
  - Repair authorised (auto after claim review)
  - Repair in progress (display weekly updates, auto-generated: "Bodywork 60% complete", "Parts ordered")
  - Completed (claim closed, option for client and adviser to rate)
  
- Each status update shows timestamp and brief message
- Adviser view: see all claims across all clients, filterable by status (Submitted, In Progress, Completed)
- Client view: see only own claims
- Mock API simulation: when claim submitted, show a visible API call in a dev console or "API Log" panel:
  - Show POST request to "https://api.mock-santam.com/claims/submit"
  - Show request body (JSON with claim data)
  - Show response body (claim number, handler, next steps)
  - This proves integration architecture is sound, even though backend is mocked

STEP 6: Completion & Review
- Once claim "Completed," both client and adviser get a prompt to rate:
  - Rating: 1-5 stars (radio buttons)
  - Optional comment (text area)
  - Both ratings locked once submitted
  - Show average rating on claim record

## 7. COMPLIANCE & SECURITY FRAMEWORK
Build these structural components (no need for full implementation):

- Audit logging: every action logged (user, action, timestamp, resource affected)
  - Create audit_log table with: id, user_id, action, resource, timestamp, details (JSON)
  - Log: form submissions, claim filings, data views, user logins
  - Adviser can view audit trail for assigned clients
  
- Role-based access control: enforce at API level
  - Client sees only their own data
  - Adviser sees only assigned clients
  - Admin sees everything
  - Return 403 Forbidden if user tries to access data outside their role
  
- Session management:
  - Session timeout after 30 minutes of inactivity
  - Track last_activity timestamp on every API call
  - Check (now - last_activity) and log out if exceeded

- Password security: hash passwords with bcrypt, never store plaintext

- Data classification: mark fields as "personal", "financial", "sensitive" in database schema (comment in code is fine for MVP)

- T&C & Privacy Policy: Display during onboarding, must agree before account creation

## DATABASE SCHEMA (SQLite)

```
CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  id_number TEXT,
  adviser_id INTEGER,
  profile_complete BOOLEAN DEFAULT 0,
  date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(adviser_id) REFERENCES advisers(id)
);

CREATE TABLE advisers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT
);

CREATE TABLE onboarding_forms (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  form_type TEXT (Confidentiality, Broker Appointment, Consent, FAIS, Service Agreement),
  data JSON,
  signed BOOLEAN DEFAULT 0,
  signed_at TIMESTAMP,
  pdf_base64 TEXT,
  FOREIGN KEY(client_id) REFERENCES clients(id)
);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY,
  adviser_id INTEGER,
  client_id INTEGER NOT NULL,
  reminder_type TEXT (licence_expiry, valuation_cert, annual_review, retirement_fee, birthday),
  due_date DATE NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT 0,
  dismissed BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(adviser_id) REFERENCES advisers(id),
  FOREIGN KEY(client_id) REFERENCES clients(id)
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY,
  created_by_adviser_id INTEGER NOT NULL,
  goal_name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  target_date DATE,
  description TEXT,
  shared_client_ids JSON (array of client IDs if shared),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_adviser_id) REFERENCES advisers(id)
);

CREATE TABLE claims (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  claim_number TEXT UNIQUE,
  claim_type TEXT (motor),
  insurer TEXT,
  status TEXT (submitted, processing, assessment, repair, completed),
  incident_date DATE,
  incident_description TEXT,
  police_case_number TEXT,
  third_party_name TEXT,
  third_party_id TEXT,
  third_party_insurer TEXT,
  third_party_policy TEXT,
  claim_data JSON (all form fields),
  signed BOOLEAN DEFAULT 0,
  signed_at TIMESTAMP,
  pdf_base64 TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES clients(id)
);

CREATE TABLE claim_attachments (
  id INTEGER PRIMARY KEY,
  claim_id INTEGER NOT NULL,
  file_type TEXT (photo, licence, id, accident_sketch),
  file_base64 TEXT,
  extracted_text TEXT (OCR output if applicable),
  confidence_score INTEGER (0-100),
  uploaded_at TIMESTAMP,
  FOREIGN KEY(claim_id) REFERENCES claims(id)
);

CREATE TABLE claim_status_updates (
  id INTEGER PRIMARY KEY,
  claim_id INTEGER NOT NULL,
  status TEXT,
  message TEXT,
  timestamp TIMESTAMP,
  FOREIGN KEY(claim_id) REFERENCES claims(id)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  user_type TEXT (client, adviser, admin),
  action TEXT (login, form_submitted, claim_submitted, data_viewed),
  resource TEXT (claim, goal, form, onboarding),
  timestamp TIMESTAMP,
  details JSON,
  FOREIGN KEY(user_id) REFERENCES clients(id) OR advisers(id)
);
```

## FRONTEND COMPONENTS TO BUILD

1. Header / Navigation
   - Include Royal Square logo at top (import from /public/royal-square-logo.png)
   - Show logged-in user name and role (Client / Adviser / Admin)
   - Logout button
   - Nav links: Dashboard, Claims, Reminders, Goals, Profile, Downloads

2. Login / Registration
   - Email + OTP flow (log OTP to console for demo)
   - Show OTP input after email submit
   - After OTP, prompt for name, phone (if new client)

3. Client Profile / Onboarding Forms
   - Show onboarding status: Incomplete, In Progress, Completed
   - Display all 5 forms as cards: Confidentiality, Broker Appointment, Consent, FAIS, Service Agreement
   - Each form is fillable, has digital signature field
   - After signing, show "Signed on [date]" and download button for PDF

4. Client Dashboard
   - Net worth card, policy summary, investment summary
   - Quick action buttons
   - Adviser info card

5. Adviser Dashboard
   - Overview cards: total clients, reminders due, claims in progress
   - Client list with search
   - Click client to view their dashboard

6. Reminders List
   - Adviser view: all reminders across clients
   - Client view: personal reminders only
   - Color-coded by status (pending, due soon, overdue)
   - Mark as read / dismiss

7. Goal Tracker
   - List of goals with progress bars
   - Show target amount, current amount, target date, percentage complete

8. Motor Claim Workflow
   - Step 1: Accident checklist (visual guide, not submittable)
   - Step 2: Claim registration form (long form with many fields)
   - Step 3: File upload with OCR preview (show extracted text + confidence scores)
   - Step 4: Digital signature confirmation with PDF preview
   - Step 5: Claim tracking display (status progression with timeline)
   - Step 6: Rating form (after completion)

9. API Log / Dev Console (for demo)
   - Show JSON request/response when claim submitted to mock API
   - Visible button to toggle on/off

## STYLING & UX
- Use Royal Square brand colors: dark red, black, white
- Logo in header top-left, 40px height
- Mobile-first responsive design
- Large form fields and buttons (Royal Square team is non-technical)
- Progress indicators for multi-step forms (Step 2 of 4)
- Checkmarks and visual feedback for completed actions
- Clear error messages and validation

## WHAT NOT TO BUILD
- Real Santam/Old Mutual API integration (mock only)
- Real file upload to cloud (store as base64)
- Real SMS/WhatsApp (log OTP to console)
- Real payment processing
- Multi-language support
- Mobile app (responsive web is enough)
- Real e-signature service (checkbox + timestamp is fine)
- Advanced analytics or reports

## SEED DATA
Pre-populate database on startup:
- 2 advisers: Qiniso Ntuli, [Another name]
- 3 clients (each fully onboarded, forms signed):
  - Client 1: John Smith, john@email.com, policies: Santam motor + Old Mutual investments
  - Client 2: Jane Doe, jane@email.com, policies: Liberty life + Old Mutual investments
  - Client 3: Bob Johnson, bob@email.com, policies: Santam motor + Liberty life
- Each client has net worth ~R500K (mock calculation)
- 5 reminders (different types, different statuses)
- 3 goals (25%, 60%, 80% complete)
- 2 in-progress claims (one submitted, one at assessment stage)
- 1 completed claim with ratings

## DEMO FLOW ON SATURDAY
This is the exact flow you'll walk through on stage (30-45 seconds per step):
1. New client registers, fills onboarding forms, digitally signs → PDF generated
2. Adviser views updated dashboard, sees new client in list
3. Client reports motor accident, uploads licence photo → OCR extracts ID number and shows confidence score
4. Adviser confirms extracted data, claim submitted digitally signed
5. Show claim moving through status stages (submitted → processing → assessment → repair → completed)
6. Show mock API call in dev console (request/response to Santam API)
7. Claim completed, client and adviser rate experience
8. Show reminder firing and being dismissed

i pasted the logo image
Test this exact flow 5+ times before Saturday. If anything breaks here, fix it first.

## FINAL NOTES
This is an MVP to prove the concept: digital-first data capture, no manual re-entry, compliance tracking, claims end-to-end, reminders automated. All built for a non-technical brokerage team to adopt without months of training.

Royal Square logo should be visible in header of every page. Use brand colors consistently.

Good luck!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://square-connect-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3c169554-0142-4c57-a442-2ab62553f34e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
