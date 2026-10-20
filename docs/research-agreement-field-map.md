# Guided agreement V4 field map

U1 imports the complete supplied unsigned V4 source into `harness/content/research-agreement-guidance-v4.json`. This file is server-only. The browser core publishes field definitions and applicability vocabulary, without the source clauses or hints. Catalog import alone creates no template record, approval, processing authorization, signed agreement or financial obligation.

Source raw SHA-256: `73a22c07e4df4cdac9560b95a77d6284d389e21aebcdacd64acc5e24a4c325ad`. Independent canonical JSON SHA-256: `2688c94d99c624afb469b678e76fce3d2b8a35f49de97e678f4f619fa98ef0ac`. The catalog preserves all twelve source sections, every original paragraph, all 24 completion/guidance instructions and the eight completion checklist entries in `sourceDocument`. The A–F source annex descriptions describe documents to prepare; they are not completed annex originals.

## Stable private catalog shape

`catalogVersion`, `source`, `sourceDocument`, `sections`, `bodyPlaceholders`, `decisions`, `checklist` and `templateData` are the catalog entrypoints. Each section preserves its existing section ID. `sections[].paragraphs` gives the source paragraph index, proposed/owner-approved status and prepared clause text. Original text remains in `sourceDocument`. Each occurrence has zero-based paragraph/occurrence indexes, its exact source marker, primary `fieldId` and every component in `fieldIds`. `decisions[].fieldPaths` maps the exact completion/guidance text to top-level or `rows[].field` vocabulary. `templateData` conforms to the existing agreement_template schema for later scoped preparation; U1 does not create it in a study.

Only the first two paragraphs of source section 8 carry `owner_approved`, preserved byte for byte. Every other source clause is proposed. The prepared template omits the editorial research-method example, the proposed annex-description paragraph and the “proposed completion” label; it keeps substantive future-IP terms. The IP reading explanation is separate from contractual approval. The approved paragraphs occur once in the deterministic preview.

## Nineteen body occurrences

| Section | Paragraph | Occurrence | Editable components |
|---|---:|---:|---|
| parties | 1 | 1 | `ownerName` |
| parties | 1 | 2 | `ownerRegistration` |
| parties | 1 | 3 | `ownerAddress` |
| parties | 1 | 4 | `ownerEmail` |
| parties | 1 | 5 | `ownerSignatory`, `ownerSignatoryRole` |
| parties | 1 | 6 | `partnerName` |
| parties | 1 | 7 | `partnerRegistration` |
| parties | 1 | 8 | `partnerAddress` |
| parties | 1 | 9 | `partnerEmail` |
| parties | 1 | 10 | `partnerSignatory`, `partnerSignatoryRole` |
| parties | 2 | 1 | `leadResearcher`, `leadResearcherRole`, `leadResearcherInstitution` |
| study | 1 | 1 | `studyIdentifier` |
| study | 1 | 2 | `studyTitle` |
| study | 1 | 3 | `centralResearchQuestion` |
| durationTermination | 1 | 1 | `effectiveDate` |
| durationTermination | 1 | 2 | `terminationDate` |
| durationTermination | 2 | 1 | `terminationNoticeDays` |
| annexes | 2 | 1 | `publicationReviewPeriod`, `publicationReviewUnit` |
| reviewSigning | 2 | 1 | `signatureProvider`, `signatureVerification` |

Signer placeholders include name and role; the lead researcher includes a separate name, role and institution. Legal party kind and registration stay separate from the operational researcher. The publication period includes its explicit unit. Termination notice renders the chosen integer with “ימים”. The provider placeholder also maps required verification checks.

## Completion and annex content

The additive core contract is schema 3 / agreement 1.1.0. `guidedVersion: "4"` activates guided completion requirements; legacy versions with no guided fields retain the earlier requirements and rendering. V4 template requiredFieldIds additionally require guidedVersion, every guided decision and all annex applicability choices, so removing the version flag cannot make that template complete. `requiredWhen` applies identically in JavaScript and SQL, including nested professional service rows. Selecting an applicable annex requires actual rows; selecting not_applicable requires an explicit reason, even when guidedVersion is absent. Draft saving allows gaps and missingFields returns their exact paths. Unknown keys, invalid dates, reversed date ranges, malformed amounts and invalid enums remain rejected.

All A–F rows contain actual selected structured content. Numeric amounts are decimal strings with two places. Annex C separates estimate, proposed cap, actual expenditure, party shares and service price; actual expenditure is optional until recorded. Estimate, cap and shares are explicit numeric decisions, including user-selected zero where appropriate. Service rows additionally require pricing method, provider, a separate service recipient, deliverable, price, hours/scope decision, acceptance and credit decision. No blank amount implies unpaid work.

| Annex | Rows | Decisions |
|---|---|---|
| A | `annexA` | `stage`, `questions`, `population`, `sites`, `recruitment`, `measurementVersions`, `responsible`, `deliverables`, `schoolAdaptation`, `adaptationEvaluation`, `permits`, `terminationHandover`, `populationSize`, `startDate`, `endDate` |
| B | `annexB` | `tool`, `source`, `version`, `dataScope`, `exportTerms`, `quota`, `training`, `humanReview`, `authorizedUsers`, `actions`, `startDate`, `endDate` |
| C | `annexC` | `description`, `purpose`, `calculationBasis`, `taxTerms`, `shareTerms`, `payer`, `payee`, `approver`, `approvalEvidence`, `paymentTerms`, `invoiceTerms`, `partialWorkTerms`, `unpaidTerms`, `kind`, `estimatedAmount`, `approvedCap`, `ownerShare`, `partnerShare`, `actualAmount`, `currency`, `settlementDate`, `pricingMethod`, `serviceAmount`, `provider`, `serviceRecipient`, `deliverable`, `hourCap`, `acceptance`, `credit` |
| D | `annexD` | `contributionIdentifier`, `contributor`, `institution`, `description`, `deliverable`, `milestones`, `acceptance`, `ownerDuties`, `requestedRecognition`, `requestedRights`, `agreedRecognition`, `agreedRights`, `agreedConditions`, `confirmingVersion`, `category`, `dueDate`, `requestedPayment`, `agreedPayment`, `currency`, `executionEvidence` |
| E | `annexE` | `dataCategories`, `purposes`, `partyRoles`, `providers`, `transferBasis`, `storageLocation`, `retention`, `backups`, `deletion`, `withdrawal`, `ethicsReferences`, `participantConsent`, `securityResponsible`, `securityMeasures`, `incidentHandling`, `contact`, `terminationHandling`, `authorizedPeople` |
| F | `annexF` | `description`, `creators`, `rightsHolders`, `ownership`, `licence`, `permittedUses`, `modification`, `distribution`, `commercialUse`, `term`, `compensation`, `publication`, `credit`, `assetKind` |

Contacts and copy recipients have typed email rows. Development tasks distinguish the school need, users, change, measurable output, performer, budget, milestones, test environment, acceptance, training, usability evaluation, maintenance and rights. Additional fields expose legal party/signature authority, support scope, confidentiality scope/duration/exceptions, cure/suspension/handover/settlement, publication/disputes/document priority/law/jurisdiction/liability/insurance and signature evidence/storage/delivery/activation decisions.

No suggested 30-day termination notice, 21-business-day publication window, storage country, retention or backup period is a default or an adopted term. The suggested numbers remain private hints. Proposed processing terms describe the agreement; they do not authorize an external provider route.

## Verification and downstream boundary

The additive `20261020-guided-agreement-contract.sql` replaces the static typed contract and its field validator only. It leaves historical migrations and stored versions unchanged, adds no public operation and retains existing function ownership/grants. Fixture and hardened non-superuser migration order load it after partnership intake. Focused tests cover independent source hashes, all occurrences and instructions, every field group, approved IP bytes, annex completeness, type rejection, legacy records, actual SQL parity and hardened migration authorization.

Scoped preparation and hint delivery are implemented by U2/U3. U4 adds one `document` model to guided V4 render results: `version: "guided-v4-1"`, RTL/Hebrew metadata and ordered `blocks`. Blocks carry their field IDs and are titles, headings, completed paragraphs, labelled fields, stacked rows or signature anchors. Live preview, plain text, authorized HTML/PDF printing, DOCX and unsigned provider bytes use this model. A field substituted into a selected clause is not repeated as a labelled field. Custom clauses appear at their selected section once; the title appears once. The full source instructions, suggested examples and completion checklist are editor guidance, outside this model.

Applicable annexes include actual selected rows; their stale non-applicability reasons are omitted. Inapplicable annexes show the explicit reason and omit any retained rows. A missing applicability decision or required row remains a visible gap. Rendering never edits the stored draft. Long annex rows use successive labelled paragraphs, allowing page continuation rather than a wide table with dozens of columns. Guided dates display `DD.MM.YYYY`, amounts retain two decimal places and display digit grouping, and permission IDs have Hebrew display labels; canonical stored data and content hashes are unchanged.

The draft `ipReadAcknowledgement` form value is excluded from the generated contractual body. The actual exact-version acknowledgement belongs to `agreementApprove`, independently of signing. A user-entered `finalVersionLabel` is described as the label entered in the agreement, and the template reference is neutral about approval. The generated body does not claim signing, provider verification or external-processing authorization. The IP explanation remains linked to its exact template version.

Optional exports retain their actual MIME types and byte hashes. PDF uses the authorized HTML with native printing; HTML is never renamed as a PDF. Guided DOCX contains proper OOXML, A4/24 mm margins, black Arial Title/Heading styles, mixed-direction runs and heading/signature continuity. Word's `w:bidi` resolves `w:jc="left"` at the physical right margin; this guided-only setting follows actual Word-to-PDF inspection. Legacy documents retain the previous renderer and DOCX byte contract. The in-app print shell reuses its own title, retains the authorized layout CSS and overrides its generic justification with right alignment for the agreement.

After the authorized export RPC, the gateway refuses generic regeneration of an executed agreement (`signed_original_required`, HTTP 409). The interface directs the authorized party to the private immutable signed document and audit evidence. This safeguard does not create missing provider evidence or certify a signature. Signed originals must be retrieved through the separately authorized private-document route. The new model and guards are local development changes; no production migration or deployment is implied by these checks.
