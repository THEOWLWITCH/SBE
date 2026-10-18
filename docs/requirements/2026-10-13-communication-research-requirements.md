# CODEX DEVELOPMENT PROMPT
## BE GOOD — Communication Principles, Research Infrastructure and Study-Level Permissions

You are the lead full-stack engineer, software architect, database security engineer, and UX designer for BE GOOD.

Your task is to upgrade the existing BE GOOD application in three coordinated areas:

1. Make the eight newly defined communication and preparedness principles visible in the existing communication tool.
2. Improve the unified educational communication tool with two modes: single-message writing and ongoing communication management.
3. Build a secure, multi-study research-management environment integrated into the administration system, with strict isolation between studies and researchers.

**CRITICAL: Work on the existing project. Do not rebuild BE GOOD from scratch. Preserve existing functionality, data, authentication, and design patterns.**

Do not deploy changes to production without explicit permission.

# PART A — PRODUCT ARCHITECTURE

## 1. One unified communication tool

The product name is:

**תקשורת מקדמת חוסן חברתי**

English: Communication for Social Resilience

The tool has two modes:

### Mode A — ניסוח חד־פעמי

The educator writes a simple instruction, such as:

"נסחי הודעה להורים על הפעילות בשבוע הקרוב."

The educator may also attach a document, photo, or screenshot.

The system produces a professional, ready-to-edit message.

### Mode B — ניהול תקשורת

The educator can open or continue a communication process.

The application maintains relevant conversation context, previous drafts, confirmed sent messages, agreements, unresolved questions, and follow-up actions.

The educator remains in control of all decisions and communications.

There must be a simple transition from single-message mode to ongoing communication mode.

Do not add mandatory questions, classifications, or additional forms to the educator's regular writing experience.

The AI must perform its analysis internally.

# PART B — THE 18 COMMUNICATION PRINCIPLES

## 2. Preserve the existing ten principles

The ten original principles are:

1. Use first-person plural language ("אנחנו", "כולנו") to create belonging where appropriate.
2. Combine a reassuring message with a call to action.
3. Convey responsible management and realistic confidence: what has already been done and what is planned.
4. Connect the individual with the collective.
5. Use familiar local stories or imagery when grounded in factual information.
6. Use gentle, context-sensitive humor only when appropriate.
7. Refer to familiar school figures or places only when factually provided and authorized.
8. Encourage volunteering, collaboration, and active participation.
9. Use clear, accessible, natural, professional language.
10. End with a constructive, hopeful message when appropriate.

Do not remove these principles.

## 3. Add eight additional principles

These principles represent the intentional use of educational communication as an existing social mechanism for strengthening preparedness and social resilience.

### 11. מרחב השפעה ואחריות

Distinguish between what is within a person's control, what can be influenced, what is outside their control, and which responsibilities can realistically be assumed.

Avoid unrealistic promises or placing responsibility on people for circumstances outside their influence.

### 12. יוזמה פרואקטיבית

Encourage feasible, proactive actions instead of waiting passively for problems or crises.

Support initiative without generating unnecessary tasks or obligations.

### 13. אמפתיה, הבנת צרכים ומנהיגות משתפת

Start with understanding the needs, concerns, capabilities, and perspectives of the intended audience.

Encourage shared planning and genuine participation.

Do not assume knowledge of other people's emotions or intentions.

### 14. זיהוי משאבים וחסמים

Identify existing resources and capabilities and recognize barriers that may limit action.

Do not invent organizational resources, policies, or commitments.

### 15. השקעה בהווה למען מוכנות עתידית

Encourage realistic investment of time and effort in the present when it can contribute to future preparedness and resilience.

Do not encourage excessive personal sacrifice.

### 16. הנחיות מעשיות לפעולה

Where appropriate, transform general messages into clear, feasible, practical guidance.

Avoid vague calls to action without specifying what can actually be done.

### 17. יישום, אחריות ובקרה

Where relevant, clarify who is responsible, what should happen next, when it should happen, and how progress may be reviewed.

Do not invent assignments or deadlines.

### 18. למידה, מיומנויות משותפות ושיפור מתמשך

Encourage reflection, shared learning, development of shared skills, adaptation, and continuous improvement.

Support the ability of educators and communities to develop initiative and preparedness leadership among others.

## 4. Visible presentation of all 18 principles

The principles must be visible to educators.

Use a collapsible panel or compact drawer named:

**עקרונות התקשורת של BE GOOD**

Divide the display into two groups:

**עשרת עקרונות התקשורת** — existing 10.

**שמונה עקרונות לתקשורת מקדמת חוסן** — new 8.

Show the principles in clear, accessible Hebrew, with short explanations.

Default to a compact layout so the main writing workspace remains uncluttered.

Educators may review the principles but are never required to answer questions about them.

Do not add 18 checkboxes or a mandatory principles form.

The AI should apply principles selectively according to the context.

Not every communication requires all 18 principles.

Keep the underlying prompt logic versioned.

# PART C — RESEARCH MANAGEMENT

## 5. Research is secondary to the professional tool

BE GOOD is a professional assistance platform for educators.

Research must never interfere with ordinary use.

Users who do not participate in research receive the same full professional tool.

Research data may be collected only when appropriate informed consent and other required approvals are in place.

The research interface belongs to the administration environment but must also function as a logically separate research workspace.

## 6. Research management architecture

Create a dedicated administration section:

**ניהול מחקרים — Research Management**

The system must support multiple independent research projects.

Each research project has:

- Unique study ID.
- Study title.
- Description.
- Principal investigator.
- Authorized researchers.
- Status: Draft / Pending Approval / Active / Paused / Completed / Archived.
- Approval and ethics documentation status.
- Consent form version.
- Research questionnaire versions.
- Research start and end dates.
- Data retention policy.
- Access permissions.
- Research export configuration.
- Tool and AI version information.

Research projects must be isolated from one another.

A researcher assigned only to Study A must not be able to access, discover, search, download, or infer information from Study B.

The isolation must be enforced at the database and backend authorization layers — not merely through hidden UI elements.

# PART D — RESEARCH ROLES AND PERMISSIONS

## 7. Create the following role model

### Role 1 — System Owner / Research Super Admin

This role belongs to the platform owner.

Permissions:

- View all studies.
- Create new studies.
- Assign and remove researchers.
- Configure study permissions.
- Approve study activation subject to required institutional approvals.
- View and manage study data.
- Configure questionnaires.
- View reports and exports.
- Suspend studies.
- Revoke researcher access.
- Access a complete audit log.

The owner controls the research environment.

### Role 2 — Study Principal Investigator

Can manage only explicitly assigned studies.

Permissions may include:

- Manage the assigned study's questionnaires.
- Review authorized study data.
- Review participant and study progress.
- View study reports.
- Export approved data.
- Manage study collaborators only when explicitly permitted by the owner.

Cannot access any other study.

### Role 3 — Study Researcher

Can work only within assigned studies.

Permissions are configurable:

- View anonymized or pseudonymized study data.
- Review questionnaires.
- Analyze study results.
- Access authorized reports.
- Export datasets only when explicitly authorized.

No default access to personally identifying information.

Cannot create arbitrary access for other researchers.

Cannot see studies to which they have not been assigned.

### Role 4 — Research Assistant / Analyst

Limited access to explicitly approved study data.

No participant contact information unless separately authorized.

No access to other studies.

### Role 5 — Ordinary BE GOOD User

No research administration access.

Research enrollment is optional.

## 8. Fine-grained permissions

Permissions should be assigned by the owner for each study independently.

At minimum:

- view_study
- edit_study
- manage_questionnaires
- view_aggregate_results
- view_pseudonymized_data
- view_identifiable_data
- view_document_content
- export_data
- manage_participants
- contact_participants
- manage_researchers
- manage_consent
- view_audit_log

Apply least-privilege defaults.

An assigned researcher must not automatically gain unrestricted access to participant identities, email addresses, communication content, or exported datasets.

# PART E — MULTI-STUDY ISOLATION

## 9. Example access scenario

The system owner manages two research projects.

### Research Study A

Researcher: Shoshi

Title: A study of educational communication and preparedness leadership.

Shoshi can access only Study A and the authorized data associated with it.

### Research Study B

Researcher: Einat

Title: A study of communication processes and professional development.

Einat can access only Study B and the authorized data associated with it.

Shoshi must not know that Study B exists.

Einat must not know that Study A exists.

Neither researcher may access another study through:

- Navigation menus.
- Direct URLs.
- API requests.
- Database queries.
- Exports.
- File storage.
- Search.
- Report dashboards.
- Shared identifiers.
- Browser caching.

The owner has access to both studies and controls all assignments.

Do not hardcode Shoshi or Einat as actual users. They are illustrative examples.

## 10. Database-level enforcement

Inspect the existing database technology.

If the application uses Supabase/PostgreSQL, implement appropriate Row Level Security policies.

If the application uses another backend, implement equivalent server-side tenant/study-level authorization.

All study-specific tables must include an appropriate study identifier.

Authorization must be validated on every read, write, export, update, delete, and file-access operation.

Apply explicit permission checks at the API layer.

A frontend filter is not a security boundary.

Protect against insecure direct object references and cross-study data leaks.

Never expose privileged service credentials to the browser.

Implement automated cross-study access-denial tests.

# PART F — RESEARCH STUDY MANAGEMENT UI

## 11. Owner dashboard

Create a dedicated research administration dashboard accessible from the existing BE GOOD management interface.

Suggested title:

**מרכז המחקר של BE GOOD**

Display:

- Total studies.
- Active studies.
- Draft studies.
- Participant counts.
- Questionnaire completion rates.
- Pending follow-ups.
- Researcher access management.
- Study version information.
- Data exports.
- Audit logs.

Use a clean, professional RTL design.

The owner can open each study to manage its configuration.

## 12. Researcher dashboard

Each researcher sees only assigned studies.

If a researcher is assigned to one study, their interface should open directly to that study.

Display only features authorized by their permissions.

For example, a researcher may see questionnaire results but not participant email addresses.

## 13. Study creation flow

The owner can create a new study with:

- Study title.
- Research questions.
- Study description.
- Researchers and permissions.
- Eligible participant population.
- Consent requirements.
- Data collection settings.
- Surveys and follow-up schedule.
- Approved data access scope.
- Data retention configuration.

Allow study configuration as a draft without beginning data collection.

Activation must require confirmation that the required consent and approvals are in place.

# PART G — PARTICIPANT CONSENT AND DATA COLLECTION

## 14. Research enrollment

Participants may voluntarily join an available study.

Do not enroll all BE GOOD users automatically.

The system should support study-specific consent.

A participant may consent to Study A without consenting to Study B.

Consent to one study never authorizes sharing data with another.

Store:

- Participant ID.
- Study ID.
- Consent version.
- Consent timestamp.
- Consent status.
- Research contact preferences.
- Withdrawal status.

Researchers must only see participants enrolled in their authorized studies.

## 15. Email and participant contact

For longitudinal research, an email address is required to support follow-up communication.

Verify the email address.

Store contact information separately from questionnaire responses and analysis datasets.

Support:

- Automatic welcome and thank-you email after completed enrollment.
- Explanation of study expectations.
- Follow-up questionnaires.
- Personal feedback when available.
- Study-related updates.
- Withdrawal and contact preference management.

The system must never send an email merely because a draft consent form was opened.

Implement an appropriate email delivery mechanism using existing infrastructure.

## 16. Previous educational communication samples

Study participants may voluntarily provide historical communication samples created without BE GOOD.

Examples:

- Letters to parents.
- WhatsApp messages to students.
- WhatsApp messages to parents.
- Staff communications.
- School announcements.
- Other educational communication materials.

Store these separately from BE GOOD-generated samples.

Capture:

- Sample ID.
- Study ID.
- Participant ID.
- Communication category.
- Approximate date or year.
- Intended audience.
- Whether BE GOOD was used.
- Source type.
- Consent and de-identification status.

Encourage participants to paste only messages they themselves wrote, rather than uploading complete WhatsApp conversations.

Remove or minimize identifying information about students, families, and third parties.

Do not store sensitive school documents indiscriminately.

Historical samples are optional. Their absence must not automatically exclude someone from longitudinal studies.

# PART H — RESEARCH METRICS AND INSTRUMENTS

## 17. Research measures

Prepare a flexible questionnaire engine.

The platform must support study-specific survey instruments, including:

**PLSE — Preparedness Leadership Self-Efficacy**

**WIFP — Willingness to Invest in Future Preparedness**

Additional potential constructs:

- Awareness of existing social mechanisms.
- Perceived professional responsibility.
- Proactive initiative.
- Empathy and understanding audience needs.
- Communication confidence.
- Perceived relationship quality.
- Shared skills and collaborative agency.
- Actual preparedness actions.
- Unexpected changes discovered through open-ended questions.

These are research constructs under development, not automatically validated psychological measures.

Do not hardcode a universal combined score.

Each study may choose its own approved questionnaires and measurement schedule.

## 18. Research data from tool usage

For consented participants and authorized studies, prepare collection of:

- Tool version.
- Writing principles version.
- AI model and prompt version.
- Usage mode: single message / ongoing communication.
- Number of writing sessions.
- Number of drafts.
- Number of revisions.
- Number of communication rounds.
- General audience classification.
- Timestamps and relevant duration measures.
- Optional final document content under separate consent.
- Survey responses.
- Follow-up outcomes.

Do not silently include ordinary nonconsenting users.

All data collection must be configured at the individual study level.

# PART I — VERSION CONTROL AND AUDITING

## 19. Critical versioning requirement

Every significant version of the writing tool must be identifiable.

Store:

- Application release version.
- Communication tool version.
- Writing principles version.
- AI prompt version.
- AI model identifier.
- Survey instrument version.
- Consent form version.
- Database schema version.

Each research record must be linkable to the relevant versions.

Changes in AI prompts, content rules, or writing principles must not silently overwrite historical versions.

Research analysis must be able to identify which exact system configuration was used to generate a given communication.

## 20. Audit trail

Log research administration events including:

- Study creation.
- Study activation and suspension.
- Researcher assignment and removal.
- Permission changes.
- Data exports.
- Access to identifiable data.
- Consent changes.
- Study configuration changes.

The audit log must be protected against ordinary researcher modification.

Avoid recording unnecessary sensitive content in logs.

# PART J — RESEARCH EXPORTS

## 21. Study-specific exports

Allow authorized researchers to export only data belonging to their assigned study and approved data category.

Supported formats may include CSV and XLSX where available.

Include a data dictionary and version metadata.

Default to pseudonymized datasets.

Exporting identifiable participant data must require explicit permissions.

Prevent a user from exporting another study's data by altering request parameters.

# PART K — PRIVACY AND SAFETY

## 22. Privacy by design

The system will handle educational communications, potentially including sensitive information about minors, families, and school matters.

Implement:

- Secure authentication.
- Least-privilege authorization.
- Encryption in transit and appropriate encryption at rest.
- Secure storage access.
- Data minimization.
- Configurable retention periods.
- Withdrawal and deletion workflows.
- Secure export.
- Clear separation between professional content and research data.

Do not expose participant identity through study metadata.

Do not share research data across studies without an additional lawful and explicitly authorized process.

Never assume a user who agreed to one study agreed to every study.

# PART L — IMPLEMENTATION AND TESTING

## 23. Development sequence

Work in this order:

**Phase 1 — Inspect and plan**

Inspect the existing code, architecture, authentication, database, and admin interface.

Identify existing functionality that can be reused.

Present a concise technical implementation plan.

**Phase 2 — Communication principles**

Add the visible eight principles and integrate them into the existing writing engine.

Preserve the existing ten principles.

**Phase 3 — Unified communication tool**

Integrate single-message writing and ongoing communication management into one coherent interface.

**Phase 4 — Research database and security**

Implement study-level separation, permission tables, consent records, and access policies.

**Phase 5 — Research administration UI**

Build the owner and researcher dashboards.

**Phase 6 — Surveys and data collection**

Implement questionnaires, research enrollment, sample uploads, and longitudinal follow-ups.

**Phase 7 — Testing**

Test functionality, authorization, privacy, study isolation, exports, and version tracking.

Do not deploy without authorization.

## 24. Mandatory security tests

Test at least the following:

1. Shoshi logs in and sees only Study A.
2. Einat logs in and sees only Study B.
3. Shoshi attempts to open Study B by direct URL — denied.
4. Einat attempts to access Study A through API requests — denied.
5. A researcher changes the study ID in an export request — denied.
6. A researcher without contact permission attempts to access participant emails — denied.
7. A researcher attempts to access another study's attachments — denied.
8. A participant consents to Study A only — no enrollment or data sharing with Study B.
9. The owner revokes researcher access — subsequent access fails.
10. Ordinary BE GOOD users cannot access any research administration function.
11. All study records retain their original tool, prompt, and instrument versions.
12. Existing letter-writing and communication tools continue working after all changes.

Do not consider the research environment complete until cross-study isolation has been verified.

## 25. Final deliverables

Provide:

1. Working modifications to the existing BE GOOD project.
2. Visible presentation of the 18 communication principles.
3. Unified communication interface.
4. Research administration dashboard.
5. Study creation and management.
6. Per-study researcher permissions.
7. Database-enforced study isolation.
8. Study-specific consent and participant management.
9. Questionnaire infrastructure.
10. Version tracking.
11. Study-specific exports.
12. Automated tests.
13. Database migration files.
14. A concise implementation summary identifying what was completed, tested, and remains dependent on external services or credentials.

Do not claim that a feature is operational unless it has been implemented and tested.

## FINAL PRODUCT PRINCIPLE

BE GOOD must remain simple and useful for educators.

Research must be powerful, secure, and invisible to ordinary users who do not participate.

The platform owner manages all research projects.

Each authorized researcher works only within their assigned research environment.

**One BE GOOD platform. One professional communication tool. Multiple independent, securely isolated research projects.**